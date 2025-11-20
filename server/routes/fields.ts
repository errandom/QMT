import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';

const router = Router();

// GET all fields
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        f.*,
        s.name as site_name,
        s.address as site_address
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

// GET single field by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT 
          f.*,
          s.name as site_name,
          s.address as site_address
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

// POST create new field
router.post('/', async (req: Request, res: Response) => {
  try {
    const { site_id, name, field_type, surface_type } = req.body;
    
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

// PUT update field
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { site_id, name, field_type, surface_type } = req.body;
    
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('site_id', sql.Int, site_id)
      .input('name', sql.NVarChar, name)
      .input('field_type', sql.NVarChar, field_type)
      .input('surface_type', sql.NVarChar, surface_type)
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

// DELETE field
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM fields WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    
    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

export default router;
