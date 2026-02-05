/**
 * Spond Sync Service
 * 
 * Handles bidirectional synchronization between the Renegades app and Spond.
 * - Imports events from Spond
 * - Imports groups (teams) from Spond
 * - Exports local events to Spond (optional)
 * - Maps Spond data to local database schema
 */

import { SpondClient, SpondGroup, SpondEvent, getSpondClient, initializeSpondClient } from './spond.js';
import { getPool } from '../db.js';
import sql from 'mssql';

/**
 * Normalize Spond UUID to the format Spond API expects (no hyphens, uppercase)
 * Accepts both formats: with hyphens (a1b2c3d4-e5f6-7890-abcd-ef1234567890) 
 * and without hyphens (A1B2C3D4E5F67890ABCDEF1234567890)
 * 
 * Spond API expects IDs in uppercase without hyphens (e.g., A6C03B65982444C18328024047630CB9)
 */
function normalizeSpondUUID(id: string | null | undefined): string | null {
  if (!id) return null;
  
  // Remove any existing hyphens and convert to uppercase (Spond API format)
  const cleanId = id.replace(/-/g, '').toUpperCase();
  
  // Check if it's a valid 32-char hex string
  if (!/^[0-9A-F]{32}$/.test(cleanId)) {
    return null; // Invalid UUID
  }
  
  // Return in Spond API format: uppercase, no hyphens
  return cleanId;
}

export interface SyncResult {
  success: boolean;
  message: string;
  imported: number;
  updated: number;
  linked: number;  // Events that were matched by date/time/location and linked to Spond
  errors: string[];
}

export interface SpondSyncConfig {
  username: string;
  password: string;
  groupMappings?: Array<{
    spondGroupId: string;
    localTeamId: number;
  }>;
  syncDirection: 'import' | 'export' | 'bidirectional';
  autoSync: boolean;
  syncIntervalMinutes: number;
}

/**
 * Map Spond event type to local event type
 */
function mapEventType(spondType?: string, heading?: string): string {
  const headingLower = heading?.toLowerCase() || '';
  
  if (headingLower.includes('practice') || headingLower.includes('training')) {
    return 'Practice';
  }
  if (headingLower.includes('game') || headingLower.includes('match')) {
    return 'Game';
  }
  if (headingLower.includes('meeting')) {
    return 'Meeting';
  }
  
  switch (spondType?.toUpperCase()) {
    case 'MATCH':
      return 'Game';
    case 'TRAINING':
    case 'PRACTICE':
      return 'Practice';
    case 'MEETING':
      return 'Meeting';
    default:
      return 'Other';
  }
}

/**
 * Map Spond event status to local status
 */
function mapEventStatus(spondEvent: SpondEvent): string {
  if (spondEvent.cancelled) {
    return 'Cancelled';
  }
  
  const startTime = new Date(spondEvent.startTimestamp);
  const now = new Date();
  const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (startTime < now) {
    return 'Completed';
  }
  if (hoursUntilStart < 24) {
    return 'Confirmed';
  }
  return 'Planned';
}

/**
 * Import events from Spond into local database
 */
