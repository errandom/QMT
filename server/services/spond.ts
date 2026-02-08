/**
 * Spond Integration API Routes
 * 
 * Provides endpoints for:
 * - Configuring Spond credentials
 * - Testing connection
 * - Triggering sync operations
 * - Managing group/team mappings
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';
import { 
  SpondClient, 
  initializeSpondClient, 
  getSpondClient, 
  clearSpondClient 
} from '../services/spond.js';
import {
  importEventsFromSpond,
  importGroupsFromSpond,
  exportEventToSpond,
  fullSync,
  getSyncStatus,
  syncEventAttendance,
  syncAllAttendance,
  pushEventToSpond,
  updateEventInSpond,
} from '../services/spondSync.js';

const router = Router();

/**
 * Normalize Spond UUID to the format Spond API expects (no hyphens, uppercase)
 * This ensures consistent storage and lookup of Spond IDs
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

/**
 * GET /api/spond/status
 * Get current Spond integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getSyncStatus();
    
    // Check if credentials are configured
    const pool = await getPool();
    const configResult = await pool.request()
      .query('SELECT id, created_at, last_sync FROM spond_config WHERE is_active = 1');
    
    const isConfigured = configResult.recordset.length > 0;
    const client = getSpondClient();

    res.json({
      configured: isConfigured,
      connected: client !== null,
      lastSync: status.lastSync,
      syncedGroups: status.groupCount,
      syncedEvents: status.eventCount,
    });
  } catch (error) {
    console.error('[Spond] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get Spond status' });
  }
});

/**
 * POST /api/spond/configure
 * Configure Spond credentials
 */
router.post('/configure', async (req: Request, res: Response) => {
  try {
    const { username, password, autoSync, syncIntervalMinutes } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Test the credentials first
    const testClient = new SpondClient({ username, password });
    const testResult = await testClient.testConnection();

    if (!testResult.success) {
      return res.status(401).json({ 
        error: 'Invalid credentials', 
        details: testResult.message 
      });
    }

    // Store credentials securely
    const pool = await getPool();
    
    // Deactivate any existing config
    await pool.request()
      .query('UPDATE spond_config SET is_active = 0 WHERE is_active = 1');
    
    // Insert new config
    await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, password) // TODO: Encrypt this
      .input('auto_sync', sql.Bit, autoSync || false)
      .input('sync_interval', sql.Int, syncIntervalMinutes || 60)
      .input('is_active', sql.Bit, true)
      .query(`
        INSERT INTO spond_config (username, password, auto_sync, sync_interval_minutes, is_active)
        VALUES (@username, @password, @auto_sync, @sync_interval, @is_active)
      `);

    // Initialize the client
    initializeSpondClient({ username, password });

    res.json({ 
      success: true, 
      message: 'Spond configured successfully',
      groupCount: testResult.groupCount,
    });
  } catch (error) {
    console.error('[Spond] Configuration error:', error);
    res.status(500).json({ error: 'Failed to configure Spond' });
  }
});

/**
 * DELETE /api/spond/configure
 * Remove Spond configuration
 */
router.delete('/configure', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    await pool.request()
      .query('UPDATE spond_config SET is_active = 0 WHERE is_active = 1');
    
    clearSpondClient();
    
    res.json({ success: true, message: 'Spond configuration removed' });
  } catch (error) {
    console.error('[Spond] Error removing configuration:', error);
    res.status(500).json({ error: 'Failed to remove Spond configuration' });
  }
});

/**
 * POST /api/spond/test
 * Test Spond connection with provided credentials
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const testClient = new SpondClient({ username, password });
    const result = await testClient.testConnection();

    res.json(result);
  } catch (error) {
    console.error('[Spond] Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Connection test failed: ${(error as Error).message}` 
    });
  }
});

/**
 * GET /api/spond/groups
 * Get all Spond groups with their subgroups (teams)
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const groups = await client.getGroups();
    
    // Get local team mappings
    const pool = await getPool();
    const mappings = await pool.request()
      .query('SELECT id, name, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    
    const mappingMap = new Map(
      mappings.recordset.map(m => [m.spond_group_id, { id: m.id, name: m.name }])
    );

    // Flatten groups and subgroups - return both groups and subgroups as linkable items
    const allGroupsWithMappings: any[] = [];
    
    for (const group of groups) {
      // Always add the parent group first
      allGroupsWithMappings.push({
        id: group.id,
        name: group.name,
        parentGroup: null,
        activity: group.activity,
        memberCount: group.members?.length || 0,
        linkedTeam: mappingMap.get(group.id) || null,
        isParentGroup: true,
        hasSubgroups: group.subGroups && group.subGroups.length > 0,
      });
      
      // Then add all subgroups if they exist
      if (group.subGroups && group.subGroups.length > 0) {
        for (const subgroup of group.subGroups) {
          allGroupsWithMappings.push({
            id: subgroup.id,
            name: subgroup.name,
            parentGroup: group.name,
            parentGroupId: group.id,
            activity: group.activity,
            memberCount: subgroup.members?.length || 0,
            linkedTeam: mappingMap.get(subgroup.id) || null,
            isParentGroup: false,
            hasSubgroups: false,
          });
        }
      }
    }

    res.json(allGroupsWithMappings);
  } catch (error) {
    console.error('[Spond] Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch Spond groups' });
  }
});

/**
 * GET /api/spond/events-count
 * Get count of events available in Spond (used by setup wizard)
 */
router.get('/events-count', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const now = new Date();
    const minStart = new Date(now);
    minStart.setDate(minStart.getDate() - 7);
    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() + 60);

    const events = await client.getEvents({
      minStart,
      maxStart,
      maxEvents: 500,
    });

    res.json({ 
      count: events.length,
      message: `Found ${events.length} events in Spond`
    });
  } catch (error) {
    console.error('[Spond] Error fetching events count:', error);
    res.status(500).json({ error: 'Failed to fetch events count' });
  }
});

/**
 * GET /api/spond/events
 * Get Spond events with optional filtering
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { groupId, daysAhead, daysBehind } = req.query;
    
    const now = new Date();
    const minStart = new Date(now);
    minStart.setDate(minStart.getDate() - (Number(daysBehind) || 7));
    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() + (Number(daysAhead) || 30));

    const events = await client.getEvents({
      groupId: groupId as string,
      minStart,
      maxStart,
      maxEvents: 200,
    });

    res.json(events.map(event => ({
      id: event.id,
      heading: event.heading,
      description: event.description,
      type: event.type || event.spilesType,
      startTimestamp: event.startTimestamp,
      endTimestamp: event.endTimestamp,
      cancelled: event.cancelled,
      location: event.location,
      groupId: event.recipients?.group?.id,
      groupName: event.recipients?.group?.name,
    })));
  } catch (error) {
    console.error('[Spond] Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch Spond events' });
  }
});

/**
 * GET /api/spond/export-preview
 * Preview which events can be exported to Spond and why others cannot.
 * Includes fuzzy duplicate detection against existing Spond events to prevent double-posting.
 */
