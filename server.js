// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// --- Log early and clearly so you see it in Log Stream ---
console.log('QMT starting at', new Date().toISOString(), 'PORT =', process.env.PORT);

// Express basics
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Port: App Service injects PORT (e.g., 8080). Fall back locally.
const port = process.env.PORT || 3000;

// JWT Secret for authentication
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ------------------------------
// Azure SQL connection settings
// ------------------------------
const sqlConfig = {
  server: process.env.SQL_SERVER,           // e.g., myserver.database.windows.net
  database: process.env.SQL_DATABASE,       // e.g., QMT
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,                          // REQUIRED for Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,                  // 30 seconds
    requestTimeout: 30000                   // 30 seconds
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  // Add connection retry logic
  connectionRetryTimeout: 60000
};

// Maintain a single pool
let poolPromise;
async function getPool() {
  if (!poolPromise) {
    console.log('Attempting SQL connection with config:', {
      server: sqlConfig.server || 'NOT SET',
      database: sqlConfig.database || 'NOT SET',
      user: sqlConfig.user || 'NOT SET',
      passwordSet: !!sqlConfig.password,
      options: sqlConfig.options
    });

    // CHECK IF CREDENTIALS ARE MISSING
    if (!sqlConfig.server || !sqlConfig.database || !sqlConfig.user || !sqlConfig.password) {
      console.error('❌ CRITICAL: Database credentials missing!');
      console.error('Missing:', {
        SQL_SERVER: !sqlConfig.server,
        SQL_DATABASE: !sqlConfig.database,
        SQL_USER: !sqlConfig.user,
        SQL_PASSWORD: !sqlConfig.password
      });
      console.error('Set these environment variables in Azure App Service Configuration');
      poolPromise = Promise.reject(new Error('Database credentials not configured'));
      return poolPromise;
    }

    poolPromise = sql.connect(sqlConfig).then(pool => {
      console.log('✓ SQL Pool connected successfully');
      return pool;
    }).catch(err => {
      console.error('✗ SQL connection failed:', {
        message: err.message,
        code: err.code,
        originalError: err.originalError?.message
      });
      poolPromise = null; // Reset so it can retry
      throw err;
    });
  }
  return poolPromise;
}

// ------------------------------
// Diagnostic routes
// ------------------------------

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

