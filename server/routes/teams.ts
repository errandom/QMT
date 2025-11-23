import { Router, Request, Response } from 'express';
import * as sql from 'mssql';
import { getPool } from '../db.js';

const router = Router();

/** Shape of the payload for create/update requests */
interface TeamPayload {
  name?: string;
  sport?: string;
  age_group?: string | null;
  coaches?: string | null;
  active?: boolean;
}

/** Utility: send standardized errors */
function sendError(res: Response, status: number, message: string, err?: unknown) {
  if (err) console.error(message, err);
  return res.status(status).json({ error: message });
}

/* ---------------------------------------------
 * GET /api/teams
 * Returns all active teams, ordered by sport, name
 * --------------------------------------------- */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query(`
        SELECT *
        FROM teams
        WHERE active = 1
        ORDER BY sport, name
      `);

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch teams', error);
  }
});

/* ---------------------------------------------
 * GET /api/teams/:id
 * Returns a single team by ID
 * --------------------------------------------- */
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid team id');
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM teams WHERE id = @id');

    if (result.recordset.length === 0) {
      return sendError(res, 404, 'Team not found');
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch team', error);
  }
});

/* ---------------------------------------------
 * POST /api/teams
 * Creates a new team and returns the inserted row
 * --------------------------------------------- */
router.post('/', async (req: Request<unknown, unknown, TeamPayload>, res: Response) => {
  const { name, sport, age_group, coaches, active } = req.body || {};

  // Basic required fields validation
  if (!name || !sport) {
    return sendError(res, 400, 'Missing required fields: name, sport');
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group ?? null)
      .input('coaches', sql.NVarChar, coaches ?? null)
      .input('active', sql.Bit, active !== false) // default true
      .query(`
        INSERT INTO teams (name, sport, age_group, coaches, active)
        OUTPUT INSERTED.*
        VALUES (@name, @sport, @age_group, @coaches, @active)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to create team', error);
  }
});

/* ---------------------------------------------
 * PUT /api/teams/:id
 * Updates a team and returns the updated row
 * --------------------------------------------- */
router.put('/:id', async (req: Request<{ id: string }, unknown, TeamPayload>, res: Response) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid team id');
  }

  const { name, sport, age_group, coaches, active } = req.body || {};

  if (!name || !sport || typeof active === 'undefined') {
    return sendError(res, 400, 'Missing required fields: name, sport, active');
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group ?? null)
      .input('coaches', sql.NVarChar, coaches ?? null)
      .input('active', sql.Bit, !!active)
      .query(`
        UPDATE teams
        SET name     = @name,
            sport    = @sport,
            age_group= @age_group,
            coaches  = @coaches,
            active   = @active
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return sendError(res, 404, 'Team not found');
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to update team', error);
  }
});

/* ---------------------------------------------
 * DELETE /api/teams/:id
 * Deletes a team by id
 * --------------------------------------------- */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return sendError(res, 400, 'Invalid team id');
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM teams WHERE id = @id');

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return sendError(res, 404, 'Team not found');
    }

    return res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    return sendError(res, 500, 'Failed to delete team', error);
  }
});