export async function importEventsFromSpond(
  client: SpondClient,
  options: {
    groupId?: string;
    daysAhead?: number;
    daysBehind?: number;
  } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    message: '',
    imported: 0,
    updated: 0,
    linked: 0,
    errors: [],
  };

  try {
    const pool = await getPool();
    
    // Build a lookup map of spond_group_id -> team_id for team mapping
    // Normalize IDs for consistent lookups (Spond may return different formats)
    const teamMappingResult = await pool.request()
      .query('SELECT id, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    const teamMapping = new Map<string, number>();
    for (const team of teamMappingResult.recordset) {
      // Store with normalized ID (uppercase, no hyphens) for consistent lookup
      const normalizedId = normalizeSpondUUID(team.spond_group_id);
      if (normalizedId) {
        teamMapping.set(normalizedId, team.id);
      }
    }
    console.log(`[Spond Sync] Loaded ${teamMapping.size} team mappings`);
    
    // Calculate date range
    const now = new Date();
    const minStart = new Date(now);
    minStart.setDate(minStart.getDate() - (options.daysBehind || 7));
    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() + (options.daysAhead || 60));
    
    // Fetch events from Spond
    const events = await client.getEvents({
      groupId: options.groupId,
      minStart,
      maxStart,
      maxEvents: 500,
    });

    console.log(`[Spond Sync] Found ${events.length} events to sync`);

    for (const spondEvent of events) {
      try {
        // Check if this event already exists (by spond_id)
        const existing = await pool.request()
          .input('spond_id', sql.NVarChar, spondEvent.id)
          .query('SELECT id, updated_at FROM events WHERE spond_id = @spond_id');

        // Parse timestamps - Spond sends ISO strings with timezone
        // We need to preserve the local time, not convert to UTC
        const startTime = new Date(spondEvent.startTimestamp);
        const endTime = new Date(spondEvent.endTimestamp);
        
        // Log for debugging
        console.log(`[Spond Sync] Event ${spondEvent.heading}: Spond time=${spondEvent.startTimestamp}, Parsed=${startTime.toISOString()}`);

        // Get the spond group ID and map to local team
        const spondGroupId = spondEvent.recipients?.group?.id || null;
        const mappedTeamId = spondGroupId ? teamMapping.get(spondGroupId) : null;
        
        if (spondGroupId && mappedTeamId) {
          console.log(`[Spond Sync] Mapped Spond group ${spondGroupId} to team ${mappedTeamId}`);
        }

        const eventData = {
          spond_id: spondEvent.id,
          event_type: mapEventType(spondEvent.type || spondEvent.spilesType, spondEvent.heading),
          start_time: startTime,
          end_time: endTime,
          description: spondEvent.heading + (spondEvent.description ? `\n\n${spondEvent.description}` : ''),
          status: mapEventStatus(spondEvent),
          spond_group_id: spondGroupId,
          team_id: mappedTeamId,
          spond_data: JSON.stringify(spondEvent),
        };

        if (existing.recordset.length > 0) {
          // Update existing event (already linked to Spond)
          // Update time/status from Spond, but keep team mapping in sync
          const updateRequest = pool.request()
            .input('id', sql.Int, existing.recordset[0].id)
            .input('event_type', sql.NVarChar, eventData.event_type)
            .input('start_time', sql.DateTime, eventData.start_time)
            .input('end_time', sql.DateTime, eventData.end_time)
            .input('description', sql.NVarChar, eventData.description)
            .input('status', sql.NVarChar, eventData.status)
            .input('spond_group_id', sql.NVarChar, eventData.spond_group_id)
            .input('spond_data', sql.NVarChar, eventData.spond_data)
            .input('updated_at', sql.DateTime, new Date());
          
          // Only update team_id if we have a mapping and the event doesn't already have a team
          if (mappedTeamId) {
            updateRequest.input('team_id', sql.Int, mappedTeamId);
            await updateRequest.query(`
              UPDATE events SET
                event_type = @event_type,
                start_time = @start_time,
                end_time = @end_time,
                description = @description,
                status = @status,
                spond_group_id = @spond_group_id,
                spond_data = @spond_data,
                team_id = COALESCE(team_id, @team_id),
                updated_at = @updated_at
              WHERE id = @id
            `);
          } else {
            await updateRequest.query(`
              UPDATE events SET
                event_type = @event_type,
                start_time = @start_time,
                end_time = @end_time,
                description = @description,
                status = @status,
                spond_group_id = @spond_group_id,
                spond_data = @spond_data,
                updated_at = @updated_at
              WHERE id = @id
            `);
          }
          result.updated++;
        } else {
          // No spond_id match - check for potential duplicate by date/time and location
          const potentialDuplicate = await findPotentialDuplicate(pool, spondEvent);

          if (potentialDuplicate) {
            // Link existing local event to this Spond event
            // PRESERVE local event's title, description, and other attributes
            // Only add the Spond linkage (spond_id, spond_group_id, spond_data)
            // and set team_id if not already set
            console.log(`[Spond Sync] Linking local event ${potentialDuplicate.id} to Spond event ${spondEvent.id} (preserving local attributes)`);
            
            const linkRequest = pool.request()
              .input('id', sql.Int, potentialDuplicate.id)
              .input('spond_id', sql.NVarChar, eventData.spond_id)
              .input('spond_group_id', sql.NVarChar, eventData.spond_group_id)
              .input('spond_data', sql.NVarChar, eventData.spond_data)
              .input('updated_at', sql.DateTime, new Date());
            
            if (mappedTeamId) {
              linkRequest.input('team_id', sql.Int, mappedTeamId);
              await linkRequest.query(`
                UPDATE events SET
                  spond_id = @spond_id,
                  spond_group_id = @spond_group_id,
                  spond_data = @spond_data,
                  team_id = COALESCE(team_id, @team_id),
                  updated_at = @updated_at
                WHERE id = @id
              `);
            } else {
              await linkRequest.query(`
                UPDATE events SET
                  spond_id = @spond_id,
                  spond_group_id = @spond_group_id,
                  spond_data = @spond_data,
                  updated_at = @updated_at
                WHERE id = @id
              `);
            }
            result.linked++;
          } else {
            // Insert new event - no duplicate found
            // Include team_id mapping if available
            const insertRequest = pool.request()
              .input('spond_id', sql.NVarChar, eventData.spond_id)
              .input('event_type', sql.NVarChar, eventData.event_type)
              .input('start_time', sql.DateTime, eventData.start_time)
              .input('end_time', sql.DateTime, eventData.end_time)
              .input('description', sql.NVarChar, eventData.description)
              .input('status', sql.NVarChar, eventData.status)
              .input('spond_group_id', sql.NVarChar, eventData.spond_group_id)
              .input('spond_data', sql.NVarChar, eventData.spond_data);
            
            if (mappedTeamId) {
              insertRequest.input('team_id', sql.Int, mappedTeamId);
              await insertRequest.query(`
                INSERT INTO events (spond_id, event_type, start_time, end_time, description, status, spond_group_id, spond_data, team_id)
                VALUES (@spond_id, @event_type, @start_time, @end_time, @description, @status, @spond_group_id, @spond_data, @team_id)
              `);
            } else {
              await insertRequest.query(`
                INSERT INTO events (spond_id, event_type, start_time, end_time, description, status, spond_group_id, spond_data)
                VALUES (@spond_id, @event_type, @start_time, @end_time, @description, @status, @spond_group_id, @spond_data)
              `);
            }
            result.imported++;
          }
        }
      } catch (eventError) {
        result.errors.push(`Event ${spondEvent.id}: ${(eventError as Error).message}`);
      }
    }

    result.message = `Sync completed: ${result.imported} imported, ${result.updated} updated, ${result.linked} linked`;
    console.log(`[Spond Sync] ${result.message}`);
  } catch (error) {
    result.success = false;
    result.message = `Sync failed: ${(error as Error).message}`;
    result.errors.push((error as Error).message);
  }

  return result;
}

