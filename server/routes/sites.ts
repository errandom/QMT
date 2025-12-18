import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';

const router = Router();

// GET all sites with their fields
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM fields WHERE site_id = s.id) as field_count
      FROM sites s
      ORDER BY s.name
    `);
    console.log('[Sites GET] Retrieved', result.recordset.length, 'sites')
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// GET single site by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM sites WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// POST create new site
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      address, 
      city,
      zipCode,
      latitude,
      longitude,
      contactFirstName,
      contactLastName,
      contactPhone,
      contactEmail,
      isSportsFacility,
      amenities,
      isActive
    } = req.body;
    
    console.log('[Sites POST] Received data:', req.body);
    
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address || null)
      .input('city', sql.NVarChar, city || null)
      .input('zip_code', sql.NVarChar, zipCode || null)
      .input('latitude', sql.Float, latitude || null)
      .input('longitude', sql.Float, longitude || null)
      .input('contact_first_name', sql.NVarChar, contactFirstName || null)
      .input('contact_last_name', sql.NVarChar, contactLastName || null)
      .input('contact_phone', sql.NVarChar, contactPhone || null)
      .input('contact_email', sql.NVarChar, contactEmail || null)
      .input('is_sports_facility', sql.Bit, isSportsFacility !== false)
      .input('amenities', sql.NVarChar, amenities || null)
      .input('active', sql.Bit, isActive !== false)
      .query(`
        INSERT INTO sites (
          name, address, city, zip_code, latitude, longitude,
          contact_first_name, contact_last_name, contact_phone, contact_email,
          is_sports_facility, amenities, active
        )
        OUTPUT INSERTED.*
        VALUES (
          @name, @address, @city, @zip_code, @latitude, @longitude,
          @contact_first_name, @contact_last_name, @contact_phone, @contact_email,
          @is_sports_facility, @amenities, @active
        )
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// PUT update site
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      address, 
      city,
      zipCode,
      latitude,
      longitude,
      contactFirstName,
      contactLastName,
      contactPhone,
      contactEmail,
      isSportsFacility,
      amenities,
      isActive
    } = req.body;
    
    console.log('[Sites PUT] Received data:', req.body);
    
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address || null)
      .input('city', sql.NVarChar, city || null)
      .input('zip_code', sql.NVarChar, zipCode || null)
      .input('latitude', sql.Float, latitude || null)
      .input('longitude', sql.Float, longitude || null)
      .input('contact_first_name', sql.NVarChar, contactFirstName || null)
      .input('contact_last_name', sql.NVarChar, contactLastName || null)
      .input('contact_phone', sql.NVarChar, contactPhone || null)
      .input('contact_email', sql.NVarChar, contactEmail || null)
      .input('is_sports_facility', sql.Bit, isSportsFacility !== undefined ? isSportsFacility : true)
      .input('amenities', sql.NVarChar, amenities || null)
      .input('active', sql.Bit, isActive !== undefined ? isActive : true)
      .query(`
        UPDATE sites 
        SET name = @name,
            address = @address,
            city = @city,
            zip_code = @zip_code,
            latitude = @latitude,
            longitude = @longitude,
            contact_first_name = @contact_first_name,
            contact_last_name = @contact_last_name,
            contact_phone = @contact_phone,
            contact_email = @contact_email,
            is_sports_facility = @is_sports_facility,
            amenities = @amenities,
            active = @active,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// DELETE site
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM sites WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

export default router;
