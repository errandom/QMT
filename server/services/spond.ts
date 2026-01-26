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
 * Link a local team to a Spond group
 */
router.post('/link/team', async (req: Request, res: Response) => {
  try {
    const { teamId, spondGroupId } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, teamId)
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .query('UPDATE teams SET spond_group_id = @spond_group_id WHERE id = @id');

    res.json({ success: true, message: 'Team linked to Spond group' });
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