router.get('/export-preview', async (req: Request, res: Response) => {
  try {
    const { daysAhead = 60, daysBehind = 7 } = req.query;
    
    const pool = await getPool();
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - Number(daysBehind));
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + Number(daysAhead));

    // Fetch local events with team/location info
    const eventsResult = await pool.request()
      .input('minDate', sql.DateTime, minDate)
      .input('maxDate', sql.DateTime, maxDate)
      .query(`
        SELECT 
          e.id,
          e.description,
          e.event_type,
          e.start_time,
          e.end_time,
          e.spond_id,
          e.team_ids,
          t.id as team_table_id,
          t.name as team_name,
          t.spond_group_id,
          s.name as site_name,
          s.address as site_address,
          f.name as field_name
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 id, name, spond_group_id 
          FROM teams 
          WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
        ) t
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.start_time BETWEEN @minDate AND @maxDate
        ORDER BY e.start_time
      `);

    // Fetch Spond events for fuzzy duplicate detection if client is available
    let spondEvents: any[] = [];
    try {
      const client = await ensureClient();
      if (client) {
        spondEvents = await client.getEvents({
          minStart: minDate,
          maxStart: maxDate,
          maxEvents: 500,
        });
      }
    } catch (spondError) {
      console.warn('[Spond] Could not fetch Spond events for export duplicate check:', spondError);
    }

    // Helper: fuzzy time match (within ±30 minutes)
    function isTimeClose(localTime: Date, spondTime: string): boolean {
      const localMs = new Date(localTime).getTime();
      const spondMs = new Date(spondTime).getTime();
      return Math.abs(localMs - spondMs) <= 30 * 60 * 1000;
    }

    // Helper: fuzzy location match for export
    function locationSimilar(localEvt: any, spondEvt: any): boolean {
      const spondLoc = spondEvt.location;
      if (!spondLoc) return true;
      const spondAddr = (spondLoc.address || spondLoc.feature || '').toLowerCase().trim();
      if (!spondAddr) return true;
      const localParts = [localEvt.site_address || '', localEvt.site_name || '', localEvt.field_name || '']
        .join(' ').toLowerCase().trim();
      if (!localParts) return false;
      const stopWords = new Set(['the', 'at', 'of', 'in', 'and', 'or', 'a', 'an']);
      const spondWords = spondAddr.split(/[\s,.-]+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      const localWords = localParts.split(/[\s,.-]+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      const matching = spondWords.filter((w: string) => localWords.some((lw: string) => lw.includes(w) || w.includes(lw)));
      return matching.length >= 2 || localParts.includes(spondAddr) || spondAddr.includes(localParts);
    }

    // Build team spond_group_id lookup for team matching
    const teamGroupMap = new Map<string, string>(); // team spond_group_id -> normalized
    for (const evt of eventsResult.recordset) {
      if (evt.spond_group_id) {
        const norm = normalizeSpondUUID(evt.spond_group_id);
        if (norm) teamGroupMap.set(evt.spond_group_id, norm);
      }
    }

    const events = eventsResult.recordset.map((evt: any) => {
      const issues: string[] = [];
      let canExport = true;
      
      if (evt.spond_id) {
        issues.push('Already exported to Spond');
        canExport = false;
      }
      if (!evt.team_ids || evt.team_ids.trim() === '') {
        issues.push('No team assigned to event');
        canExport = false;
      }
      if (evt.team_ids && evt.team_ids.trim() !== '' && !evt.spond_group_id) {
        issues.push('Team is not linked to a Spond group');
        canExport = false;
      }

      // Fuzzy duplicate detection against existing Spond events
      let spondMatch: {
        spondId: string;
        spondHeading: string;
        spondStartTime: string;
        spondLocation: string | null;
        spondGroupName: string | null;
        matchScore: number;
        matchReasons: string[];
      } | null = null;

      if (canExport && spondEvents.length > 0) {
        let bestScore = 0;
        let bestSpond: any = null;
        let bestReasons: string[] = [];

        const evtTeamGroupNorm = evt.spond_group_id ? normalizeSpondUUID(evt.spond_group_id) : null;

        for (const se of spondEvents) {
          let score = 0;
          const reasons: string[] = [];

          // Time match: +40
          if (isTimeClose(evt.start_time, se.startTimestamp)) {
            score += 40;
            reasons.push('Similar time');
          }

          // Team/group match: +30
          const seGroupId = se.recipients?.group?.id ? normalizeSpondUUID(se.recipients.group.id) : null;
          if (evtTeamGroupNorm && seGroupId && evtTeamGroupNorm === seGroupId) {
            score += 30;
            reasons.push('Same team/group');
          }

          // Location match: +20
          if (locationSimilar(evt, se)) {
            score += 20;
            reasons.push('Similar location');
          }

          // Event type match: +10
          const seHeading = se.heading?.toLowerCase() || '';
          let seType = 'Other';
          if (seHeading.includes('practice') || seHeading.includes('training')) seType = 'Practice';
          else if (seHeading.includes('game') || seHeading.includes('match')) seType = 'Game';
          else if (seHeading.includes('meeting')) seType = 'Meeting';
          if (evt.event_type === seType) {
            score += 10;
            reasons.push('Same event type');
          }

          if (score >= 50 && score > bestScore) {
            bestScore = score;
            bestSpond = se;
            bestReasons = reasons;
          }
        }

        if (bestSpond) {
          spondMatch = {
            spondId: bestSpond.id,
            spondHeading: bestSpond.heading,
            spondStartTime: bestSpond.startTimestamp,
            spondLocation: bestSpond.location?.feature || bestSpond.location?.address || null,
            spondGroupName: bestSpond.recipients?.group?.name || null,
            matchScore: bestScore,
            matchReasons: bestReasons,
          };
          issues.push(`Possible duplicate of Spond event "${bestSpond.heading}" (${bestScore}% confidence)`);
        }
      }
      
      return {
        id: evt.id,
        description: evt.description?.split('\n')[0]?.substring(0, 80) || 'Untitled',
        eventType: evt.event_type,
        startTime: evt.start_time,
        endTime: evt.end_time,
        teamName: evt.team_name || null,
        location: evt.site_name || evt.field_name || null,
        spondId: evt.spond_id || null,
        spondGroupId: evt.spond_group_id || null,
        canExport,
        spondMatch,
        issues,
      };
    });
    
    const summary = {
      totalEvents: events.length,
      canExport: events.filter((e: any) => e.canExport).length,
      alreadyExported: events.filter((e: any) => e.spondId).length,
      noTeam: events.filter((e: any) => !e.teamName).length,
      teamNotLinked: events.filter((e: any) => e.teamName && !e.spondGroupId).length,
      potentialDuplicates: events.filter((e: any) => !!e.spondMatch).length,
    };
    
    res.json({ summary, events });
  } catch (error) {
    console.error('[Spond] Error generating export preview:', error);
    res.status(500).json({ error: 'Failed to generate export preview' });
  }
});

