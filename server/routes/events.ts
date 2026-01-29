import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';
import { parseNaturalLanguageEvent, convertToApiEvents } from '../services/eventParser.js';

const router = Router();

// GET all events
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        e.*,
        f.name as field_name,
        s.name as site_name,
        s.address as site_address
      FROM events e
      LEFT JOIN fields f ON e.field_id = f.id
      LEFT JOIN sites s ON f.site_id = s.id
      ORDER BY e.start_time DESC
    `);
    console.log('[Events GET] Retrieved', result.recordset.length, 'events')
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET single event by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT 
          e.*,
          f.name as field_name,
          s.name as site_name,
          s.address as site_address
        FROM events e
        LEFT JOIN fields f ON e.field_id = f.id
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Helper function to generate recurring event dates
function generateRecurringDates(startDate: Date, endDate: Date, recurringDays: number[]): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  // Set to start of day to avoid time zone issues
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    // Get day of week (1=Monday, 7=Sunday)
    const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay(); // Convert Sunday from 0 to 7
    
    if (recurringDays.includes(dayOfWeek)) {
      dates.push(new Date(current));
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Helper function to check for field booking conflicts (only for Game events)
async function checkFieldConflict(
  pool: any,
  fieldId: number | null,
  eventType: string,
  startTime: Date,
  endTime: Date,
  excludeEventId?: number
): Promise<{ hasConflict: boolean; conflictingEvent?: any }> {
  // Only check conflicts for Game events
  if (eventType !== 'Game' || !fieldId) {
    return { hasConflict: false };
  }
  
  try {
    const query = `
      SELECT TOP 1 
        e.id, 
        e.description as title,
        e.start_time,
        e.end_time
      FROM events e
      WHERE e.field_id = @field_id
        AND e.event_type = 'Game'
        AND e.status != 'Cancelled'
        ${excludeEventId ? 'AND e.id != @exclude_event_id' : ''}
        AND (
          -- New event starts during existing event
          (@start_time >= e.start_time AND @start_time < e.end_time)
          OR
          -- New event ends during existing event
          (@end_time > e.start_time AND @end_time <= e.end_time)
          OR
          -- New event completely encompasses existing event
          (@start_time <= e.start_time AND @end_time >= e.end_time)
        )
    `;
    
    const request = pool.request()
      .input('field_id', sql.Int, fieldId)
      .input('start_time', sql.DateTime, startTime)
      .input('end_time', sql.DateTime, endTime);
    
    if (excludeEventId) {
      request.input('exclude_event_id', sql.Int, excludeEventId);
    }
    
    const result = await request.query(query);
    
    if (result.recordset.length > 0) {
      return {
        hasConflict: true,
        conflictingEvent: result.recordset[0]
      };
    }
    
    return { hasConflict: false };
  } catch (error) {
    console.error('[checkFieldConflict] Error checking conflict:', error);
    // In case of error, allow the booking (fail open)
    return { hasConflict: false };
  }
}

// ============================================================
// NATURAL LANGUAGE EVENT PARSING
// ============================================================

/**
 * POST /api/events/parse
 * Parse natural language input into structured event data
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input text is required' });
    }

    console.log('[Events] Parsing natural language input:', input.substring(0, 100));

    // Get teams, sites, fields for context
    const pool = await getPool();
    
    const [teamsResult, sitesResult, fieldsResult] = await Promise.all([
      pool.request().query('SELECT id, name FROM teams WHERE active = 1'),
      pool.request().query('SELECT id, name FROM sites'),
      pool.request().query('SELECT id, name, site_id FROM fields'),
    ]);

    const context = {
      teams: teamsResult.recordset,
      sites: sitesResult.recordset,
      fields: fieldsResult.recordset,
      currentDate: new Date().toISOString().split('T')[0],
    };

    // Parse the natural language input
    const result = await parseNaturalLanguageEvent(input, context);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Could not parse the input',
      });
    }

    // Build mapping for conversion
    const teamMap = new Map<string, number>();
    for (const team of teamsResult.recordset) {
      teamMap.set(team.name, team.id);
    }

    const siteMap = new Map<string, number>();
    for (const site of sitesResult.recordset) {
      siteMap.set(site.name, site.id);
    }

    const fieldMap = new Map<string, { id: number; siteId: number }>();
    for (const field of fieldsResult.recordset) {
      fieldMap.set(field.name, { id: field.id, siteId: field.site_id });
    }

    // Convert to API format
    const apiEvents = convertToApiEvents(result.events, {
      teams: teamMap,
      sites: siteMap,
      fields: fieldMap,
    });

    res.json({
      success: true,
      summary: result.summary,
      parsed: result.events,
      events: apiEvents,
    });
  } catch (error) {
    console.error('[Events] Parse error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to parse input: ' + (error as Error).message 
    });
  }
});

/**
 * POST /api/events/create-from-natural-language
 * Parse and create events from natural language in one step
 */
router.post('/create-from-natural-language', async (req: Request, res: Response) => {
  try {
    const { input, confirm, defaultTeamId, defaultFieldId } = req.body;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input text is required' });
    }

    console.log('[Events] Creating events from natural language:', input.substring(0, 100));
    if (defaultTeamId) console.log('[Events] Default team ID:', defaultTeamId);
    if (defaultFieldId) console.log('[Events] Default field ID:', defaultFieldId);

    // Get context
    const pool = await getPool();
    
    const [teamsResult, sitesResult, fieldsResult] = await Promise.all([
      pool.request().query('SELECT id, name FROM teams WHERE active = 1'),
      pool.request().query('SELECT id, name FROM sites'),
      pool.request().query('SELECT id, name, site_id FROM fields'),
    ]);

    const context = {
      teams: teamsResult.recordset,
      sites: sitesResult.recordset,
      fields: fieldsResult.recordset,
      currentDate: new Date().toISOString().split('T')[0],
    };

    // Parse the input
    const result = await parseNaturalLanguageEvent(input, context);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Could not parse the input',
      });
    }

    // Build mapping
    const teamMap = new Map<string, number>();
    for (const team of teamsResult.recordset) {
      teamMap.set(team.name, team.id);
    }

    const fieldMap = new Map<string, { id: number; siteId: number }>();
    for (const field of fieldsResult.recordset) {
      fieldMap.set(field.name, { id: field.id, siteId: field.site_id });
    }

    const apiEvents = convertToApiEvents(result.events, {
      teams: teamMap,
      sites: new Map(),
      fields: fieldMap,
    });

    // Apply defaults if not specified in the parsed events
    for (const event of apiEvents) {
      // Apply default team if no teams were parsed
      if (defaultTeamId && (!event.teamIds || event.teamIds.length === 0)) {
        event.teamIds = [defaultTeamId];
      }
      // Apply default field if no field was parsed
      if (defaultFieldId && !event.fieldId) {
        event.fieldId = defaultFieldId;
      }
    }

    // If not confirmed, return preview
    if (!confirm) {
      // Calculate how many events would be created for recurring
      let totalEvents = 0;
      for (const event of apiEvents) {
        if (event.isRecurring && event.recurringDays && event.recurringEndDate) {
          const start = new Date(event.date);
          const end = new Date(event.recurringEndDate);
          const days = event.recurringDays;
          
          let current = new Date(start);
          while (current <= end) {
            const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
            if (days.includes(dayOfWeek)) {
              totalEvents++;
            }
            current.setDate(current.getDate() + 1);
          }
        } else {
          totalEvents++;
        }
      }

      return res.json({
        success: true,
        preview: true,
        summary: result.summary,
        totalEvents,
        events: apiEvents,
      });
    }

    // Create the events
    const createdEvents: any[] = [];
    
    for (const event of apiEvents) {
      if (event.isRecurring && event.recurringDays && event.recurringEndDate) {
        // Create recurring events
        const start = new Date(event.date);
        const end = new Date(event.recurringEndDate);
        const days = event.recurringDays;
        
        let current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
          if (days.includes(dayOfWeek)) {
            const eventDate = current.toISOString().split('T')[0];
            const startDateTime = new Date(`${eventDate}T${event.startTime}:00`);
            const endDateTime = new Date(`${eventDate}T${event.endTime}:00`);
            
            const insertResult = await pool.request()
              .input('team_ids', sql.NVarChar, event.teamIds.join(','))
              .input('field_id', sql.Int, event.fieldId || null)
              .input('event_type', sql.NVarChar, event.eventType)
              .input('start_time', sql.DateTime, startDateTime)
              .input('end_time', sql.DateTime, endDateTime)
              .input('description', sql.NVarChar, event.title)
              .input('notes', sql.NVarChar, event.notes || null)
              .input('status', sql.NVarChar, 'Scheduled')
              .input('other_participants', sql.NVarChar, event.otherParticipants || null)
              .query(`
                INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, other_participants)
                OUTPUT INSERTED.*
                VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @other_participants)
              `);
            
            createdEvents.push(insertResult.recordset[0]);
          }
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Create single event
        const eventDate = event.date;
        const startDateTime = new Date(`${eventDate}T${event.startTime}:00`);
        const endDateTime = new Date(`${eventDate}T${event.endTime}:00`);
        
        const insertResult = await pool.request()
          .input('team_ids', sql.NVarChar, event.teamIds.join(','))
          .input('field_id', sql.Int, event.fieldId || null)
          .input('event_type', sql.NVarChar, event.eventType)
          .input('start_time', sql.DateTime, startDateTime)
          .input('end_time', sql.DateTime, endDateTime)
          .input('description', sql.NVarChar, event.title)
          .input('notes', sql.NVarChar, event.notes || null)
          .input('status', sql.NVarChar, 'Scheduled')
          .input('other_participants', sql.NVarChar, event.otherParticipants || null)
          .query(`
            INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, other_participants)
            OUTPUT INSERTED.*
            VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @other_participants)
          `);
        
        createdEvents.push(insertResult.recordset[0]);
      }
    }

    res.json({
      success: true,
      summary: result.summary,
      created: createdEvents.length,
      events: createdEvents,
    });
  } catch (error) {
    console.error('[Events] Create from natural language error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create events: ' + (error as Error).message 
    });
  }
});

// POST create new event
router.post('/', async (req: Request, res: Response) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, other_participants, estimated_attendance } = req.body;
    
    // Handle team_ids as comma-separated string (already comes as string from frontend)
    const teamIdsStr = team_ids || null;
    
    // Handle recurring_days - it comes as string from frontend already
    const recurringDaysStr = recurring_days || null;
    
    console.log('[Events POST] ===== INCOMING REQUEST =====');
    console.log('[Events POST] recurring_days:', recurring_days, 'type:', typeof recurring_days);
    console.log('[Events POST] recurring_end_date:', recurring_end_date, 'type:', typeof recurring_end_date);
    console.log('[Events POST] Full request body:', req.body);
    console.log('[Events POST] Condition check:', {
      recurringDaysStr,
      recurringDaysStr_truthy: !!recurringDaysStr,
      recurringDaysStr_length: recurringDaysStr?.length,
      recurring_end_date,
      recurring_end_date_truthy: !!recurring_end_date,
      recurring_end_date_type: typeof recurring_end_date,
      willGenerateMultiple: !!(recurringDaysStr && recurring_end_date)
    });
    
    const pool = await getPool();
    
    // Check if this is a recurring event - be very explicit about type checking
    const hasRecurringDays = recurringDaysStr && 
                              typeof recurringDaysStr === 'string' && 
                              recurringDaysStr.trim().length > 0;
    
    const hasRecurringEndDate = recurring_end_date &&
                                 recurring_end_date !== null &&
                                 recurring_end_date !== '' &&
                                 recurring_end_date !== 'null' &&
                                 recurring_end_date !== 'undefined';
    
    const shouldGenerateRecurring = hasRecurringDays && hasRecurringEndDate;
    
    console.log('[Events POST] ===================================');
    console.log('[Events POST] Should generate recurring:', shouldGenerateRecurring);
    console.log('[Events POST] Detailed breakdown:');
    console.log('[Events POST]   - recurringDaysStr:', recurringDaysStr, '(type:', typeof recurringDaysStr, ')');
    console.log('[Events POST]   - hasRecurringDays:', hasRecurringDays);
    console.log('[Events POST]   - recurring_end_date:', recurring_end_date, '(type:', typeof recurring_end_date, ')');
    console.log('[Events POST]   - hasRecurringEndDate:', hasRecurringEndDate);
    console.log('[Events POST] ===================================');
    
    if (shouldGenerateRecurring) {
      console.log('[Events POST] ✅ ENTERING RECURRING EVENT GENERATION BLOCK');
      // Parse recurring days
      const daysArray = recurringDaysStr.split(',').map((d: string) => parseInt(d.trim()));
      
      // Parse the start time to extract date and time components
      const startDateTime = new Date(start_time);
      const endDateTime = new Date(end_time);
      
      // Calculate time duration in milliseconds
      const duration = endDateTime.getTime() - startDateTime.getTime();
      
      // Generate all applicable dates
      const recurringDates = generateRecurringDates(
        startDateTime,
        new Date(recurring_end_date),
        daysArray
      );
      
      console.log('[Events POST] Creating recurring events:', {
        count: recurringDates.length,
        dates: recurringDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
        recurring_days: daysArray,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: `${duration / 1000 / 60} minutes`
      });
      
      // Create individual events for each date
      const createdEvents = [];
      const conflictedDates = [];
      
      for (const date of recurringDates) {
        // Set the time from the original start_time
        const eventStart = new Date(date);
        eventStart.setHours(startDateTime.getHours(), startDateTime.getMinutes(), startDateTime.getSeconds());
        
        // Calculate end time based on duration
        const eventEnd = new Date(eventStart.getTime() + duration);
        
        // Check for field conflict (only for Game events)
        const conflict = await checkFieldConflict(
          pool,
          field_id,
          event_type,
          eventStart,
          eventEnd
        );
        
        if (conflict.hasConflict) {
          console.log(`[Events POST] Skipping event on ${eventStart.toISOString()} due to field conflict`);
          conflictedDates.push(eventStart.toLocaleDateString('en-US'));
          continue; // Skip this date and move to next
        }
        
        console.log(`[Events POST] Creating event ${createdEvents.length + 1}/${recurringDates.length} for ${eventStart.toISOString()}`);
        
        const result = await pool.request()
          .input('team_ids', sql.NVarChar, teamIdsStr)
          .input('field_id', sql.Int, field_id)
          .input('event_type', sql.NVarChar, event_type)
          .input('start_time', sql.DateTime, eventStart)
          .input('end_time', sql.DateTime, eventEnd)
          .input('description', sql.NVarChar, description || null)
          .input('notes', sql.NVarChar, notes || null)
          .input('status', sql.NVarChar, status || 'Planned')
          .input('recurring_days', sql.NVarChar, null)  // Set to null for individual events
          .input('recurring_end_date', sql.Date, null)  // Set to null for individual events
          .input('other_participants', sql.NVarChar, other_participants || null)
          .input('estimated_attendance', sql.Int, estimated_attendance || null)
          .query(`
            INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, other_participants, estimated_attendance)
            OUTPUT INSERTED.*
            VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @recurring_days, @recurring_end_date, @other_participants, @estimated_attendance)
          `);
        
        createdEvents.push(result.recordset[0]);
      }
      
      console.log('[Events POST] Created', createdEvents.length, 'recurring events');
      
      if (createdEvents.length === 0) {
        return res.status(409).json({
          error: 'All dates have field conflicts',
          message: 'Cannot create recurring game events - all dates conflict with existing game bookings on this field.',
          conflictedDates
        });
      }
      
      // Fetch all created events with joins
      const eventIds = createdEvents.map(e => e.id);
      const eventsWithDetails = await pool.request()
        .query(`
          SELECT 
            e.*,
            f.name as field_name,
            s.name as site_name,
            s.address as site_address
          FROM events e
          LEFT JOIN fields f ON e.field_id = f.id
          LEFT JOIN sites s ON f.site_id = s.id
          WHERE e.id IN (${eventIds.join(',')})
        `);
      
      // Return all created events with warning about conflicts if any
      const response: any = eventsWithDetails.recordset;
      if (conflictedDates.length > 0) {
        res.setHeader('X-Booking-Conflicts', conflictedDates.join(','));
        console.log('[Events POST] Warning: Some dates had conflicts:', conflictedDates);
      }
      res.status(201).json(response);
    } else {
      console.log('[Events POST] ❌ NOT generating recurring events - creating single event');
      
      // Check for field conflict (only for Game events)
      const conflict = await checkFieldConflict(
        pool,
        field_id,
        event_type,
        new Date(start_time),
        new Date(end_time)
      );
      
      if (conflict.hasConflict) {
        const conflictTime = new Date(conflict.conflictingEvent.start_time);
        return res.status(409).json({ 
          error: 'Field booking conflict',
          message: `This field is already booked for a game at ${conflictTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} on ${conflictTime.toLocaleDateString('en-US')}. Game fields cannot have overlapping bookings.`,
          conflictingEvent: conflict.conflictingEvent
        });
      }
      
      // Single event (non-recurring)
      const result = await pool.request()
        .input('team_ids', sql.NVarChar, teamIdsStr)
        .input('field_id', sql.Int, field_id)
        .input('event_type', sql.NVarChar, event_type)
        .input('start_time', sql.DateTime, start_time)
        .input('end_time', sql.DateTime, end_time)
        .input('description', sql.NVarChar, description || null)
        .input('notes', sql.NVarChar, notes || null)
        .input('status', sql.NVarChar, status || 'Planned')
        .input('recurring_days', sql.NVarChar, recurringDaysStr)
        .input('recurring_end_date', sql.Date, recurring_end_date || null)
        .input('other_participants', sql.NVarChar, other_participants || null)
        .input('estimated_attendance', sql.Int, estimated_attendance || null)
        .query(`
          INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, other_participants, estimated_attendance)
          OUTPUT INSERTED.*
          VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @recurring_days, @recurring_end_date, @other_participants, @estimated_attendance)
        `);
      
      console.log('[Events POST] Created event with team_ids:', teamIdsStr, 'recurring_days:', recurringDaysStr);
      
      // Fetch the created event with joins to return complete data
      const createdEvent = await pool.request()
        .input('id', sql.Int, result.recordset[0].id)
        .query(`
          SELECT 
            e.*,
            f.name as field_name,
            s.name as site_name,
            s.address as site_address
          FROM events e
          LEFT JOIN fields f ON e.field_id = f.id
          LEFT JOIN sites s ON f.site_id = s.id
          WHERE e.id = @id
        `);
      
      console.log('[Events POST] Created event:', createdEvent.recordset[0].id);
      res.status(201).json(createdEvent.recordset[0]);
    }
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT update event
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, generate_recurring, other_participants, estimated_attendance } = req.body;
    
    console.log('[Events PUT] Request body:', req.body);
    
    // Handle team_ids as comma-separated string (already comes as string from frontend)
    const teamIdsStr = team_ids || null;
    
    // Handle recurring_days - it comes as string from frontend already
    const recurringDaysStr = recurring_days || null;
    
    console.log('[Events PUT] Processed - team_ids:', teamIdsStr, 'notes:', notes, 'recurring_days:', recurringDaysStr, 'generate_recurring:', generate_recurring);
    console.log('[Events PUT] Condition check:', {
      generate_recurring,
      generate_recurring_type: typeof generate_recurring,
      generate_recurring_boolean: !!generate_recurring,
      recurringDaysStr,
      recurringDaysStr_truthy: !!recurringDaysStr,
      recurringDaysStr_length: recurringDaysStr?.length,
      recurring_end_date,
      recurring_end_date_truthy: !!recurring_end_date,
      recurring_end_date_type: typeof recurring_end_date,
      willGenerateMultiple: !!(generate_recurring && recurringDaysStr && recurring_end_date)
    });
    
    const pool = await getPool();
    
    // Check if we need to generate recurring events (converting existing event to recurring)
    // Be very explicit about type checking and handle edge cases
    const hasRecurringDays = recurringDaysStr && 
                              typeof recurringDaysStr === 'string' && 
                              recurringDaysStr.trim().length > 0;
    
    const hasRecurringEndDate = recurring_end_date &&
                                 recurring_end_date !== null &&
                                 recurring_end_date !== '' &&
                                 recurring_end_date !== 'null' &&
                                 recurring_end_date !== 'undefined';
    
    const isGenerateRecurringTrue = generate_recurring === true || 
                                     generate_recurring === 'true' || 
                                     generate_recurring === 1;
    
    const shouldGenerateRecurring = isGenerateRecurringTrue && 
                                     hasRecurringDays && 
                                     hasRecurringEndDate;
    
    console.log('[Events PUT] ===================================');
    console.log('[Events PUT] Should generate recurring:', shouldGenerateRecurring);
    console.log('[Events PUT] Detailed breakdown:');
    console.log('[Events PUT]   - generate_recurring:', generate_recurring, '(type:', typeof generate_recurring, ')');
    console.log('[Events PUT]   - isGenerateRecurringTrue:', isGenerateRecurringTrue);
    console.log('[Events PUT]   - recurringDaysStr:', recurringDaysStr, '(length:', recurringDaysStr?.length, ')');
    console.log('[Events PUT]   - hasRecurringDays:', hasRecurringDays);
    console.log('[Events PUT]   - recurring_end_date:', recurring_end_date, '(type:', typeof recurring_end_date, ')');
    console.log('[Events PUT]   - hasRecurringEndDate:', hasRecurringEndDate);
    console.log('[Events PUT] ===================================');
    
    if (shouldGenerateRecurring) {
      console.log('[Events PUT] ✅ ENTERING RECURRING EVENT GENERATION BLOCK');
      console.log('[Events PUT] Converting event to recurring, generating individual events');
      
      // Parse recurring days
      const daysArray = recurringDaysStr.split(',').map((d: string) => parseInt(d.trim()));
      
      // Parse the start time to extract date and time components
      const startDateTime = new Date(start_time);
      const endDateTime = new Date(end_time);
      
      // Calculate time duration in milliseconds
      const duration = endDateTime.getTime() - startDateTime.getTime();
      
      // Generate all applicable dates
      const recurringDates = generateRecurringDates(
        startDateTime,
        new Date(recurring_end_date),
        daysArray
      );
      
      console.log('[Events PUT] Generating recurring events:', {
        count: recurringDates.length,
        dates: recurringDates.slice(0, 5).map(d => d.toISOString().split('T')[0])
      });
      
      // Delete the original event
      await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('DELETE FROM events WHERE id = @id');
      
      // Create individual events for each date
      const createdEvents = [];
      const conflictedDates = [];
      
      for (const date of recurringDates) {
        // Set the time from the original start_time
        const eventStart = new Date(date);
        eventStart.setHours(startDateTime.getHours(), startDateTime.getMinutes(), startDateTime.getSeconds());
        
        // Calculate end time based on duration
        const eventEnd = new Date(eventStart.getTime() + duration);
        
        // Check for field conflict (only for Game events)
        const conflict = await checkFieldConflict(
          pool,
          field_id,
          event_type,
          eventStart,
          eventEnd
        );
        
        if (conflict.hasConflict) {
          console.log(`[Events PUT] Skipping event on ${eventStart.toISOString()} due to field conflict`);
          conflictedDates.push(eventStart.toLocaleDateString('en-US'));
          continue; // Skip this date and move to next
        }
        
        console.log(`[Events PUT] Creating event ${createdEvents.length + 1}/${recurringDates.length} for ${eventStart.toISOString()}`);
        
        const result = await pool.request()
          .input('team_ids', sql.NVarChar, teamIdsStr)
          .input('field_id', sql.Int, field_id)
          .input('event_type', sql.NVarChar, event_type)
          .input('start_time', sql.DateTime, eventStart)
          .input('end_time', sql.DateTime, eventEnd)
          .input('description', sql.NVarChar, description || null)
          .input('notes', sql.NVarChar, notes || null)
          .input('status', sql.NVarChar, status || 'Planned')
          .input('recurring_days', sql.NVarChar, null)  // Set to null for individual events
          .input('recurring_end_date', sql.Date, null)  // Set to null for individual events
          .input('other_participants', sql.NVarChar, other_participants || null)
          .input('estimated_attendance', sql.Int, estimated_attendance || null)
          .query(`
            INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, other_participants, estimated_attendance)
            OUTPUT INSERTED.*
            VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @recurring_days, @recurring_end_date, @other_participants, @estimated_attendance)
          `);
        
        createdEvents.push(result.recordset[0]);
      }
      
      console.log('[Events PUT] Created', createdEvents.length, 'recurring events');
      
      if (createdEvents.length === 0) {
        return res.status(409).json({
          error: 'All dates have field conflicts',
          message: 'Cannot create recurring game events - all dates conflict with existing game bookings on this field.',
          conflictedDates
        });
      }
      
      // Fetch all created events with joins
      const eventIds = createdEvents.map(e => e.id);
      const eventsWithDetails = await pool.request()
        .query(`
          SELECT 
            e.*,
            f.name as field_name,
            s.name as site_name,
            s.address as site_address
          FROM events e
          LEFT JOIN fields f ON e.field_id = f.id
          LEFT JOIN sites s ON f.site_id = s.id
          WHERE e.id IN (${eventIds.join(',')})
        `);
      
      // Return all created events as array with warning about conflicts if any
      const response: any = eventsWithDetails.recordset;
      if (conflictedDates.length > 0) {
        res.setHeader('X-Booking-Conflicts', conflictedDates.join(','));
        console.log('[Events PUT] Warning: Some dates had conflicts:', conflictedDates);
      }
      res.json(response);
    } else {
      console.log('[Events PUT] ❌ NOT generating recurring events - updating single event');
      
      // Check for field conflict (only for Game events)
      const conflict = await checkFieldConflict(
        pool,
        field_id,
        event_type,
        new Date(start_time),
        new Date(end_time),
        parseInt(req.params.id) // Exclude the current event being updated
      );
      
      if (conflict.hasConflict) {
        const conflictTime = new Date(conflict.conflictingEvent.start_time);
        return res.status(409).json({ 
          error: 'Field booking conflict',
          message: `This field is already booked for a game at ${conflictTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} on ${conflictTime.toLocaleDateString('en-US')}. Game fields cannot have overlapping bookings.`,
          conflictingEvent: conflict.conflictingEvent
        });
      }
      
      // Regular update - single event
      const result = await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('team_ids', sql.NVarChar, teamIdsStr)
        .input('field_id', sql.Int, field_id)
        .input('event_type', sql.NVarChar, event_type)
        .input('start_time', sql.DateTime, start_time)
        .input('end_time', sql.DateTime, end_time)
        .input('description', sql.NVarChar, description)
        .input('notes', sql.NVarChar, notes)
        .input('status', sql.NVarChar, status)
        .input('recurring_days', sql.NVarChar, recurringDaysStr)
        .input('recurring_end_date', sql.Date, recurring_end_date || null)
        .input('other_participants', sql.NVarChar, other_participants || null)
        .input('estimated_attendance', sql.Int, estimated_attendance || null)
        .query(`
        UPDATE events 
        SET team_ids = @team_ids,
            field_id = @field_id,
            event_type = @event_type,
            start_time = @start_time,
            end_time = @end_time,
            description = @description,
            notes = @notes,
            status = @status,
            recurring_days = @recurring_days,
            recurring_end_date = @recurring_end_date,
            other_participants = @other_participants,
            estimated_attendance = @estimated_attendance
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    
      console.log('[Events PUT] Updated event with team_ids:', teamIdsStr, 'recurring_days:', recurringDaysStr);
      
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Fetch the updated event with joins to return complete data
      const updatedEvent = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query(`
          SELECT 
            e.*,
            f.name as field_name,
            s.name as site_name,
            s.address as site_address
          FROM events e
          LEFT JOIN fields f ON e.field_id = f.id
          LEFT JOIN sites s ON f.site_id = s.id
          WHERE e.id = @id
        `);
      
      console.log('[Events PUT] Updated event:', updatedEvent.recordset[0].id);
      res.json(updatedEvent.recordset[0]);
    }
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE event
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM events WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
