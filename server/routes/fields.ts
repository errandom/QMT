
import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import * as sql from 'mssql';

const router = Router();

/**
 * GET /api/fields
 * Fetch all fields with related site info
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        f.*,
        s.name AS site_name,
        s.address AS site_address
      FROM fields f
      LEFT JOIN sites s ON f.site_id = s.id
      ORDER BY s.name, f.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

/**
 * GET /api/fields/:id
 * Fetch single field by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid field ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          f.*,
          s.name AS site_name,
          s.address AS site_address
        FROM fields f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE f.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching field:', error);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

/**
 * POST /api/fields
 * Create new field
 */
router.post('/', async (req: Request, res: Response) => {
  const { site_id, name, field_type, surface_type } = req.body;
  if (!site_id || !name) {
    return res.status(400).json({ error: 'Missing required fields: site_id, name' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('site_id', sql.Int, site_id)
      .input('name', sql.NVarChar, name)
      .input('field_type', sql.NVarChar, field_type || null)
      .input('surface_type', sql.NVarChar, surface_type || null)
      .query(`
        INSERT INTO fields (site_id, name, field_type, surface_type)
        OUTPUT INSERTED.*
        VALUES (@site_id, @name, @field_type, @surface_type)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating field:', error);
    res.status(500).json({ error: 'Failed to create field' });
  }
});

/**
 * PUT /api/fields/:id
 * Update field
 */
router.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid field ID' });

  const { site_id, name, field_type, surface_type } = req.body;
  if (!site_id || !name) {
    return res.status(400).json({ error: 'Missing required fields: site_id, name' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('site_id', sql.Int, site_id)
      .input('name', sql.NVarChar, name)
      .input('field_type', sql.NVarChar, field_type || null)
      .input('surface_type', sql.NVarChar, surface_type || null)
      .query(`
        UPDATE fields
        SET site_id = @site_id,
            name = @name,
            field_type = @field_type,
            surface_type = @surface_type
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

/**
 * DELETE /api/fields/:id
 * Remove field
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid field ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM fields WHERE id = @id');

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

/** ✅ Critical for build success */
export default router;
