import { Router, Request, Response } from 'express';
import * as sql from 'mssql';
import { getPool } from '../db.js';

const router = Router();

/** Type for create/update payload */
interface SitePayload {
  name?: string;
  address?: string | null;
  amenities?: string | null;
  active?: boolean;
}

/** Utility: consistent error responses + logging */
function sendError(res: Response, status: number, message: string, err?: unknown) {
  if (err) console.error(message, err);
  return res.status(status).json({ error: message });
}

/**
 * GET /api/sites
 * Fetch all sites with field count
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM fields f WHERE f.site_id = s.id) AS field_count
      FROM sites s
      ORDER BY s.name
    `);
    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch sites', error);
  }
});

/**
 * GET /api/sites/:id
 * Fetch single site by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid site ID');
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM sites WHERE id = @id');

    if (result.recordset.length === 0) {
      return sendError(res, 404, 'Site not found');
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch site', error);
  }
});

/**
 * POST /api/sites
 * Create new site
 */
router.post('/', async (req: Request<unknown, unknown, SitePayload>, res: Response) => {
  const { name, address, amenities, active } = req.body || {};
  if (!name || !address) {
    return sendError(res, 400, 'Missing required fields: name, address');
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address)
      .input('amenities', sql.NVarChar, amenities ?? null)
      .input('active', sql.Bit, active !== false)
      .query(`
        INSERT INTO sites (name, address, amenities, active)
        OUTPUT INSERTED.*
        VALUES (@name, @address, @amenities, @active)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to create site', error);
  }
});

/**
 * PUT /api/sites/:id
 * Update site
 */
router.put('/:id', async (req: Request<{ id: string }, unknown, SitePayload>, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid site ID');
  }

  const { name, address, amenities, active } = req.body || {};
  if (!name || !address || typeof active === 'undefined') {
    return sendError(res, 400, 'Missing required fields: name, address, active');
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address)
      .input('amenities', sql.NVarChar, amenities ?? null)
      .input('active', sql.Bit, !!active)
      .query(`
        UPDATE sites
        SET name = @name,
            address = @address,
            amenities = @amenities,
            active = @active
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return sendError(res, 404, 'Site not found');
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to update site', error);
  }
});

/**
 * DELETE /api/sites/:id
 * Remove site
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid site ID');
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM sites WHERE id = @id');

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return sendError(res, 404, 'Site not found');
    }

    return res.json({ message: 'Site deleted successfully' });
  } catch (error) {
       return sendError(res, 500, 'Failed to delete site', error);
  }
});

/** ✅ Critical for build success */
export default router;
