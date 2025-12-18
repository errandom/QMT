import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';

const router = Router();

// GET all teams
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    // Return ALL teams for operations office, frontend will filter
    const result = await pool.request().query(`
      SELECT * FROM teams 
      ORDER BY sport, name
    `);
    console.log('[Teams GET] Retrieved', result.recordset.length, 'teams')
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET single team by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
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

// POST create new team
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      sport, 
      age_group, 
      coaches, 
      active,
      headCoachFirstName,
      headCoachLastName,
      headCoachEmail,
      headCoachPhone,
      teamManagerFirstName,
      teamManagerLastName,
      teamManagerEmail,
      teamManagerPhone
    } = req.body;
    
    console.log('[Teams POST] Received data:', req.body);
    
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group || null)
      .input('coaches', sql.NVarChar, coaches || null)
      .input('active', sql.Bit, active !== false)
      .input('head_coach_first_name', sql.NVarChar, headCoachFirstName || null)
      .input('head_coach_last_name', sql.NVarChar, headCoachLastName || null)
      .input('head_coach_email', sql.NVarChar, headCoachEmail || null)
      .input('head_coach_phone', sql.NVarChar, headCoachPhone || null)
      .input('team_manager_first_name', sql.NVarChar, teamManagerFirstName || null)
      .input('team_manager_last_name', sql.NVarChar, teamManagerLastName || null)
      .input('team_manager_email', sql.NVarChar, teamManagerEmail || null)
      .input('team_manager_phone', sql.NVarChar, teamManagerPhone || null)
      .query(`
        INSERT INTO teams (
          name, sport, age_group, coaches, active,
          head_coach_first_name, head_coach_last_name, head_coach_email, head_coach_phone,
          team_manager_first_name, team_manager_last_name, team_manager_email, team_manager_phone
        )
        OUTPUT INSERTED.*
        VALUES (
          @name, @sport, @age_group, @coaches, @active,
          @head_coach_first_name, @head_coach_last_name, @head_coach_email, @head_coach_phone,
          @team_manager_first_name, @team_manager_last_name, @team_manager_email, @team_manager_phone
        )
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// PUT update team
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      sport, 
      age_group, 
      coaches, 
      active,
      headCoachFirstName,
      headCoachLastName,
      headCoachEmail,
      headCoachPhone,
      teamManagerFirstName,
      teamManagerLastName,
      teamManagerEmail,
      teamManagerPhone
    } = req.body;
    
    console.log('[Teams PUT] Received data:', req.body);
    
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group)
      .input('coaches', sql.NVarChar, coaches)
      .input('active', sql.Bit, active)
      .input('head_coach_first_name', sql.NVarChar, headCoachFirstName || null)
      .input('head_coach_last_name', sql.NVarChar, headCoachLastName || null)
      .input('head_coach_email', sql.NVarChar, headCoachEmail || null)
      .input('head_coach_phone', sql.NVarChar, headCoachPhone || null)
      .input('team_manager_first_name', sql.NVarChar, teamManagerFirstName || null)
      .input('team_manager_last_name', sql.NVarChar, teamManagerLastName || null)
      .input('team_manager_email', sql.NVarChar, teamManagerEmail || null)
      .input('team_manager_phone', sql.NVarChar, teamManagerPhone || null)
      .query(`
        UPDATE teams 
        SET name = @name,
            sport = @sport,
            age_group = @age_group,
            coaches = @coaches,
            active = @active,
            head_coach_first_name = @head_coach_first_name,
            head_coach_last_name = @head_coach_last_name,
            head_coach_email = @head_coach_email,
            head_coach_phone = @head_coach_phone,
            team_manager_first_name = @team_manager_first_name,
            team_manager_last_name = @team_manager_last_name,
            team_manager_email = @team_manager_email,
            team_manager_phone = @team_manager_phone,
            updated_at = GETDATE()
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

// DELETE team
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM teams WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;