/**
 * GET /api/spond/import-preview
 * Preview which events would be imported from Spond
 * Shows events from Spond with their mapping status, duplicate detection, etc.
 * Uses fuzzy matching on team, time (±30 min), and location to detect potential duplicates.
 */
router.get('/import-preview', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { daysAhead = 60, daysBehind = 7 } = req.query;

    // Calculate date range
    const now = new Date();
    const minStart = new Date(now);
    minStart.setDate(minStart.getDate() - Number(daysBehind));
    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() + Number(daysAhead));

    const pool = await getPool();

    // Build team mapping lookup (spond_group_id -> local team)
    const teamMappingResult = await pool.request()
      .query('SELECT id, name, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    const teamMapping = new Map<string, { id: number; name: string }>();
    for (const team of teamMappingResult.recordset) {
      const normalizedId = normalizeSpondUUID(team.spond_group_id);
      if (normalizedId) {
        teamMapping.set(normalizedId, { id: team.id, name: team.name });
      }
    }

    // Fetch events from Spond
    const spondEvents = await client.getEvents({
      minStart,
      maxStart,
      maxEvents: 500,
    });

    // Fetch ALL local events in a wider window for fuzzy matching
    const widerMin = new Date(minStart);
    widerMin.setDate(widerMin.getDate() - 1);
    const widerMax = new Date(maxStart);
    widerMax.setDate(widerMax.getDate() + 1);

    const localEventsResult = await pool.request()
      .input('minDate', sql.DateTime, widerMin)
      .input('maxDate', sql.DateTime, widerMax)
      .query(`
        SELECT 
          e.id,
          e.description,
          e.event_type,
          e.start_time,
          e.end_time,
          e.spond_id,
          e.team_id,
          e.team_ids,
          t.name as team_name,
          s.address as site_address,
          s.name as site_name,
          s.latitude,
          s.longitude,
          f.name as field_name
        FROM events e
        LEFT JOIN teams t ON e.team_id = t.id
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.start_time BETWEEN @minDate AND @maxDate
      `);

    const localEvents = localEventsResult.recordset;

    // Index local events by spond_id for exact matching
    const localBySpondId = new Map<string, any>();
    for (const le of localEvents) {
      if (le.spond_id) {
        localBySpondId.set(le.spond_id, le);
      }
    }

    // Helper: fuzzy time match (within ±30 minutes)
    function isTimeMatch(spondTime: string, localTime: Date): boolean {
      const spondMs = new Date(spondTime).getTime();
      const localMs = new Date(localTime).getTime();
      return Math.abs(spondMs - localMs) <= 30 * 60 * 1000;
    }

    // Helper: fuzzy location match (reuses logic from spondSync)
    function fuzzyLocationMatch(
      spondLoc: { address?: string; latitude?: number; longitude?: number; feature?: string } | undefined,
      localEvt: any
    ): boolean {
      if (!spondLoc) return true; // No spond location => no location constraint
      // Coordinate match (~500m)
      if (spondLoc.latitude && spondLoc.longitude && localEvt.latitude && localEvt.longitude) {
        const latDiff = Math.abs(spondLoc.latitude - localEvt.latitude);
        const lonDiff = Math.abs(spondLoc.longitude - localEvt.longitude);
        if (latDiff < 0.005 && lonDiff < 0.005) return true;
      }
      // Address text match
      const spondAddr = (spondLoc.address || spondLoc.feature || '').toLowerCase().trim();
      if (!spondAddr) return true; // No address text => skip
      const localParts = [localEvt.site_address || '', localEvt.site_name || '', localEvt.field_name || '']
        .join(' ').toLowerCase().trim();
      if (!localParts) return false; // Local has nothing to compare
      const stopWords = new Set(['the', 'at', 'of', 'in', 'and', 'or', 'a', 'an']);
      const spondWords = spondAddr.split(/[\s,.-]+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      const localWords = localParts.split(/[\s,.-]+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      const matching = spondWords.filter((w: string) => localWords.some((lw: string) => lw.includes(w) || w.includes(lw)));
      if (matching.length >= 2) return true;
      if (localParts.includes(spondAddr) || spondAddr.includes(localParts)) return true;
      return false;
    }

    // Helper: team match (spond group maps to same team)
    function isTeamMatch(spondGroupId: string | null, localEvt: any, mappedTeamId: number | null): boolean {
      if (!mappedTeamId) return false;
      // Check team_id directly
      if (localEvt.team_id === mappedTeamId) return true;
      // Check team_ids (comma separated)
      if (localEvt.team_ids) {
        const ids = localEvt.team_ids.split(',').map((id: string) => parseInt(id.trim()));
        if (ids.includes(mappedTeamId)) return true;
      }
      return false;
    }

    // Helper: compute match confidence score and reasons
    function computeMatchScore(
      spondEvt: any,
      localEvt: any,
      mappedTeamId: number | null
    ): { score: number; reasons: string[] } {
      let score = 0;
      const reasons: string[] = [];

      // Time: +40 points for within 30 min
      if (isTimeMatch(spondEvt.startTimestamp, localEvt.start_time)) {
        score += 40;
        reasons.push('Similar time');
      }

      // Team: +30 points
      if (mappedTeamId && isTeamMatch(null, localEvt, mappedTeamId)) {
        score += 30;
        reasons.push('Same team');
      }

      // Location: +20 points
      if (fuzzyLocationMatch(spondEvt.location, localEvt)) {
        score += 20;
        reasons.push('Similar location');
      }

      // Event type: +10 points if same type
      const headingLower = spondEvt.heading?.toLowerCase() || '';
      let spondType = 'Other';
      if (headingLower.includes('practice') || headingLower.includes('training')) spondType = 'Practice';
      else if (headingLower.includes('game') || headingLower.includes('match')) spondType = 'Game';
      else if (headingLower.includes('meeting')) spondType = 'Meeting';
      else {
        switch ((spondEvt.type || spondEvt.spilesType || '').toUpperCase()) {
          case 'MATCH': spondType = 'Game'; break;
          case 'TRAINING': case 'PRACTICE': spondType = 'Practice'; break;
          case 'MEETING': spondType = 'Meeting'; break;
        }
      }
      if (localEvt.event_type === spondType) {
        score += 10;
        reasons.push('Same event type');
      }

      return { score, reasons };
    }

    // Map events for preview with duplicate detection
    const events = spondEvents.map(evt => {
      const spondGroupId = evt.recipients?.group?.id || null;
      const normalizedGroupId = spondGroupId ? normalizeSpondUUID(spondGroupId) : null;
      const mappedTeam = normalizedGroupId ? teamMapping.get(normalizedGroupId) : null;

      // 1. Exact match by spond_id
      const exactMatch = localBySpondId.get(evt.id) || null;
      const alreadyExists = !!exactMatch;

      // 2. Fuzzy match: find best local event match for unlinked imports
      let fuzzyMatch: {
        localEventId: number;
        localDescription: string;
        localStartTime: string;
        localTeamName: string | null;
        localLocation: string | null;
        matchScore: number;
        matchReasons: string[];
      } | null = null;

      if (!alreadyExists) {
        let bestScore = 0;
        let bestLocal: any = null;
        let bestReasons: string[] = [];

        for (const le of localEvents) {
          // Skip events already linked to a Spond event
          if (le.spond_id) continue;
          const { score, reasons } = computeMatchScore(evt, le, mappedTeam?.id || null);
          // Need time match at minimum (score >= 40), plus at least one more signal
          if (score >= 50 && score > bestScore) {
            bestScore = score;
            bestLocal = le;
            bestReasons = reasons;
          }
        }

        if (bestLocal) {
          fuzzyMatch = {
            localEventId: bestLocal.id,
            localDescription: (bestLocal.description || 'Untitled').split('\n')[0].substring(0, 80),
            localStartTime: bestLocal.start_time?.toISOString?.() || String(bestLocal.start_time),
            localTeamName: bestLocal.team_name || null,
            localLocation: bestLocal.site_name || bestLocal.field_name || null,
            matchScore: bestScore,
            matchReasons: bestReasons,
          };
        }
      }

      // Determine event type
      const headingLower = evt.heading?.toLowerCase() || '';
      let eventType = 'Other';
      if (headingLower.includes('practice') || headingLower.includes('training')) {
        eventType = 'Practice';
      } else if (headingLower.includes('game') || headingLower.includes('match')) {
        eventType = 'Game';
      } else if (headingLower.includes('meeting')) {
        eventType = 'Meeting';
      } else {
        switch ((evt.type || evt.spilesType || '').toUpperCase()) {
          case 'MATCH': eventType = 'Game'; break;
          case 'TRAINING': case 'PRACTICE': eventType = 'Practice'; break;
          case 'MEETING': eventType = 'Meeting'; break;
        }
      }

      // Build status/issues
      const issues: string[] = [];
      if (alreadyExists) issues.push('Will update existing event');
      if (fuzzyMatch) issues.push(`Possible duplicate of local event #${fuzzyMatch.localEventId} (${fuzzyMatch.matchScore}% confidence)`);
      if (!mappedTeam && spondGroupId) issues.push('Spond group not linked to a local team');
      if (!spondGroupId) issues.push('No group assigned in Spond');

      // Attendance counts
      const accepted = evt.responses?.accepted?.length || 0;
      const declined = evt.responses?.declined?.length || 0;
      const unanswered = evt.responses?.unanswered?.length || 0;

      return {
        spondId: evt.id,
        heading: evt.heading,
        description: evt.description || null,
        eventType,
        startTime: evt.startTimestamp,
        endTime: evt.endTimestamp,
        location: evt.location?.feature || evt.location?.address || null,
        spondGroupName: evt.recipients?.group?.name || null,
        teamName: mappedTeam?.name || null,
        teamId: mappedTeam?.id || null,
        alreadyExists,
        existingLocalId: exactMatch?.id || null,
        fuzzyMatch,
        cancelled: evt.cancelled || false,
        attendance: { accepted, declined, unanswered },
        issues,
      };
    });

    // Sort by start time
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const summary = {
      totalEvents: events.length,
      newEvents: events.filter(e => !e.alreadyExists && !e.fuzzyMatch).length,
      existingEvents: events.filter(e => e.alreadyExists).length,
      potentialDuplicates: events.filter(e => !!e.fuzzyMatch).length,
      withTeam: events.filter(e => e.teamName).length,
      withoutTeam: events.filter(e => !e.teamName).length,
      cancelled: events.filter(e => e.cancelled).length,
      byType: {
        games: events.filter(e => e.eventType === 'Game').length,
        practices: events.filter(e => e.eventType === 'Practice').length,
        meetings: events.filter(e => e.eventType === 'Meeting').length,
        other: events.filter(e => e.eventType === 'Other').length,
      },
    };

    res.json({ summary, events });
  } catch (error) {
    console.error('[Spond] Error generating import preview:', error);
    res.status(500).json({ error: 'Failed to generate import preview' });
  }
});