// DB probe
app.get('/api/db-check', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ ok: true });
  } catch (err) {
    console.error('DB-CHECK error:', {
      message: err.message, code: err.code, number: err.number, state: err.state, name: err.name
    });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Enhanced diagnostic endpoint to check data loading
app.get('/api/diagnostic', async (_req, res) => {
  console.log('========== DIAGNOSTIC CHECK ==========');
  const results = {
    timestamp: new Date().toISOString(),
    database: {},
    data: {}
  };

  try {
    const pool = await getPool();
    console.log('✓ Pool connected');

    // Check each table
    const tables = ['teams', 'sites', 'fields', 'equipment', 'events'];

    for (const table of tables) {
      try {
        const countResult = await pool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`);
        const count = countResult.recordset[0]?.cnt || 0;
        results.database[table] = count;
        console.log(`  ${table}: ${count} records`);

        // Get first record as sample
        if (count > 0) {
          const sampleResult = await pool.request().query(`SELECT TOP 1 * FROM ${table}`);
          results.data[table] = {
            count,
            sample: sampleResult.recordset[0]
          };
        } else {
          results.data[table] = { count: 0, sample: null };
        }
      } catch (err) {
        results.database[table] = 'ERROR: ' + err.message;
        console.error(`  ERROR querying ${table}:`, err.message);
      }
    }

    console.log('========== DIAGNOSTIC COMPLETE ==========');
    res.json(results);
  } catch (err) {
    console.error('Diagnostic error:', err);
    res.status(500).json({ error: err.message, results });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt for username:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT id, username, password_hash, role, is_active, email, full_name
        FROM users
        WHERE username = @username
      `);

    if (result.recordset.length === 0) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      console.log('Inactive user:', username);
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (err) {
    console.error('Login error:', {
      message: err.message, code: err.code, number: err.number, state: err.state, name: err.name
    });
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Register/create new user (admin only)
app.post('/api/auth/register', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, email, fullName } = req.body;

    console.log('[Register] Creating user:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, role || 'user')
      .input('email', sql.NVarChar, email || null)
      .input('full_name', sql.NVarChar, fullName || null)
      .query(`
        INSERT INTO users (username, password_hash, role, email, full_name, is_active)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.email, INSERTED.full_name, INSERTED.is_active
        VALUES (@username, @password_hash, @role, @email, @full_name, 1)
      `);

    console.log('[Register] User created successfully');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('[Register] Error:', err);
    if (err.number === 2627) { // Unique constraint violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('[Get Users] Fetching all users');
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT id, username, role, email, full_name, is_active, created_at, updated_at
        FROM users
        ORDER BY username
      `);

    console.log('[Get Users] Found', result.recordset.length, 'users');
    res.json(result.recordset);
  } catch (err) {
    console.error('[Get Users] Error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current user
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query(`
        SELECT id, username, role, email, full_name, is_active
        FROM users
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('[Get Me] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user (admin only)
app.put('/api/auth/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, role, email, fullName, isActive } = req.body;

    console.log('[Update User] Updating user ID:', req.params.id);

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('username', sql.NVarChar, username)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email || null)
      .input('full_name', sql.NVarChar, fullName || null)
      .input('is_active', sql.Bit, isActive !== undefined ? isActive : true)
      .query(`
        UPDATE users 
        SET username = @username,
            role = @role,
            email = @email,
            full_name = @full_name,
            is_active = @is_active,
            updated_at = GETDATE()
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.email, INSERTED.full_name, INSERTED.is_active
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Update User] User updated successfully');
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('[Update User] Error:', err);
    if (err.number === 2627) { // Unique constraint violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('[Delete User] Deleting user ID:', req.params.id);

    // Prevent deleting yourself
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM users WHERE id = @id');

    console.log('[Delete User] User deleted successfully');
    res.status(204).send();
  } catch (err) {
    console.error('[Delete User] Error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Change password
app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const pool = await getPool();

    // Get current user's password hash
    const userResult = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT password_hash FROM users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult.recordset[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.request()
      .input('id', sql.Int, req.user.id)
      .input('password_hash', sql.NVarChar, newPasswordHash)
      .query('UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id');

    console.log('[Change Password] Password updated for user:', req.user.username);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Change Password] Error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ------------------------------
// Data API endpoints
// ------------------------------

// Teams
app.get('/api/teams', async (_req, res) => {
  try {
    console.log('[GET /api/teams] 🔄 Fetching teams...');
    const pool = await getPool();
    console.log('[GET /api/teams] ✓ Pool obtained');
    const result = await pool.request()
      .query('SELECT * FROM teams ORDER BY name');
    console.log('[GET /api/teams] ✓ Query executed, recordset length:', result.recordset?.length);
    console.log('[GET /api/teams] ✓ Returning data:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('[GET /api/teams] ❌ Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch teams', details: err.message });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM teams WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const { 
      name, 
      sport, 
      age_group, 
      headCoach,
      teamManager,
      active 
    } = req.body;

    console.log('[Teams POST] Received data:', JSON.stringify(req.body, null, 2));

    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group || null)
      .input('head_coach_first_name', sql.NVarChar, headCoach?.firstName || null)
      .input('head_coach_last_name', sql.NVarChar, headCoach?.lastName || null)
      .input('head_coach_email', sql.NVarChar, headCoach?.email || null)
      .input('head_coach_phone', sql.NVarChar, headCoach?.phone || null)
      .input('team_manager_first_name', sql.NVarChar, teamManager?.firstName || null)
      .input('team_manager_last_name', sql.NVarChar, teamManager?.lastName || null)
      .input('team_manager_email', sql.NVarChar, teamManager?.email || null)
      .input('team_manager_phone', sql.NVarChar, teamManager?.phone || null)
      .input('active', sql.Bit, active !== false ? 1 : 0)
      .query(`
        INSERT INTO teams (
          name, sport, age_group,
          head_coach_first_name, head_coach_last_name, head_coach_email, head_coach_phone,
          team_manager_first_name, team_manager_last_name, team_manager_email, team_manager_phone,
          active
        )
        OUTPUT INSERTED.*
        VALUES (
          @name, @sport, @age_group,
          @head_coach_first_name, @head_coach_last_name, @head_coach_email, @head_coach_phone,
          @team_manager_first_name, @team_manager_last_name, @team_manager_email, @team_manager_phone,
          @active
        )
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { 
      name, 
      sport, 
      age_group, 
      headCoach,
      teamManager,
      active 
    } = req.body;

    console.log('[Teams PUT] Received data:', JSON.stringify(req.body, null, 2));
    console.log('[Teams PUT] ID:', req.params.id);
    console.log('[Teams PUT] headCoach:', headCoach);
    console.log('[Teams PUT] teamManager:', teamManager);

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('sport', sql.NVarChar, sport)
      .input('age_group', sql.NVarChar, age_group || null)
      .input('head_coach_first_name', sql.NVarChar, headCoach?.firstName || null)
      .input('head_coach_last_name', sql.NVarChar, headCoach?.lastName || null)
      .input('head_coach_email', sql.NVarChar, headCoach?.email || null)
      .input('head_coach_phone', sql.NVarChar, headCoach?.phone || null)
      .input('team_manager_first_name', sql.NVarChar, teamManager?.firstName || null)
      .input('team_manager_last_name', sql.NVarChar, teamManager?.lastName || null)
      .input('team_manager_email', sql.NVarChar, teamManager?.email || null)
      .input('team_manager_phone', sql.NVarChar, teamManager?.phone || null)
      .input('active', sql.Bit, active !== false ? 1 : 0)
      .query(`
        UPDATE teams 
        SET name = @name, 
            sport = @sport, 
            age_group = @age_group, 
            head_coach_first_name = @head_coach_first_name,
            head_coach_last_name = @head_coach_last_name,
            head_coach_email = @head_coach_email,
            head_coach_phone = @head_coach_phone,
            team_manager_first_name = @team_manager_first_name,
            team_manager_last_name = @team_manager_last_name,
            team_manager_email = @team_manager_email,
            team_manager_phone = @team_manager_phone,
            active = @active, 
            updated_at = GETDATE()
        WHERE id = @id
      `);

    // Fetch the updated team separately
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM teams WHERE id = @id');

    console.log('[Teams PUT] Query result:', result.recordset);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('[Teams PUT] Error updating team:', err);
    console.error('[Teams PUT] Error details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to update team', details: err.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM teams WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Events
app.get('/api/events', async (_req, res) => {
  try {
    console.log('[GET /api/events] 🔄 Fetching events...');
    const pool = await getPool();
    console.log('[GET /api/events] ✓ Pool obtained');
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
    console.log('[GET /api/events] ✓ Query executed, recordset length:', result.recordset?.length);
    console.log('[GET /api/events] ✓ Returning data:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('[GET /api/events] ❌ Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch events', details: err.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
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
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date } = req.body;

    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);

    const pool = await getPool();
    const result = await pool.request()
      .input('team_ids', sql.NVarChar, team_ids || null)
      .input('field_id', sql.Int, field_id || null)
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
    console.log('[Events POST] Created event with team_ids:', team_ids, 'notes:', notes, 'recurring_days:', recurringDaysStr);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { team_ids, field_id, event_type, start_time, end_time, description, notes, status, recurring_days, recurring_end_date } = req.body;

    // Handle recurring_days as comma-separated string
    const recurringDaysStr = recurring_days && Array.isArray(recurring_days) ? recurring_days.join(',') : (recurring_days || null);

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('team_ids', sql.NVarChar, team_ids || null)
      .input('field_id', sql.Int, field_id || null)
      .input('event_type', sql.NVarChar, event_type)
      .input('start_time', sql.DateTime, start_time)
      .input('end_time', sql.DateTime, end_time)
      .input('description', sql.NVarChar, description || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('status', sql.NVarChar, status)
      .input('recurring_days', sql.NVarChar, recurringDaysStr)
      .input('recurring_end_date', sql.Date, recurring_end_date || null)
      .query(`
        UPDATE events 
        SET team_ids = @team_ids, field_id = @field_id, event_type = @event_type,
            start_time = @start_time, end_time = @end_time, description = @description,
            notes = @notes, status = @status, recurring_days = @recurring_days,
            recurring_end_date = @recurring_end_date, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    console.log('[Events PUT] Updated event with team_ids:', team_ids, 'notes:', notes, 'recurring_days:', recurringDaysStr);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM events WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Sites
app.get('/api/sites', async (_req, res) => {
  try {
    console.log('[GET /api/sites] 🔄 Fetching sites...');
    const pool = await getPool();
    console.log('[GET /api/sites] ✓ Pool obtained');
    console.log('[GET /api/sites] 📝 Executing query: SELECT s.*, (SELECT COUNT(*) FROM fields WHERE site_id = s.id) as field_count FROM sites s ORDER BY s.name');
    const result = await pool.request().query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM fields WHERE site_id = s.id) as field_count
      FROM sites s
      ORDER BY s.name
    `);
    console.log('[GET /api/sites] ✓ Query executed, recordset length:', result.recordset?.length);
    console.log('[GET /api/sites] 📊 Recordset columns:', result.recordset?.[0] ? Object.keys(result.recordset[0]) : 'NO DATA');
    console.log('[GET /api/sites] ✓ Returning data:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('[GET /api/sites] ❌ Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch sites', details: err.message });
  }
});

app.get('/api/sites/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM sites WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error fetching site:', err);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

app.post('/api/sites', async (req, res) => {
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

    console.log('[Sites POST] Received data:', JSON.stringify(req.body, null, 2));

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

    console.log('[Sites POST] Created site:', JSON.stringify(result.recordset[0], null, 2));
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating site:', err);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

app.put('/api/sites/:id', async (req, res) => {
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

    console.log('[Sites PUT] Received data:', JSON.stringify(req.body, null, 2));

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

    console.log('[Sites PUT] Returning updated site:', JSON.stringify(result.recordset[0], null, 2));
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating site:', err);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

app.delete('/api/sites/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM sites WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting site:', err);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Fields
app.get('/api/fields', async (_req, res) => {
  try {
    console.log('[GET /api/fields] 🔄 Fetching fields...');
    const pool = await getPool();
    console.log('[GET /api/fields] ✓ Pool obtained');
    console.log('[GET /api/fields] 📝 Executing query: SELECT f.*, s.name as site_name, s.address as site_address FROM fields f LEFT JOIN sites s ON f.site_id = s.id ORDER BY s.name, f.name');
    const result = await pool.request().query(`
      SELECT 
        f.*,
        s.name as site_name,
        s.address as site_address
      FROM fields f
      LEFT JOIN sites s ON f.site_id = s.id
      ORDER BY s.name, f.name
    `);
    console.log('[GET /api/fields] ✓ Query executed, recordset length:', result.recordset?.length);
    console.log('[GET /api/fields] 📊 Recordset columns:', result.recordset?.[0] ? Object.keys(result.recordset[0]) : 'NO DATA');
    console.log('[GET /api/fields] ✓ Returning data:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('[GET /api/fields] ❌ Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch fields', details: err.message });
  }
});

app.get('/api/fields/:id', async (req, res) => {
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
  } catch (err) {
    console.error('Error fetching field:', err);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

app.post('/api/fields', async (req, res) => {
  try {
    const { site_id, name, field_type, surface_type, has_lights, capacity, active } = req.body;

    console.log('[Fields POST] Received data:', JSON.stringify(req.body, null, 2));

    const pool = await getPool();
    const result = await pool.request()
      .input('site_id', sql.Int, site_id)
      .input('name', sql.NVarChar, name)
      .input('field_type', sql.NVarChar, field_type || null)
      .input('surface_type', sql.NVarChar, surface_type || null)
      .input('has_lights', sql.Bit, has_lights || false)
      .input('capacity', sql.Int, capacity || null)
      .input('active', sql.Bit, active !== false ? 1 : 0)
      .query(`
        INSERT INTO fields (site_id, name, field_type, surface_type, has_lights, capacity, active)
        OUTPUT INSERTED.*
        VALUES (@site_id, @name, @field_type, @surface_type, @has_lights, @capacity, @active)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating field:', err);
    res.status(500).json({ error: 'Failed to create field' });
  }
});

app.put('/api/fields/:id', async (req, res) => {
  try {
    const { site_id, name, field_type, surface_type, has_lights, capacity, active } = req.body;

    console.log('[Fields PUT] Received data:', JSON.stringify(req.body, null, 2));

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('site_id', sql.Int, site_id)
      .input('name', sql.NVarChar, name)
      .input('field_type', sql.NVarChar, field_type || null)
      .input('surface_type', sql.NVarChar, surface_type || null)
      .input('has_lights', sql.Bit, has_lights || false)
      .input('capacity', sql.Int, capacity || null)
      .input('active', sql.Bit, active !== false ? 1 : 0)
      .query(`
        UPDATE fields 
        SET site_id = @site_id, 
            name = @name, 
            field_type = @field_type, 
            surface_type = @surface_type,
            has_lights = @has_lights,
            capacity = @capacity,
            active = @active,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating field:', err);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

app.delete('/api/fields/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM fields WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting field:', err);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

// Equipment
app.get('/api/equipment', async (_req, res) => {
  try {
    console.log('[GET /api/equipment] 🔄 Fetching equipment...');
    const pool = await getPool();
    console.log('[GET /api/equipment] ✓ Pool obtained');
    const result = await pool.request()
      .query('SELECT * FROM equipment ORDER BY name');
    console.log('[GET /api/equipment] ✓ Query executed, recordset length:', result.recordset?.length);
    console.log('[GET /api/equipment] ✓ Returning data:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('[GET /api/equipment] ❌ Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch equipment', details: err.message });
  }
});

app.get('/api/equipment/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM equipment WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    const { name, category, quantity, condition, location } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('category', sql.NVarChar, category || null)
      .input('quantity', sql.Int, quantity || 1)
      .input('condition', sql.NVarChar, condition || 'good')
      .input('location', sql.NVarChar, location || null)
      .query(`
        INSERT INTO equipment (name, category, quantity, condition, location)
        OUTPUT INSERTED.*
        VALUES (@name, @category, @quantity, @condition, @location)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating equipment:', err);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    const { name, category, quantity, condition, location } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('category', sql.NVarChar, category || null)
      .input('quantity', sql.Int, quantity)
      .input('condition', sql.NVarChar, condition)
      .input('location', sql.NVarChar, location || null)
      .query(`
        UPDATE equipment 
        SET name = @name, category = @category, quantity = @quantity, 
            condition = @condition, location = @location, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating equipment:', err);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM equipment WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting equipment:', err);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// Requests
app.get('/api/requests', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        r.*,
        t.name as team_name,
        f.name as field_name,
        s.name as site_name
      FROM requests r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN sites s ON f.site_id = s.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT 
          r.*,
          t.name as team_name,
          f.name as field_name,
          s.name as site_name
        FROM requests r
        LEFT JOIN teams t ON r.team_id = t.id
        LEFT JOIN fields f ON r.field_id = f.id
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE r.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error fetching request:', err);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const { request_type, requestor_name, requestor_phone, requestor_email, team_id, field_id, 
            event_type, requested_date, requested_time, duration, description } = req.body;

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
      .query(`
        INSERT INTO requests 
        (request_type, requestor_name, requestor_phone, requestor_email, team_id, field_id, 
         event_type, requested_date, requested_time, duration, description, status)
        OUTPUT INSERTED.*
        VALUES 
        (@request_type, @requestor_name, @requestor_phone, @requestor_email, @team_id, @field_id,
         @event_type, @requested_date, @requested_time, @duration, @description, 'pending')
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating request:', err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.NVarChar, status)
      .input('admin_notes', sql.NVarChar, admin_notes || null)
      .query(`
        UPDATE requests 
        SET status = @status, admin_notes = @admin_notes, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating request:', err);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM requests WHERE id = @id');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting request:', err);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// ------------------------------
// Static assets + SPA fallback
// ------------------------------
const distDir = path.join(__dirname, 'dist');

// ⭐ GitHub Spark KV Store Backend (REQUIRED!)
// This stores data in memory - used by useKV hook on frontend
const kvStore = new Map();

app.post('/_spark/kv/:key', express.json(), (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    console.log(`[KV] Storing key "${key}"`, value ? `(${JSON.stringify(value).length} bytes)` : '');
    kvStore.set(key, value);
    res.json({ ok: true });
  } catch (err) {
    console.error('[KV] Error storing key:', err);
    res.status(500).json({ error: 'Failed to store key' });
  }
});

app.get('/_spark/kv/:key', (req, res) => {
  try {
    const { key } = req.params;
    const value = kvStore.get(key);
    console.log(`[KV] Retrieved key "${key}"`, value ? `(${JSON.stringify(value).length} bytes)` : '(empty)');
    if (value === undefined) {
      return res.status(404).json({ error: 'Key not found' });
    }
    res.json(value);
  } catch (err) {
    console.error('[KV] Error retrieving key:', err);
    res.status(500).json({ error: 'Failed to retrieve key' });
  }
});

// ⭐ Spark lifecycle endpoint
app.post('/_spark/loaded', (_req, res) => {
  console.log('[Spark] Client loaded');
  res.json({ ok: true });
});

// Serve the Vite production build (must come before fallback)
app.use(express.static(distDir, { maxAge: '1h' }));

// SPA fallback for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ------------------------------
// Error handling (last)
// ------------------------------
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Extra safety: log unhandled promise rejections / exceptions
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

// ------------------------------
// Start the server (bind to all interfaces)
// ------------------------------
app.listen(port, '0.0.0.0', async () => {
  console.log(`QMT app listening on port ${port}`);
  console.log('Environment variables check:', {
    SQL_SERVER: process.env.SQL_SERVER,
    SQL_DATABASE: process.env.SQL_DATABASE,
    SQL_USER: process.env.SQL_USER,
    SQL_PASSWORD: process.env.SQL_PASSWORD ? '***SET***' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV
  });

  // Test database connection on startup
  try {
    console.log('Testing database connection...');
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS test');
    console.log('✓ Database connection successful');
  } catch (err) {
    console.error('✗ Database connection failed on startup:', err.message);
    console.error('Full error:', err);
  }
});
