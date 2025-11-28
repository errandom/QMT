// server/routes/teams.ts
import { Router, Request, Response } from 'express';
import * as sql from 'mssql';
import { getPool } from '../db.js';

const router = Router();

/* GET all teams */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM teams
      WHERE active = 1
      ORDER BY sport, name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

/* GET team by ID */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid team ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM teams WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/* POST create team */
router.post('/', async (req: Request, res: Response) => {
  const { name, sport, age_group, coaches, active } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Missing required fields: name, sport' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group || null)
      .input('coaches', sql.NVarChar, coaches || null)
      .input('active', sql.Bit, active !== false)
      .query(`
        INSERT INTO teams (name, sport, age_group, coaches, active)
        OUTPUT INSERTED.*
        VALUES (@name, @sport, @age_group, @coaches, @active)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

/* PUT update team */
router.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid team ID' });

  const { name, sport, age_group, coaches, active } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Missing required fields: name, sport' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group || null)
      .input('coaches', sql.NVarChar, coaches || null)
      .input('active', sql.Bit, active)
      .query(`
        UPDATE teams
        SET name = @name,
            sport = @sport,
            age_group = @age_group,
            coaches = @coaches,
            active = @active
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

/* DELETE team */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid team ID' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM teams WHERE id = @id');

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});