/**
 * POST /api/spond/sync
 * Trigger a full sync from Spond
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { syncGroups, syncEvents, daysAhead } = req.body;

    const results = await fullSync(client, {
      syncGroups: syncGroups !== false,
      syncEvents: syncEvents !== false,
      daysAhead: daysAhead || 60,
    });

    res.json({
      success: true,
      groups: results.groups,
      events: results.events,
    });
  } catch (error) {
    console.error('[Spond] Sync error:', error);
    res.status(500).json({ error: 'Sync failed', details: (error as Error).message });
  }
});

/**
 * POST /api/spond/sync-with-settings
 * Trigger a sync with detailed settings from the sync wizard
 */
router.post('/sync-with-settings', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ 
        success: false, 
        error: 'Spond not configured. Please set up your Spond credentials first.' 
      });
    }

    const { 
      direction = 'import', 
      syncEvents = true, 
      syncAttendance = true,
      daysAhead = 60, 
      daysBehind = 7 
    } = req.body;

    console.log(`[Spond] Starting sync with settings: direction=${direction}, events=${syncEvents}, attendance=${syncAttendance}`);

    const syncResults = {
      success: true,
      imported: 0,
      exported: 0,
      attendanceUpdated: 0,
      eventsProcessed: 0,
      errors: [] as string[],
      details: {
        eventsImported: [] as string[],
        eventsExported: [] as string[],
        attendanceSynced: [] as string[],
      },
      exportDiagnostic: null as {
        totalInRange: number;
        eligible: number;
        alreadyExported: number;
        noTeam: number;
        teamNotLinked: number;
      } | null,
    };

    // Import events from Spond
    if (syncEvents && (direction === 'import' || direction === 'both')) {
      try {
        const importResult = await importEventsFromSpond(client, {
          daysAhead,
          daysBehind,
        });
        
        syncResults.imported = importResult.imported + importResult.updated;
        syncResults.eventsProcessed += importResult.imported + importResult.updated;
        
        if (importResult.imported > 0) {
          syncResults.details.eventsImported.push(`${importResult.imported} new events imported`);
        }
        if (importResult.updated > 0) {
          syncResults.details.eventsImported.push(`${importResult.updated} existing events updated`);
        }
        
        if (importResult.errors.length > 0) {
          syncResults.errors.push(...importResult.errors);
        }
        
        console.log(`[Spond] Events import: ${importResult.imported} imported, ${importResult.updated} updated`);
      } catch (importError) {
        syncResults.errors.push(`Event import failed: ${(importError as Error).message}`);
        console.error('[Spond] Event import error:', importError);
      }
    }

    // Sync attendance from Spond
    if (syncAttendance && (direction === 'import' || direction === 'both')) {
      try {
        const attendanceResult = await syncAllAttendance(client, {
          onlyFutureEvents: false,
          daysAhead,
          daysBehind,
        });
        
        syncResults.attendanceUpdated = attendanceResult.updated || 0;
        
        if (attendanceResult.updated > 0) {
          syncResults.details.attendanceSynced.push(`${attendanceResult.updated} event attendance records updated`);
        }
        
        if (attendanceResult.errors && attendanceResult.errors.length > 0) {
          syncResults.errors.push(...attendanceResult.errors);
        }
        
        console.log(`[Spond] Attendance sync: ${attendanceResult.updated} updated`);
      } catch (attendanceError) {
        syncResults.errors.push(`Attendance sync failed: ${(attendanceError as Error).message}`);
        console.error('[Spond] Attendance sync error:', attendanceError);
      }
    }

    // Export events to Spond (if direction is export or both)
    if (syncEvents && (direction === 'export' || direction === 'both')) {
      try {
        // Get local events that need to be exported (no spond_id yet, but have a team with spond_group_id)
        const pool = await getPool();
        const now = new Date();
        const minDate = new Date(now);
        minDate.setDate(minDate.getDate() - daysBehind);
        const maxDate = new Date(now);
        maxDate.setDate(maxDate.getDate() + daysAhead);
        
        console.log(`[Spond] Looking for events to export between ${minDate.toISOString()} and ${maxDate.toISOString()}`);
        
        // First, log diagnostic info about events that could potentially be exported
        const diagnosticQuery = await pool.request()
          .input('minDate', sql.DateTime, minDate)
          .input('maxDate', sql.DateTime, maxDate)
          .query(`
            SELECT 
              e.id,
              e.description,
              e.start_time,
              e.spond_id,
              e.team_ids,
              t.id as team_table_id,
              t.name as team_name,
              t.spond_group_id
            FROM events e
            OUTER APPLY (
              SELECT TOP 1 id, name, spond_group_id 
              FROM teams 
              WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
            ) t
            WHERE e.start_time BETWEEN @minDate AND @maxDate
          `);
        
        console.log(`[Spond] Found ${diagnosticQuery.recordset.length} events in date range`);
        
        // Compute diagnostic stats
        let alreadyExported = 0;
        let noTeam = 0;
        let teamNotLinked = 0;
        
        // Log why each event can or cannot be exported
        for (const evt of diagnosticQuery.recordset) {
          const reasons = [];
          if (evt.spond_id) {
            reasons.push('already has spond_id');
            alreadyExported++;
          }
          if (!evt.team_ids || evt.team_ids.trim() === '') {
            reasons.push('no team_ids assigned');
            noTeam++;
          }
          if (evt.team_ids && evt.team_ids.trim() !== '' && !evt.spond_group_id) {
            reasons.push('team has no spond_group_id');
            teamNotLinked++;
          }
          
          if (reasons.length > 0) {
            console.log(`[Spond] Event ${evt.id} (${evt.description?.substring(0, 30)}...) SKIPPED: ${reasons.join(', ')}`);
          } else {
            console.log(`[Spond] Event ${evt.id} (${evt.description?.substring(0, 30)}...) CAN BE EXPORTED to group ${evt.spond_group_id}`);
          }
        }
        
        const eventsToExport = await pool.request()
          .input('minDate', sql.DateTime, minDate)
          .input('maxDate', sql.DateTime, maxDate)
          .query(`
            SELECT e.id, e.description, t.spond_group_id
            FROM events e
            CROSS APPLY (
              SELECT TOP 1 id, spond_group_id 
              FROM teams 
              WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
                AND spond_group_id IS NOT NULL
            ) t
            WHERE e.spond_id IS NULL 
              AND e.team_ids IS NOT NULL 
              AND e.team_ids != ''
              AND e.start_time BETWEEN @minDate AND @maxDate
          `);
        
        console.log(`[Spond] ${eventsToExport.recordset.length} events eligible for export`);
        
        // Add diagnostic info to sync results
        syncResults.exportDiagnostic = {
          totalInRange: diagnosticQuery.recordset.length,
          eligible: eventsToExport.recordset.length,
          alreadyExported,
          noTeam,
          teamNotLinked,
        };
        
        for (const event of eventsToExport.recordset) {
          try {
            console.log(`[Spond] Exporting event ${event.id} to Spond group ${event.spond_group_id}...`);
            const exportResult = await exportEventToSpond(client, event.id, event.spond_group_id);
            if (exportResult.success) {
              syncResults.exported++;
              const eventName = event.description?.split('\n')[0] || `Event ${event.id}`;
              syncResults.details.eventsExported.push(eventName);
              console.log(`[Spond] Successfully exported event ${event.id} as Spond event ${exportResult.spondEventId}`);
            } else {
              console.log(`[Spond] Failed to export event ${event.id}: ${exportResult.error}`);
              syncResults.errors.push(`Event ${event.id}: ${exportResult.error}`);
            }
          } catch (exportError) {
            console.error(`[Spond] Exception exporting event ${event.id}:`, exportError);
            syncResults.errors.push(`Failed to export event ${event.id}: ${(exportError as Error).message}`);
          }
        }
        
        console.log(`[Spond] Events export complete: ${syncResults.exported} exported`);
      } catch (exportError) {
        syncResults.errors.push(`Event export failed: ${(exportError as Error).message}`);
        console.error('[Spond] Event export error:', exportError);
      }
    }

    // Update last sync time
    try {
      const pool = await getPool();
      await pool.request()
        .input('last_sync', sql.DateTime, new Date())
        .query('UPDATE spond_config SET last_sync = @last_sync WHERE is_active = 1');
    } catch (dbError) {
      console.error('[Spond] Error updating last sync time:', dbError);
    }

    // Determine overall success
    syncResults.success = syncResults.errors.length === 0 || 
      (syncResults.imported > 0 || syncResults.exported > 0 || syncResults.attendanceUpdated > 0);

    res.json(syncResults);
  } catch (error) {
    console.error('[Spond] Sync with settings error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sync failed', 
      details: (error as Error).message 
    });
  }
});

