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

export interface SyncResult {
  success: boolean;
  message: string;
  imported: number;
  updated: number;
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
    errors: [],
  };

  try {
    const pool = await getPool();
    
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

        const eventData = {
          spond_id: spondEvent.id,
          event_type: mapEventType(spondEvent.type || spondEvent.spilesType, spondEvent.heading),
          start_time: new Date(spondEvent.startTimestamp),
          end_time: new Date(spondEvent.endTimestamp),
          description: spondEvent.heading + (spondEvent.description ? `\n\n${spondEvent.description}` : ''),
          status: mapEventStatus(spondEvent),
          spond_group_id: spondEvent.recipients?.group?.id || null,
          spond_data: JSON.stringify(spondEvent),
        };

        if (existing.recordset.length > 0) {
          // Update existing event
          await pool.request()
            .input('id', sql.Int, existing.recordset[0].id)
            .input('event_type', sql.NVarChar, eventData.event_type)
            .input('start_time', sql.DateTime, eventData.start_time)
            .input('end_time', sql.DateTime, eventData.end_time)
            .input('description', sql.NVarChar, eventData.description)
            .input('status', sql.NVarChar, eventData.status)
            .input('spond_group_id', sql.NVarChar, eventData.spond_group_id)
            .input('spond_data', sql.NVarChar, eventData.spond_data)
            .input('updated_at', sql.DateTime, new Date())
            .query(`
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
          result.updated++;
        } else {
          // Insert new event
          await pool.request()
            .input('spond_id', sql.NVarChar, eventData.spond_id)
            .input('event_type', sql.NVarChar, eventData.event_type)
            .input('start_time', sql.DateTime, eventData.start_time)
            .input('end_time', sql.DateTime, eventData.end_time)
            .input('description', sql.NVarChar, eventData.description)
            .input('status', sql.NVarChar, eventData.status)
            .input('spond_group_id', sql.NVarChar, eventData.spond_group_id)
            .input('spond_data', sql.NVarChar, eventData.spond_data)
            .query(`
              INSERT INTO events (spond_id, event_type, start_time, end_time, description, status, spond_group_id, spond_data)
              VALUES (@spond_id, @event_type, @start_time, @end_time, @description, @status, @spond_group_id, @spond_data)
            `);
          result.imported++;
        }
      } catch (eventError) {
        result.errors.push(`Event ${spondEvent.id}: ${(eventError as Error).message}`);
      }
    }

    result.message = `Sync completed: ${result.imported} imported, ${result.updated} updated`;
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
    
    // Get the local event
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query(`
        SELECT e.*, t.spond_group_id as team_spond_group_id
        FROM events e
        LEFT JOIN teams t ON e.team_id = t.id
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

    // Create event in Spond
    const spondEvent = await client.createEvent(targetGroupId, {
      heading: event.description?.split('\n')[0] || `${event.event_type} Event`,
      description: event.description,
      startTimestamp: new Date(event.start_time),
      endTimestamp: new Date(event.end_time),
      type: event.event_type === 'Game' ? 'MATCH' : 'EVENT',
    });

    // Update local event with Spond ID
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('spond_id', sql.NVarChar, spondEvent.id)
      .input('spond_group_id', sql.NVarChar, targetGroupId)
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
