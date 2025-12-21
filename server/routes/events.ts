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

// POST create new event
router.post('/', async (req: Request, res: Response) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date } = req.body;
    
    // Handle team_ids as comma-separated string (already comes as string from frontend)
    const teamIdsStr = team_ids || null;
    
    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);
    
    const pool = await getPool();
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
      .query(`
        INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date)
        OUTPUT INSERTED.*
        VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status, @recurring_days, @recurring_end_date)
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
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT update event
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date } = req.body;
    
    console.log('[Events PUT] Request body:', req.body);
    
    // Handle team_ids as comma-separated string (already comes as string from frontend)
    const teamIdsStr = team_ids || null;
    
    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);
    
    console.log('[Events PUT] Processed - team_ids:', teamIdsStr, 'notes:', notes, 'recurring_days:', recurringDaysStr);
    
    const pool = await getPool();
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
            recurring_end_date = @recurring_end_date
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