/**
 * POST /api/spond/sync/groups
 * Sync only groups from Spond
 */
router.post('/sync/groups', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const result = await importGroupsFromSpond(client);
    res.json(result);
  } catch (error) {
    console.error('[Spond] Groups sync error:', error);
    res.status(500).json({ error: 'Groups sync failed' });
  }
});

/**
 * POST /api/spond/sync/events
 * Sync only events from Spond
 */
router.post('/sync/events', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { groupId, daysAhead, daysBehind } = req.body;

    const result = await importEventsFromSpond(client, {
      groupId,
      daysAhead: daysAhead || 60,
      daysBehind: daysBehind || 7,
    });

    res.json(result);
  } catch (error) {
    console.error('[Spond] Events sync error:', error);
    res.status(500).json({ error: 'Events sync failed' });
  }
});

/**
 * POST /api/spond/export/event/:id
 * Export a local event to Spond
 */
router.post('/export/event/:id', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    const { spondGroupId } = req.body;

    if (!spondGroupId) {
      return res.status(400).json({ error: 'spondGroupId is required' });
    }

    const result = await exportEventToSpond(client, eventId, spondGroupId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[Spond] Export event error:', error);
    res.status(500).json({ error: 'Failed to export event' });
  }
});

/**
 * POST /api/spond/link/team
 * Link a local team to a Spond group (supports both parent groups and subgroups)
 * 
 * For subgroups, also accepts parentGroupId which is required for proper 
 * event export to Spond. The Spond API requires events to be created on 
 * the parent group with subgroup recipients specified.
 */