/**
 * Import groups from Spond as teams
 */
export async function importGroupsFromSpond(
  client: SpondClient
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    message: '',
    imported: 0,
    updated: 0,
    linked: 0,
    errors: [],
  };

  try {
    const pool = await getPool();
    const groups = await client.getGroups();

    console.log(`[Spond Sync] Found ${groups.length} groups to sync`);

    for (const group of groups) {
      try {
        // Check if this group already exists as a team
        const existing = await pool.request()
          .input('spond_group_id', sql.NVarChar, group.id)
          .query('SELECT id FROM teams WHERE spond_group_id = @spond_group_id');

        // Determine sport type from group name or activity
        const sportGuess = determineSport(group.name, group.activity);

        if (existing.recordset.length > 0) {
          // Update existing team
          await pool.request()
            .input('id', sql.Int, existing.recordset[0].id)
            .input('name', sql.NVarChar, group.name)
            .input('spond_data', sql.NVarChar, JSON.stringify(group))
            .input('updated_at', sql.DateTime, new Date())
            .query(`
              UPDATE teams SET
                name = @name,
                spond_data = @spond_data,
                updated_at = @updated_at
              WHERE id = @id
            `);
          result.updated++;
        } else {
          // Insert new team
          await pool.request()
            .input('name', sql.NVarChar, group.name)
            .input('sport', sql.NVarChar, sportGuess)
            .input('spond_group_id', sql.NVarChar, group.id)
            .input('spond_data', sql.NVarChar, JSON.stringify(group))
            .input('active', sql.Bit, true)
            .query(`
              INSERT INTO teams (name, sport, spond_group_id, spond_data, active)
              VALUES (@name, @sport, @spond_group_id, @spond_data, @active)
            `);
          result.imported++;
        }
      } catch (groupError) {
        result.errors.push(`Group ${group.id}: ${(groupError as Error).message}`);
      }
    }

    result.message = `Groups sync completed: ${result.imported} imported, ${result.updated} updated`;
    console.log(`[Spond Sync] ${result.message}`);
  } catch (error) {
    result.success = false;
    result.message = `Groups sync failed: ${(error as Error).message}`;
    result.errors.push((error as Error).message);
  }

  return result;
}

/**
 * Export local event to Spond
 */
