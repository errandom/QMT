
import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import * as sql from 'mssql';

const router = Router();

/**
 * GET /api/requests
 * Fetch all requests with optional filters (type, status)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const { type, status } = req.query;

    let query = 'SELECT * FROM requests WHERE 1=1';
    const request = pool.request();

    if (type) {
      query += ' AND request_type = @type';
      request.input('type', sql.NVarChar, String(type));
    }

    if (status) {
      query += ' AND status = @status';
      request.input('status', sql.NVarChar, String(status));
    }

    query += ' ORDER BY created_at DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * GET /api/requests/:id
 * Fetch single request by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM requests WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

/**
 * POST /api/requests
 * Create new request (facility or equipment)
 */
router.post('/', async (req: Request, res: Response) => {
  const {
    request_type,
    requestor_name,
    requestor_phone,
    requestor_email,
    team_id,
    field_id,
    event_type,
    requested_date,
    requested_time,
    duration,
    description,
    status
  } = req.body;

  if (!request_type || !requestor_name) {
    return res.status(400).json({ error: 'Missing required fields: request_type, requestor_name' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('request_type', sql.NVarChar, request_type)
      .input('requestor_name', sql.NVarChar, requestor_name)
      .input('requestor_phone', sql.NVarChar, requestor_phone || null)
      .input('requestor_email', sql.NVarChar, requestor_email || null)
      .input('team_id', sql.Int, team_id || null)
      .input('field_id', sql.Int, field_id || null)
      .input('event_type', sql.NVarChar, event_type || null)
      .input('requested_date', sql.Date, requested_date || null)
      .input('requested_time', sql.Time, requested_time || null)
      .input('duration', sql.Int, duration || null)
      .input('description', sql.NVarChar, description || null)
      .input('status', sql.NVarChar, status || 'pending')
      .query(`
        INSERT INTO requests (
          request_type, requestor_name, requestor_phone, requestor_email,
          team_id, field_id, event_type, requested_date, requested_time,
          duration, description, status, created_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @request_type, @requestor_name, @requestor_phone, @requestor_email,
          @team_id, @field_id, @event_type, @requested_date, @requested_time,
          @duration, @description, @status, GETDATE()
        )
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

/**
 * PUT /api/requests/:id
 * Update request status and admin notes
 */
router.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

  const { status, admin_notes } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .input('admin_notes', sql.NVarChar, admin_notes || null)
      .query(`
        UPDATE requests
        SET status = @status,
            admin_notes = @admin_notes,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

/**
 * DELETE /api/requests/:id
 * Remove request
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM requests WHERE id = @id');

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

/** ✅ Critical for build success */
export default router;