router.post('/link/team', async (req: Request, res: Response) => {
  try {
    const { teamId, spondGroupId, parentGroupId, groupName, parentGroupName } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    // Normalize Spond IDs to consistent format (uppercase, no hyphens)
    const normalizedGroupId = normalizeSpondUUID(spondGroupId);
    const normalizedParentGroupId = normalizeSpondUUID(parentGroupId);

    if (!normalizedGroupId) {
      return res.status(400).json({ error: 'Invalid spondGroupId format' });
    }

    const pool = await getPool();
    
    // Update the team's spond_group_id with normalized ID
    await pool.request()
      .input('id', sql.Int, teamId)
      .input('spond_group_id', sql.NVarChar, normalizedGroupId)
      .query('UPDATE teams SET spond_group_id = @spond_group_id WHERE id = @id');

    // Determine if this is a subgroup (has a parent group)
    const isSubgroup = !!normalizedParentGroupId;

    // Create or update sync settings with parent group info
    // This is required for proper export to Spond when using subgroups
    const existingSettings = await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT id FROM spond_sync_settings WHERE team_id = @team_id');

    if (existingSettings.recordset.length > 0) {
      // Update existing settings
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, normalizedGroupId)
        .input('spond_group_name', sql.NVarChar, groupName || null)
        .input('spond_parent_group_id', sql.NVarChar, normalizedParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, parentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup)
        .input('updated_at', sql.DateTime, new Date())
        .query(`
          UPDATE spond_sync_settings SET
            spond_group_id = @spond_group_id,
            spond_group_name = @spond_group_name,
            spond_parent_group_id = @spond_parent_group_id,
            spond_parent_group_name = @spond_parent_group_name,
            is_subgroup = @is_subgroup,
            updated_at = @updated_at
          WHERE team_id = @team_id
        `);
    } else {
      // Insert new settings
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, normalizedGroupId)
        .input('spond_group_name', sql.NVarChar, groupName || null)
        .input('spond_parent_group_id', sql.NVarChar, normalizedParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, parentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup)
        .query(`
          INSERT INTO spond_sync_settings (
            team_id, spond_group_id, spond_group_name, 
            spond_parent_group_id, spond_parent_group_name, 
            is_subgroup, sync_events_import, sync_attendance_import, is_active
          )
          VALUES (
            @team_id, @spond_group_id, @spond_group_name,
            @spond_parent_group_id, @spond_parent_group_name,
            @is_subgroup, 1, 1, 1
          )
        `);
    }

    const linkType = isSubgroup 
      ? `Team linked to Spond subgroup (parent: ${parentGroupName || parentGroupId})` 
      : 'Team linked to Spond group';
    
    console.log(`[Spond] ${linkType} - Team ${teamId} -> Group ${spondGroupId}${isSubgroup ? ` (parent: ${parentGroupId})` : ''}`);

    res.json({ 
      success: true, 
      message: linkType,
      isSubgroup,
      parentGroupId: parentGroupId || null
    });
  } catch (error) {
    console.error('[Spond] Link team error:', error);
    res.status(500).json({ error: 'Failed to link team' });
  }
});

/**
 * DELETE /api/spond/link/team/:id
 * Unlink a team from Spond
 */
router.delete('/link/team/:id', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id);

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, teamId)
      .query('UPDATE teams SET spond_group_id = NULL WHERE id = @id');

    res.json({ success: true, message: 'Team unlinked from Spond' });
  } catch (error) {
    console.error('[Spond] Unlink team error:', error);
    res.status(500).json({ error: 'Failed to unlink team' });
  }
});

// ============================================================
// EVENT EXPORT ENDPOINTS (Push to Spond)
// ============================================================

/**
 * POST /api/spond/push/event/:id
 * Push a local event to Spond (creates new event in Spond)
 */