export async function exportEventToSpond(
  client: SpondClient,
  eventId: number,
  spondGroupId: string
): Promise<{ success: boolean; spondEventId?: string; error?: string }> {
  try {
    const pool = await getPool();
    
    // Get the local event with sync settings
    // Use team_ids (comma-separated) and find the first matching team with a spond_group_id
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query(`
        SELECT 
          e.*, 
          t.spond_group_id as team_spond_group_id,
          ss.spond_parent_group_id,
          ss.is_subgroup
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 id, spond_group_id 
          FROM teams 
          WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
        ) t
        LEFT JOIN spond_sync_settings ss ON t.id = ss.team_id
        WHERE e.id = @id
      `);

    if (eventResult.recordset.length === 0) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.recordset[0];
    const targetGroupId = spondGroupId || event.team_spond_group_id;

    if (!targetGroupId) {
      return { success: false, error: 'No Spond group ID specified' };
    }

    // Determine the correct parent group and subgroup for Spond API
    // If the team is linked to a subgroup, we need to use the parent group as recipient
    // and specify the subgroup separately
    let recipientGroupId = targetGroupId;
    let subgroupIds: string[] | undefined;

    if (event.is_subgroup && event.spond_parent_group_id) {
      recipientGroupId = event.spond_parent_group_id;
      subgroupIds = [targetGroupId];
      console.log(`[Spond] Event ${eventId}: Using parent group ${recipientGroupId} with subgroup ${targetGroupId}`);
    }

    // Normalize UUIDs to ensure proper format
    const normalizedRecipientGroupId = normalizeSpondUUID(recipientGroupId);
    const normalizedSubgroupIds = subgroupIds?.map(id => normalizeSpondUUID(id)).filter((id): id is string => id !== null);

    if (!normalizedRecipientGroupId) {
      return { success: false, error: `Invalid Spond group ID format: ${recipientGroupId}` };
    }

    console.log(`[Spond] Event ${eventId}: Sending to group ${normalizedRecipientGroupId}${normalizedSubgroupIds?.length ? ` with subgroups: ${normalizedSubgroupIds.join(', ')}` : ''}`);

    // Create event in Spond
    const spondEvent = await client.createEvent(normalizedRecipientGroupId, {
      heading: event.description?.split('\n')[0] || `${event.event_type} Event`,
      description: event.description,
      startTimestamp: new Date(event.start_time),
      endTimestamp: new Date(event.end_time),
      type: event.event_type === 'Game' ? 'MATCH' : 'EVENT',
      subgroupIds: normalizedSubgroupIds,
    });

    // Update local event with Spond ID (store normalized group ID)
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('spond_id', sql.NVarChar, spondEvent.id)
      .input('spond_group_id', sql.NVarChar, normalizedRecipientGroupId)
      .query(`
        UPDATE events SET
          spond_id = @spond_id,
          spond_group_id = @spond_group_id,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    return { success: true, spondEventId: spondEvent.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Sync a single event bidirectionally
 */
export async function syncEvent(
  client: SpondClient,
  eventId: number
): Promise<{ success: boolean; action: string; error?: string }> {
  try {
    const pool = await getPool();
    
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query('SELECT * FROM events WHERE id = @id');

    if (eventResult.recordset.length === 0) {
      return { success: false, action: 'none', error: 'Event not found' };
    }

    const event = eventResult.recordset[0];

    if (event.spond_id) {
      // Event exists in Spond - update it
      await client.updateEvent(event.spond_id, {
        heading: event.description?.split('\n')[0] || `${event.event_type} Event`,
        description: event.description,
        startTimestamp: new Date(event.start_time),
        endTimestamp: new Date(event.end_time),
        cancelled: event.status === 'Cancelled',
      });
      return { success: true, action: 'updated' };
    } else {
      return { success: false, action: 'none', error: 'Event not linked to Spond' };
    }
  } catch (error) {
    return { success: false, action: 'error', error: (error as Error).message };
  }
}

/**
 * Check if two locations are approximately the same
 * Uses coordinates if available, falls back to address matching
 */
function isApproximateLocationMatch(
  spondLocation: { address?: string; latitude?: number; longitude?: number } | undefined,
  localEvent: { site_address?: string; latitude?: number; longitude?: number; field_name?: string; site_name?: string }
): boolean {
  // If no Spond location, can't match on location
  if (!spondLocation) {
    return true; // No location constraint from Spond
  }

  // If both have coordinates, check distance (within ~500 meters)
  if (
    spondLocation.latitude && spondLocation.longitude &&
    localEvent.latitude && localEvent.longitude
  ) {
    const latDiff = Math.abs(spondLocation.latitude - localEvent.latitude);
    const lonDiff = Math.abs(spondLocation.longitude - localEvent.longitude);
    // Approximately 0.005 degrees = ~500 meters
    if (latDiff < 0.005 && lonDiff < 0.005) {
      return true;
    }
  }

  // Fall back to address text matching
  if (spondLocation.address && (localEvent.site_address || localEvent.site_name || localEvent.field_name)) {
    const spondAddr = spondLocation.address.toLowerCase().trim();
    const localParts = [
      localEvent.site_address || '',
      localEvent.site_name || '',
      localEvent.field_name || ''
    ].join(' ').toLowerCase().trim();

    // Check if addresses share significant common words (exclude common words)
    const commonWords = ['the', 'at', 'of', 'in', 'and', 'or', 'a', 'an', '-', ',', '.'];
    const spondWords = spondAddr.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
    const localWords = localParts.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));

    // If at least 2 significant words match, consider it a match
    const matchingWords = spondWords.filter(w => localWords.some(lw => lw.includes(w) || w.includes(lw)));
    if (matchingWords.length >= 2) {
      return true;
    }

    // Also check if one contains the other
    if (spondAddr.includes(localParts) || localParts.includes(spondAddr)) {
      return true;
    }
  }

  return false;
}

/**
 * Find a potential duplicate local event based on date/time and location
 */
async function findPotentialDuplicate(
  pool: sql.ConnectionPool,
  spondEvent: SpondEvent
): Promise<{ id: number } | null> {
  try {
    const startTime = new Date(spondEvent.startTimestamp);
    
    // Define time window for matching (within 15 minutes)
    const timeWindowMinutes = 15;
    const minTime = new Date(startTime.getTime() - timeWindowMinutes * 60 * 1000);
    const maxTime = new Date(startTime.getTime() + timeWindowMinutes * 60 * 1000);

    // Find local events in the same time window that don't have a spond_id
    const potentialMatches = await pool.request()
      .input('min_time', sql.DateTime, minTime)
      .input('max_time', sql.DateTime, maxTime)
      .query(`
        SELECT 
          e.id,
          e.start_time,
          e.end_time,
          e.description,
          e.event_type,
          s.address as site_address,
          s.name as site_name,
          s.latitude,
          s.longitude,
          f.name as field_name
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.spond_id IS NULL
          AND e.start_time BETWEEN @min_time AND @max_time
      `);

    if (potentialMatches.recordset.length === 0) {
      return null;
    }

    // Check each potential match for location similarity
    for (const localEvent of potentialMatches.recordset) {
      const locationMatch = isApproximateLocationMatch(spondEvent.location, localEvent);
      
      if (locationMatch) {
        console.log(`[Spond Sync] Found potential duplicate: local event ${localEvent.id} matches Spond event ${spondEvent.id} (${spondEvent.heading})`);
        return { id: localEvent.id };
      }
    }

    return null;
  } catch (error) {
    console.error('[Spond Sync] Error finding potential duplicate:', error);
    return null;
  }
}

/**
 * Determine sport type from group name and activity
 */
function determineSport(name: string, activity?: string): string {
  const combined = `${name} ${activity || ''}`.toLowerCase();
  
  if (combined.includes('flag')) {
    return 'Flag Football';
  }
  if (combined.includes('tackle') || combined.includes('football') || combined.includes('american')) {
    return 'Tackle Football';
  }
  
  // Default to Tackle Football for the Renegades
  return 'Tackle Football';
}

/**
 * Get sync status and last sync time
 */
export async function getSyncStatus(): Promise<{
  lastSync: Date | null;
  isConfigured: boolean;
  groupCount: number;
  eventCount: number;
}> {
  try {
    const pool = await getPool();
    
    // Check for Spond configuration
    const configResult = await pool.request()
      .query(`
        SELECT TOP 1 * FROM spond_config WHERE is_active = 1
      `);
    
    const isConfigured = configResult.recordset.length > 0;
    
    // Get counts of synced items
    const groupCount = await pool.request()
      .query('SELECT COUNT(*) as count FROM teams WHERE spond_group_id IS NOT NULL');
    
    const eventCount = await pool.request()
      .query('SELECT COUNT(*) as count FROM events WHERE spond_id IS NOT NULL');
    
    // Get last sync time
    const lastSyncResult = await pool.request()
      .query(`
        SELECT TOP 1 last_sync FROM spond_config WHERE is_active = 1
      `);

    return {
      lastSync: lastSyncResult.recordset[0]?.last_sync || null,
      isConfigured,
      groupCount: groupCount.recordset[0]?.count || 0,
      eventCount: eventCount.recordset[0]?.count || 0,
    };
  } catch (error) {
    console.error('[Spond] Error getting sync status:', error);
    return {
      lastSync: null,
      isConfigured: false,
      groupCount: 0,
      eventCount: 0,
    };
  }
}

/**
 * Full sync - import all data from Spond
 */
export async function fullSync(
  client: SpondClient,
  options: {
    syncGroups?: boolean;
    syncEvents?: boolean;
    daysAhead?: number;
  } = {}
): Promise<{
  groups: SyncResult | null;
  events: SyncResult | null;
}> {
  const results: {
    groups: SyncResult | null;
    events: SyncResult | null;
  } = {
    groups: null,
    events: null,
  };

  if (options.syncGroups !== false) {
    results.groups = await importGroupsFromSpond(client);
  }

  if (options.syncEvents !== false) {
    results.events = await importEventsFromSpond(client, {
      daysAhead: options.daysAhead || 60,
    });
  }

  // Update last sync time
  try {
    const pool = await getPool();
    await pool.request()
      .input('last_sync', sql.DateTime, new Date())
      .query(`
        UPDATE spond_config SET last_sync = @last_sync WHERE is_active = 1
      `);
  } catch (error) {
    console.error('[Spond] Error updating last sync time:', error);
  }

  return results;
}

/**
 * Sync attendance for a single event from Spond
 */
export async function syncEventAttendance(
  client: SpondClient,
  eventId: number
): Promise<{ success: boolean; attendance?: any; error?: string }> {
  try {
    const pool = await getPool();
    
    // Get the local event with its Spond ID
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query('SELECT id, spond_id FROM events WHERE id = @id');

    if (eventResult.recordset.length === 0) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.recordset[0];
    
    if (!event.spond_id) {
      return { success: false, error: 'Event is not linked to Spond' };
    }

    // Fetch attendance from Spond
    const attendance = await client.getEventAttendance(event.spond_id);

    // Calculate estimated attendance as accepted + waiting (tentatives)
    const estimatedAttendance = (attendance.counts.accepted || 0) + (attendance.counts.waiting || 0);
    
    console.log(`[Spond] Attendance for event ${eventId}: ${attendance.counts.accepted} accepted, ${attendance.counts.waiting} waiting/tentative = ${estimatedAttendance} estimated`);

    // Update the event with attendance counts AND estimated_attendance
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('attendance_accepted', sql.Int, attendance.counts.accepted)
      .input('attendance_declined', sql.Int, attendance.counts.declined)
      .input('attendance_unanswered', sql.Int, attendance.counts.unanswered)
      .input('attendance_waiting', sql.Int, attendance.counts.waiting)
      .input('attendance_data', sql.NVarChar, JSON.stringify(attendance))
      .input('attendance_last_sync', sql.DateTime, new Date())
      .input('estimated_attendance', sql.Int, estimatedAttendance)
      .query(`
        UPDATE events SET
          attendance_accepted = @attendance_accepted,
          attendance_declined = @attendance_declined,
          attendance_unanswered = @attendance_unanswered,
          attendance_waiting = @attendance_waiting,
          attendance_data = @attendance_data,
          attendance_last_sync = @attendance_last_sync,
          estimated_attendance = @estimated_attendance,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    // Upsert individual participant records
    const allResponses = [
      ...attendance.accepted.map(m => ({ ...m, response: 'accepted' })),
      ...attendance.declined.map(m => ({ ...m, response: 'declined' })),
      ...attendance.unanswered.map(m => ({ ...m, response: 'unanswered' })),
      ...attendance.waiting.map(m => ({ ...m, response: 'waiting' })),
      ...attendance.unconfirmed.map(m => ({ ...m, response: 'unconfirmed' })),
    ];

    for (const participant of allResponses) {
      try {
        // Use MERGE for upsert behavior
        await pool.request()
          .input('event_id', sql.Int, eventId)
          .input('spond_member_id', sql.NVarChar, participant.id)
          .input('first_name', sql.NVarChar, participant.firstName || '')
          .input('last_name', sql.NVarChar, participant.lastName || '')
          .input('email', sql.NVarChar, participant.email || null)
          .input('response', sql.NVarChar, participant.response)
          .query(`
            MERGE event_participants AS target
            USING (SELECT @event_id as event_id, @spond_member_id as spond_member_id) AS source
            ON target.event_id = source.event_id AND target.spond_member_id = source.spond_member_id
            WHEN MATCHED THEN
              UPDATE SET 
                first_name = @first_name,
                last_name = @last_name,
                email = @email,
                response = @response,
                updated_at = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (event_id, spond_member_id, first_name, last_name, email, response)
              VALUES (@event_id, @spond_member_id, @first_name, @last_name, @email, @response);
          `);
      } catch (participantError) {
        console.error(`[Spond] Error upserting participant ${participant.id}:`, participantError);
      }
    }

    console.log(`[Spond] Synced attendance for event ${eventId}: ${attendance.counts.accepted} accepted, ${attendance.counts.declined} declined`);

    return { 
      success: true, 
      attendance: {
        counts: attendance.counts,
        syncedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Spond] Error syncing attendance:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Sync attendance for all Spond-linked events
 */
export async function syncAllAttendance(
  client: SpondClient,
  options: {
    onlyFutureEvents?: boolean;
    daysAhead?: number;
    daysBehind?: number;
  } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    message: '',
    imported: 0,
    updated: 0,
    linked: 0,
    errors: [],
  };

  try {
    const pool = await getPool();
    
    // Build date filter
    const now = new Date();
    let dateFilter = '';
    
    if (options.onlyFutureEvents) {
      dateFilter = 'AND e.start_time >= GETDATE()';
    } else {
      const minDate = new Date(now);
      minDate.setDate(minDate.getDate() - (options.daysBehind || 7));
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + (options.daysAhead || 30));
      dateFilter = `AND e.start_time BETWEEN '${minDate.toISOString()}' AND '${maxDate.toISOString()}'`;
    }

    // Get all events with Spond IDs
    const eventsResult = await pool.request()
      .query(`
        SELECT id, spond_id 
        FROM events e 
        WHERE spond_id IS NOT NULL ${dateFilter}
      `);

    console.log(`[Spond] Syncing attendance for ${eventsResult.recordset.length} events`);

    for (const event of eventsResult.recordset) {
      try {
        const syncResult = await syncEventAttendance(client, event.id);
        if (syncResult.success) {
          result.updated++;
        } else {
          result.errors.push(`Event ${event.id}: ${syncResult.error}`);
        }
      } catch (eventError) {
        result.errors.push(`Event ${event.id}: ${(eventError as Error).message}`);
      }
    }

    result.message = `Attendance sync completed: ${result.updated} events updated`;
    console.log(`[Spond Sync] ${result.message}`);
  } catch (error) {
    result.success = false;
    result.message = `Attendance sync failed: ${(error as Error).message}`;
    result.errors.push((error as Error).message);
  }

  return result;
}

/**
 * Export a local event to Spond (create new event in Spond)
 */
export async function pushEventToSpond(
  client: SpondClient,
  eventId: number,
  options: {
    spondGroupId?: string;
    sendInvites?: boolean;
  } = {}
): Promise<{ success: boolean; spondEventId?: string; error?: string }> {
  try {
    const pool = await getPool();
    
    // Get the local event with related data and sync settings
    // Use team_ids (comma-separated) and find the first matching team with a spond_group_id
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query(`
        SELECT 
          e.*,
          t.name as team_name,
          t.spond_group_id as team_spond_group_id,
          ss.spond_parent_group_id,
          ss.is_subgroup,
          f.name as field_name,
          s.name as site_name,
          s.address as site_address,
          s.latitude,
          s.longitude
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 id, name, spond_group_id 
          FROM teams 
          WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
        ) t
        LEFT JOIN spond_sync_settings ss ON t.id = ss.team_id
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.id = @id
      `);

    if (eventResult.recordset.length === 0) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.recordset[0];
    
    // Check if already exported
    if (event.spond_id) {
      return { success: false, error: 'Event is already linked to Spond. Use sync to update.' };
    }

    // Determine which Spond group to use
    const targetGroupId = options.spondGroupId || event.team_spond_group_id;
    
    if (!targetGroupId) {
      return { success: false, error: 'No Spond group specified. Link the team to a Spond group first, or specify spondGroupId.' };
    }

    // Determine the correct parent group and subgroup for Spond API
    let recipientGroupId = targetGroupId;
    let subgroupIds: string[] | undefined;

    if (event.is_subgroup && event.spond_parent_group_id) {
      recipientGroupId = event.spond_parent_group_id;
      subgroupIds = [targetGroupId];
      console.log(`[Spond] Event ${eventId}: Using parent group ${recipientGroupId} with subgroup ${targetGroupId}`);
    }

    // Normalize UUIDs to ensure proper format
    const normalizedRecipientGroupId = normalizeSpondUUID(recipientGroupId);
    const normalizedSubgroupIds = subgroupIds?.map(id => normalizeSpondUUID(id)).filter((id): id is string => id !== null);

    if (!normalizedRecipientGroupId) {
      return { success: false, error: `Invalid Spond group ID format: ${recipientGroupId}` };
    }

    console.log(`[Spond] Event ${eventId}: Sending to group ${normalizedRecipientGroupId}${normalizedSubgroupIds?.length ? ` with subgroups: ${normalizedSubgroupIds.join(', ')}` : ''}`);

    // Build event heading from type and team
    const heading = buildEventHeading(event);
    
    // Build description
    const description = buildEventDescription(event);

    // Create the event in Spond
    const spondEvent = await client.createEvent(normalizedRecipientGroupId, {
      heading,
      description,
      startTimestamp: new Date(event.start_time),
      endTimestamp: new Date(event.end_time),
      type: event.event_type === 'Game' ? 'MATCH' : 'EVENT',
      subgroupIds: normalizedSubgroupIds,
      location: event.site_address ? {
        address: `${event.site_name || ''} - ${event.field_name || ''}\n${event.site_address}`.trim(),
        latitude: event.latitude,
        longitude: event.longitude,
      } : undefined,
      autoAccept: false,
      inviteTime: options.sendInvites ? new Date() : undefined,
    });

    // Update local event with Spond ID (store normalized group ID)
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('spond_id', sql.NVarChar, spondEvent.id)
      .input('spond_group_id', sql.NVarChar, normalizedRecipientGroupId)
      .input('spond_data', sql.NVarChar, JSON.stringify(spondEvent))
      .query(`
        UPDATE events SET
          spond_id = @spond_id,
          spond_group_id = @spond_group_id,
          spond_data = @spond_data,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    console.log(`[Spond] Exported event ${eventId} to Spond as ${spondEvent.id}`);

    return { success: true, spondEventId: spondEvent.id };
  } catch (error) {
    console.error('[Spond] Error exporting event:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Update an existing event in Spond from local changes
 */
export async function updateEventInSpond(
  client: SpondClient,
  eventId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const pool = await getPool();
    
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query(`
        SELECT 
          e.*,
          t.name as team_name,
          f.name as field_name,
          s.name as site_name,
          s.address as site_address,
          s.latitude,
          s.longitude
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 id, name 
          FROM teams 
          WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
        ) t
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.id = @id
      `);

    if (eventResult.recordset.length === 0) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.recordset[0];
    
    if (!event.spond_id) {
      return { success: false, error: 'Event is not linked to Spond' };
    }

    // Update the event in Spond
    await client.updateEvent(event.spond_id, {
      heading: buildEventHeading(event),
      description: buildEventDescription(event),
      startTimestamp: new Date(event.start_time),
      endTimestamp: new Date(event.end_time),
      cancelled: event.status === 'Cancelled',
      location: event.site_address ? {
        address: `${event.site_name || ''} - ${event.field_name || ''}\n${event.site_address}`.trim(),
        latitude: event.latitude,
        longitude: event.longitude,
      } : undefined,
    });

    console.log(`[Spond] Updated event ${eventId} in Spond`);
    return { success: true };
  } catch (error) {
    console.error('[Spond] Error updating event in Spond:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Build event heading for Spond
 */
function buildEventHeading(event: any): string {
  const parts = [];
  
  if (event.event_type) {
    parts.push(event.event_type);
  }
  
  if (event.team_name) {
    parts.push(`- ${event.team_name}`);
  }
  
  return parts.join(' ') || 'Event';
}

/**
 * Build event description for Spond
 */
function buildEventDescription(event: any): string {
  const lines = [];
  
  if (event.description) {
    lines.push(event.description);
    lines.push('');
  }
  
  if (event.field_name || event.site_name) {
    lines.push(`📍 ${event.field_name || ''} at ${event.site_name || ''}`);
  }
  
  if (event.status) {
    lines.push(`Status: ${event.status}`);
  }
  
  return lines.join('\n');
}
