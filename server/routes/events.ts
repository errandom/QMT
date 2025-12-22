import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';

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

// POST create new event
router.post('/', async (req: Request, res: Response) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date, other_participants, estimated_attendance } = req.body;
    
    // Handle team_ids as comma-separated string (already comes as string from frontend)
    const teamIdsStr = team_ids || null;
    
    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);
    
    const pool = await getPool();
    
    // Check if this is a recurring event
    if (recurringDaysStr && recurring_end_date) {
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
      
      console.log('[Events POST] Creating recurring event:', {
        count: recurringDates.length,
        dates: recurringDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
        recurring_days: daysArray
      });
      
      // Create individual events for each date
      const createdEvents = [];
      for (const date of recurringDates) {
        // Set the time from the original start_time
        const eventStart = new Date(date);
        eventStart.setHours(startDateTime.getHours(), startDateTime.getMinutes(), startDateTime.getSeconds());
        
        // Calculate end time based on duration
        const eventEnd = new Date(eventStart.getTime() + duration);
        
        const result = await pool.request()
          .input('team_ids', sql.NVarChar, teamIdsStr)
          .input('field_id', sql.Int, field_id)
          .input('event_type', sql.NVarChar, event_type)
          .input('start_time', sql.DateTime, eventStart)
          .input('end_time', sql.DateTime, eventEnd)
          .input('description', sql.NVarChar, description || null)
          .input('notes', sql.NVarChar, notes || null)
          .input('status', sql.NVarChar, status || 'Planned')
          .input('recurring_days', sql.NVarChar, recurringDaysStr)
          .input('recurring_end_date', sql.Date, recurring_end_date)
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
      
      // Return all created events
      res.status(201).json(eventsWithDetails.recordset);
    } else {
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
    
    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);
    
    console.log('[Events PUT] Processed - team_ids:', teamIdsStr, 'notes:', notes, 'recurring_days:', recurringDaysStr, 'generate_recurring:', generate_recurring);
    
    const pool = await getPool();
    
    // Check if we need to generate recurring events (converting existing event to recurring)
    if (generate_recurring && recurringDaysStr && recurring_end_date) {
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
      for (const date of recurringDates) {
        // Set the time from the original start_time
        const eventStart = new Date(date);
        eventStart.setHours(startDateTime.getHours(), startDateTime.getMinutes(), startDateTime.getSeconds());
        
        // Calculate end time based on duration
        const eventEnd = new Date(eventStart.getTime() + duration);
        
        const result = await pool.request()
          .input('team_ids', sql.NVarChar, teamIdsStr)
          .input('field_id', sql.Int, field_id)
          .input('event_type', sql.NVarChar, event_type)
          .input('start_time', sql.DateTime, eventStart)
          .input('end_time', sql.DateTime, eventEnd)
          .input('description', sql.NVarChar, description || null)
          .input('notes', sql.NVarChar, notes || null)
          .input('status', sql.NVarChar, status || 'Planned')
          .input('recurring_days', sql.NVarChar, recurringDaysStr)
          .input('recurring_end_date', sql.Date, recurring_end_date)
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
      
      // Return all created events as array
      res.json(eventsWithDetails.recordset);
    } else {
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