router.post('/push/event/:id', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    const { spondGroupId, sendInvites } = req.body;

    const result = await pushEventToSpond(client, eventId, {
      spondGroupId,
      sendInvites: sendInvites || false,
    });
    
    if (result.success) {
      res.json({
        success: true,
        spondEventId: result.spondEventId,
        message: 'Event pushed to Spond successfully'
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[Spond] Push event error:', error);
    res.status(500).json({ error: 'Failed to push event to Spond' });
  }
});

/**
 * PUT /api/spond/push/event/:id
 * Update an existing event in Spond from local changes
 */
router.put('/push/event/:id', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    const result = await updateEventInSpond(client, eventId);
    
    if (result.success) {
      res.json({ success: true, message: 'Event updated in Spond' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[Spond] Update event in Spond error:', error);
    res.status(500).json({ error: 'Failed to update event in Spond' });
  }
});

/**
 * POST /api/spond/push/events
 * Push multiple local events to Spond
 */
router.post('/push/events', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { eventIds, spondGroupId, sendInvites } = req.body;
    
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'eventIds array is required' });
    }

    const results = {
      successCount: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as { eventId: number; spondEventId: string }[],
    };

    for (const eventId of eventIds) {
      const result = await pushEventToSpond(client, eventId, {
        spondGroupId,
        sendInvites: sendInvites || false,
      });
      
      if (result.success) {
        results.successCount++;
        results.created.push({ eventId, spondEventId: result.spondEventId! });
      } else {
        results.failed++;
        results.errors.push(`Event ${eventId}: ${result.error}`);
      }
    }

    res.json({
      success: results.failed === 0,
      message: `Pushed ${results.successCount} events, ${results.failed} failed`,
      ...results
    });
  } catch (error) {
    console.error('[Spond] Bulk push events error:', error);
    res.status(500).json({ error: 'Failed to push events to Spond' });
  }
});

// ============================================================
// ATTENDANCE ENDPOINTS (Pull from Spond)
// ============================================================

/**
 * GET /api/spond/attendance/event/:id
 * Get attendance for a single event from Spond
 */
router.get('/attendance/event/:id', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    
    // Get the event's Spond ID
    const pool = await getPool();
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query('SELECT spond_id FROM events WHERE id = @id');
    
    if (eventResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const spondId = eventResult.recordset[0].spond_id;
    if (!spondId) {
      return res.status(400).json({ error: 'Event is not linked to Spond' });
    }

    // Fetch fresh attendance from Spond
    const attendance = await client.getEventAttendance(spondId);
    
    res.json({
      eventId,
      spondId,
      attendance: {
        accepted: attendance.accepted,
        declined: attendance.declined,
        unanswered: attendance.unanswered,
        waiting: attendance.waiting,
        unconfirmed: attendance.unconfirmed,
        counts: attendance.counts,
      }
    });
  } catch (error) {
    console.error('[Spond] Get attendance error:', error);
    res.status(500).json({ error: 'Failed to get attendance from Spond' });
  }
});

/**
 * POST /api/spond/sync/attendance/event/:id
 * Sync attendance for a single event (saves to database)
 */
router.post('/sync/attendance/event/:id', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    const result = await syncEventAttendance(client, eventId);
    
    if (result.success) {
      res.json({
        success: true,
        eventId,
        attendance: result.attendance,
        message: 'Attendance synced successfully'
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[Spond] Sync attendance error:', error);
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
});

/**
 * POST /api/spond/sync/attendance
 * Sync attendance for all Spond-linked events
 */
router.post('/sync/attendance', async (req: Request, res: Response) => {
  try {
    const client = await ensureClient();
    if (!client) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { onlyFutureEvents, daysAhead, daysBehind } = req.body;
    
    const result = await syncAllAttendance(client, {
      onlyFutureEvents: onlyFutureEvents ?? true,
      daysAhead: daysAhead || 30,
      daysBehind: daysBehind || 7,
    });

    res.json({
      success: result.success,
      message: result.message,
      eventsUpdated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Spond] Sync all attendance error:', error);
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
});

/**
 * GET /api/spond/participants/event/:id
 * Get stored attendance participants for an event
 */
router.get('/participants/event/:id', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    
    const pool = await getPool();
    
    // Get event info
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query(`
        SELECT id, spond_id, attendance_accepted, attendance_declined, 
               attendance_unanswered, attendance_waiting, attendance_last_sync
        FROM events WHERE id = @id
      `);
    
    if (eventResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.recordset[0];
    
    // Get participants
    const participantsResult = await pool.request()
      .input('event_id', sql.Int, eventId)
      .query(`
        SELECT spond_member_id, first_name, last_name, email, response, 
               response_time, is_organizer, updated_at
        FROM event_participants
        WHERE event_id = @event_id
        ORDER BY response, last_name, first_name
      `);
    
    res.json({
      eventId,
      spondId: event.spond_id,
      counts: {
        accepted: event.attendance_accepted || 0,
        declined: event.attendance_declined || 0,
        unanswered: event.attendance_unanswered || 0,
        waiting: event.attendance_waiting || 0,
      },
      lastSync: event.attendance_last_sync,
      participants: participantsResult.recordset,
    });
  } catch (error) {
    console.error('[Spond] Get participants error:', error);
    res.status(500).json({ error: 'Failed to get participants' });
  }
});

/**
 * GET /api/spond/export-diagnostic
 * Diagnostic endpoint to check which events can be exported to Spond
 * This helps troubleshoot export issues
 */
router.get('/export-diagnostic', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const daysAhead = parseInt(req.query.daysAhead as string) || 60;
    const daysBehind = parseInt(req.query.daysBehind as string) || 7;
    
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - daysBehind);
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + daysAhead);
    
    // Get all events in date range with their export eligibility status
    const eventsQuery = await pool.request()
      .input('minDate', sql.DateTime, minDate)
      .input('maxDate', sql.DateTime, maxDate)
      .query(`
        SELECT 
          e.id,
          e.description,
          e.event_type,
          e.start_time,
          e.end_time,
          e.status,
          e.spond_id,
          e.spond_group_id as event_spond_group_id,
          e.team_ids,
          t.id as team_table_id,
          t.name as team_name,
          t.spond_group_id as team_spond_group_id
        FROM events e
        OUTER APPLY (
          SELECT TOP 1 id, name, spond_group_id 
          FROM teams 
          WHERE CHARINDEX(',' + CAST(id AS VARCHAR) + ',', ',' + e.team_ids + ',') > 0
        ) t
        WHERE e.start_time BETWEEN @minDate AND @maxDate
        ORDER BY e.start_time
      `);
    
    // Get all teams with their Spond linkage status
    const teamsQuery = await pool.request()
      .query(`
        SELECT id, name, spond_group_id
        FROM teams
        WHERE active = 1
        ORDER BY name
      `);
    
    // Analyze each event
    const events = eventsQuery.recordset.map(evt => {
      const issues: string[] = [];
      let canExport = true;
      
      if (evt.spond_id) {
        issues.push('Already exported to Spond (has spond_id)');
        canExport = false;
      }
      if (!evt.team_ids || evt.team_ids.trim() === '') {
        issues.push('No team assigned (team_ids is empty)');
        canExport = false;
      }
      if (evt.team_ids && evt.team_ids.trim() !== '' && !evt.team_spond_group_id) {
        issues.push('Team is not linked to a Spond group');
        canExport = false;
      }
      
      return {
        id: evt.id,
        description: evt.description?.substring(0, 100),
        eventType: evt.event_type,
        startTime: evt.start_time,
        status: evt.status,
        spondId: evt.spond_id,
        teamIds: evt.team_ids,
        teamName: evt.team_name,
        teamSpondGroupId: evt.team_spond_group_id,
        canExport,
        issues: issues.length > 0 ? issues : ['Ready to export'],
      };
    });
    
    const teams = teamsQuery.recordset.map(team => ({
      id: team.id,
      name: team.name,
      spondGroupId: team.spond_group_id,
      isLinked: !!team.spond_group_id,
    }));
    
    const summary = {
      dateRange: {
        from: minDate.toISOString(),
        to: maxDate.toISOString(),
      },
      totalEvents: events.length,
      exportableEvents: events.filter(e => e.canExport).length,
      alreadyExported: events.filter(e => e.spondId).length,
      noTeamAssigned: events.filter(e => !e.teamIds || e.teamIds.length === 0).length,
      teamNotLinked: events.filter(e => e.teamIds && e.teamIds.length > 0 && !e.teamSpondGroupId).length,
      totalTeams: teams.length,
      linkedTeams: teams.filter(t => t.isLinked).length,
      unlinkedTeams: teams.filter(t => !t.isLinked).length,
    };
    
    res.json({
      summary,
      events,
      teams,
    });
  } catch (error) {
    console.error('[Spond] Export diagnostic error:', error);
    res.status(500).json({ error: 'Failed to run export diagnostic' });
  }
});

/**
 * POST /api/spond/sync-settings
 * Create or update sync settings for a team
 */
router.post('/sync-settings', async (req: Request, res: Response) => {
  try {
    const { 
      teamId, 
      spondGroupId, 
      spondGroupName, 
      spondParentGroupId, 
      spondParentGroupName,
      isSubgroup,
      syncEventsImport,
      syncEventsExport,
      syncAttendanceImport,
      syncEventTitle,
      syncEventDescription,
      syncEventTime,
      syncEventLocation,
      syncEventType,
      isActive
    } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    const pool = await getPool();

    // Check if settings exist for this team
    const existing = await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT id FROM spond_sync_settings WHERE team_id = @team_id');

    if (existing.recordset.length > 0) {
      // Update existing settings
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, spondGroupId)
        .input('spond_group_name', sql.NVarChar, spondGroupName || null)
        .input('spond_parent_group_id', sql.NVarChar, spondParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup || false)
        .input('sync_events_import', sql.Bit, syncEventsImport !== false)
        .input('sync_events_export', sql.Bit, syncEventsExport || false)
        .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
        .input('sync_event_title', sql.Bit, syncEventTitle !== false)
        .input('sync_event_description', sql.Bit, syncEventDescription !== false)
        .input('sync_event_time', sql.Bit, syncEventTime !== false)
        .input('sync_event_location', sql.Bit, syncEventLocation !== false)
        .input('sync_event_type', sql.Bit, syncEventType !== false)
        .input('is_active', sql.Bit, isActive !== false)
        .input('updated_at', sql.DateTime, new Date())
        .query(`
          UPDATE spond_sync_settings SET
            spond_group_id = @spond_group_id,
            spond_group_name = @spond_group_name,
            spond_parent_group_id = @spond_parent_group_id,
            spond_parent_group_name = @spond_parent_group_name,
            is_subgroup = @is_subgroup,
            sync_events_import = @sync_events_import,
            sync_events_export = @sync_events_export,
            sync_attendance_import = @sync_attendance_import,
            sync_event_title = @sync_event_title,
            sync_event_description = @sync_event_description,
            sync_event_time = @sync_event_time,
            sync_event_location = @sync_event_location,
            sync_event_type = @sync_event_type,
            is_active = @is_active,
            updated_at = @updated_at
          WHERE team_id = @team_id
        `);
    } else {
      // Insert new settings
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, spondGroupId)
        .input('spond_group_name', sql.NVarChar, spondGroupName || null)
        .input('spond_parent_group_id', sql.NVarChar, spondParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup || false)
        .input('sync_events_import', sql.Bit, syncEventsImport !== false)
        .input('sync_events_export', sql.Bit, syncEventsExport || false)
        .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
        .input('sync_event_title', sql.Bit, syncEventTitle !== false)
        .input('sync_event_description', sql.Bit, syncEventDescription !== false)
        .input('sync_event_time', sql.Bit, syncEventTime !== false)
        .input('sync_event_location', sql.Bit, syncEventLocation !== false)
        .input('sync_event_type', sql.Bit, syncEventType !== false)
        .input('is_active', sql.Bit, isActive !== false)
        .query(`
          INSERT INTO spond_sync_settings (
            team_id, spond_group_id, spond_group_name, 
            spond_parent_group_id, spond_parent_group_name, 
            is_subgroup, sync_events_import, sync_events_export, 
            sync_attendance_import, sync_event_title, sync_event_description, 
            sync_event_time, sync_event_location, sync_event_type, is_active
          )
          VALUES (
            @team_id, @spond_group_id, @spond_group_name,
            @spond_parent_group_id, @spond_parent_group_name,
            @is_subgroup, @sync_events_import, @sync_events_export,
            @sync_attendance_import, @sync_event_title, @sync_event_description,
            @sync_event_time, @sync_event_location, @sync_event_type, @is_active
          )
        `);
    }

    console.log(`[Spond] Sync settings saved for team ${teamId}`);
    res.json({ success: true, message: 'Sync settings saved' });
  } catch (error) {
    console.error('[Spond] Sync settings error:', error);
    res.status(500).json({ error: 'Failed to save sync settings' });
  }
});

/**
 * DELETE /api/spond/sync-settings/:teamId
 * Delete sync settings for a team
 */
router.delete('/sync-settings/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);

    const pool = await getPool();
    await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('DELETE FROM spond_sync_settings WHERE team_id = @team_id');

    res.json({ success: true, message: 'Sync settings deleted' });
  } catch (error) {
    console.error('[Spond] Delete sync settings error:', error);
    res.status(500).json({ error: 'Failed to delete sync settings' });
  }
});

/**
 * Helper: Ensure Spond client is initialized
 */
async function ensureClient(): Promise<SpondClient | null> {
  let client = getSpondClient();
  
  if (!client) {
    // Try to load from database
    try {
      const pool = await getPool();
      const configResult = await pool.request()
        .query('SELECT username, password FROM spond_config WHERE is_active = 1');
      
      if (configResult.recordset.length > 0) {
        const { username, password } = configResult.recordset[0];
        client = initializeSpondClient({ username, password });
      }
    } catch (error) {
      console.error('[Spond] Error loading config:', error);
    }
  }
  
  return client;
}

export default router;
