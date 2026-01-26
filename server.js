// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Azure OpenAI for AI event creation
let AzureOpenAI;
try {
  const openai = require('openai');
  AzureOpenAI = openai.AzureOpenAI;
} catch (e) {
  console.log('[AI] OpenAI package not available - AI features disabled');
}

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

// Maintain a single pool with proper initialization tracking
let poolPromise = null;
let poolConnecting = false;

async function getPool() {
  // If we already have a connected pool, return it
  if (poolPromise) {
    return poolPromise;
  }
  
  // If another request is currently connecting, wait for it
  if (poolConnecting) {
    // Wait a bit and retry - the other request will set poolPromise
    await new Promise(resolve => setTimeout(resolve, 100));
    return getPool();
  }

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
    throw new Error('Database credentials not configured');
  }

  // Mark that we're connecting
  poolConnecting = true;
  
  console.log('Attempting SQL connection with config:', {
    server: sqlConfig.server || 'NOT SET',
    database: sqlConfig.database || 'NOT SET',
    user: sqlConfig.user || 'NOT SET',
    passwordSet: !!sqlConfig.password,
    options: sqlConfig.options
  });

  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✓ SQL Pool connected successfully');
    poolPromise = Promise.resolve(pool);
    return pool;
  } catch (err) {
    console.error('✗ SQL connection failed:', {
      message: err.message,
      code: err.code,
      originalError: err.originalError?.message
    });
    throw err;
  } finally {
    poolConnecting = false;
  }
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

// Middleware to check if user is admin or management
const requireAdminOrMgmt = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'mgmt') {
    return res.status(403).json({ error: 'Admin or management access required' });
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

// AI Event Creation - Natural Language Parsing
const AI_SYSTEM_PROMPT = `You are an AI assistant that parses natural language event descriptions for a sports team management app. 
The app is for "Renegades," an American Football club in Oslo, Norway.

Your task is to extract structured event information from natural language input.

IMPORTANT RULES:
1. Always respond with valid JSON only - no markdown, no explanations
2. Times should be in 24-hour format (HH:mm)
3. Dates should be in ISO format (YYYY-MM-DD)
4. For recurring days, use: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
5. Event types: "Practice", "Game", "Meeting", "Other"
6. If duration is mentioned but not end time, calculate end time
7. Default duration is 90 minutes for Practice, 180 minutes for Game, 60 minutes for Meeting
8. If no year is specified, assume 2026
9. Parse team names as they appear (e.g., "U19", "Seniors", "U15")
10. For games, extract opponent if mentioned

Return a JSON object with this structure:
{
  "success": true,
  "events": [
    {
      "title": "string - event title",
      "eventType": "Practice" | "Game" | "Meeting" | "Other",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "teamNames": ["array of team names"],
      "siteName": "venue/site name if mentioned",
      "fieldName": "specific field if mentioned",
      "opponent": "opponent name for games",
      "notes": "any additional notes",
      "isRecurring": boolean,
      "date": "YYYY-MM-DD for single events",
      "recurringDays": [1-7 array for recurring],
      "startDate": "YYYY-MM-DD for recurring series start",
      "endDate": "YYYY-MM-DD for recurring series end"
    }
  ],
  "summary": "Human-readable summary of what will be created"
}

If you cannot parse the input, return:
{
  "success": false,
  "events": [],
  "summary": "",
  "error": "Description of what's missing or unclear"
}`;

app.post('/api/events/create-from-natural-language', async (req, res) => {
  try {
    const { input, confirm, defaultTeamId, defaultFieldId } = req.body;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input text is required' });
    }

    console.log('[AI Events] Processing:', input.substring(0, 100));
    if (defaultTeamId) console.log('[AI Events] Default team ID:', defaultTeamId);
    if (defaultFieldId) console.log('[AI Events] Default field ID:', defaultFieldId);

    // Check if AI is available
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    if (!AzureOpenAI || !azureEndpoint || !azureApiKey) {
      console.log('[AI Events] Azure OpenAI not configured, using fallback parser');
      // Fallback to regex-based parsing
      const parsed = parseEventWithRegex(input);
      // Apply defaults to fallback parser results
      if (parsed.success && parsed.events) {
        for (const event of parsed.events) {
          if (defaultTeamId && (!event.teamIds || event.teamIds.length === 0)) {
            event.teamIds = [defaultTeamId];
          }
          if (defaultFieldId && !event.fieldId) {
            event.fieldId = defaultFieldId;
          }
        }
      }
      return res.json(parsed);
    }

    // Get context from database
    const pool = await getPool();
    const [teamsResult, sitesResult, fieldsResult] = await Promise.all([
      pool.request().query('SELECT id, name FROM teams WHERE is_active = 1'),
      pool.request().query('SELECT id, name FROM sites'),
      pool.request().query('SELECT id, name, site_id FROM fields'),
    ]);

    const context = {
      teams: teamsResult.recordset,
      sites: sitesResult.recordset,
      fields: fieldsResult.recordset,
      currentDate: new Date().toISOString().split('T')[0],
    };

    // Build context for AI
    let contextStr = '';
    if (context.teams.length) {
      contextStr += `\\nAvailable teams: ${context.teams.map(t => t.name).join(', ')}`;
    }
    if (context.sites.length) {
      contextStr += `\\nAvailable sites: ${context.sites.map(s => s.name).join(', ')}`;
    }
    contextStr += `\\nCurrent date: ${context.currentDate}`;

    const userMessage = `Context:${contextStr}\\n\\nParse this event description:\\n"${input}"`;

    try {
      const client = new AzureOpenAI({
        endpoint: azureEndpoint,
        apiKey: azureApiKey,
        apiVersion: '2024-08-01-preview',
      });

      const response = await client.chat.completions.create({
        model: azureDeployment,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1024,
        temperature: 0.3,
      });

      let content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Clean markdown if present
      content = content.trim();
      if (content.startsWith('\`\`\`json')) content = content.slice(7);
      else if (content.startsWith('\`\`\`')) content = content.slice(3);
      if (content.endsWith('\`\`\`')) content = content.slice(0, -3);
      content = content.trim();

      const parsed = JSON.parse(content);

      if (!parsed.success) {
        return res.json(parsed);
      }

      // Convert parsed events to API format
      const apiEvents = convertParsedToApiEvents(parsed.events, context);

      // Apply defaults if not specified in the parsed events
      for (const event of apiEvents) {
        // Apply default team if no teams were parsed
        if (defaultTeamId && (!event.teamIds || event.teamIds.length === 0)) {
          event.teamIds = [defaultTeamId];
        }
        // Apply default field if no field was parsed
        if (defaultFieldId && !event.fieldId) {
          event.fieldId = defaultFieldId;
        }
      }

      if (!confirm) {
        // Preview mode - return what would be created
        const totalEvents = calculateTotalEvents(apiEvents);
        return res.json({
          success: true,
          summary: parsed.summary,
          totalEvents,
          events: apiEvents,
        });
      }

      // Create events
      const created = await createEventsFromParsed(pool, apiEvents);
      return res.json({
        success: true,
        created,
        message: `Created ${created} event(s)`,
      });

    } catch (aiError) {
      console.error('[AI Events] AI parsing failed:', aiError);
      // Fallback to regex
      const parsed = parseEventWithRegex(input);
      // Apply defaults to fallback parser results
      if (parsed.success && parsed.events) {
        for (const event of parsed.events) {
          if (defaultTeamId && (!event.teamIds || event.teamIds.length === 0)) {
            event.teamIds = [defaultTeamId];
          }
          if (defaultFieldId && !event.fieldId) {
            event.fieldId = defaultFieldId;
          }
        }
      }
      return res.json(parsed);
    }

  } catch (err) {
    console.error('[AI Events] Error:', err);
    res.status(500).json({ error: 'Failed to process event', details: err.message });
  }
});

// Helper function: Regex-based fallback parser
function parseEventWithRegex(input) {
  const lowerInput = input.toLowerCase();
  
  // Detect event type
  let eventType = 'Other';
  if (/practice|training|workout/i.test(input)) eventType = 'Practice';
  else if (/game|match|vs|versus|against/i.test(input)) eventType = 'Game';
  else if (/meeting|meet/i.test(input)) eventType = 'Meeting';

  // Extract time
  const timeMatch = input.match(/(\\d{1,2})(:\\d{2})?\\s*(am|pm)?/i);
  let startTime = '18:00';
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? timeMatch[2].slice(1) : '00';
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    startTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Calculate end time based on event type
  const [sh, sm] = startTime.split(':').map(Number);
  const duration = eventType === 'Practice' ? 90 : eventType === 'Game' ? 180 : 60;
  const endMinutes = sh * 60 + sm + duration;
  const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

  // Detect team names
  const teamPatterns = ['seniors', 'juniors', 'u19', 'u17', 'u15', 'u13', 'u11', 'veterans', 'ladies', 'women', 'men'];
  const teamNames = teamPatterns.filter(t => lowerInput.includes(t.toLowerCase()));

  // Detect recurring pattern
  const isRecurring = /every|weekly|each/i.test(input);
  const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  const recurringDays = [];
  for (const [day, num] of Object.entries(dayMap)) {
    if (lowerInput.includes(day)) recurringDays.push(num);
  }

  // Create title
  const title = `${teamNames.length > 0 ? teamNames[0].charAt(0).toUpperCase() + teamNames[0].slice(1) : ''} ${eventType}`.trim();

  return {
    success: true,
    summary: `Will create ${isRecurring ? 'recurring ' : ''}${eventType.toLowerCase()} event${isRecurring ? 's' : ''}`,
    totalEvents: isRecurring ? 10 : 1,
    events: [{
      title: title || eventType,
      eventType,
      startTime,
      endTime,
      teamIds: [],
      teamNames,
      isRecurring,
      recurringDays: recurringDays.length > 0 ? recurringDays : undefined,
      date: isRecurring ? undefined : new Date().toISOString().split('T')[0],
    }]
  };
}

// Helper function: Convert parsed events to API format
function convertParsedToApiEvents(events, context) {
  const teamMap = new Map(context.teams.map(t => [t.name.toLowerCase(), t.id]));
  const fieldMap = new Map(context.fields.map(f => [f.name.toLowerCase(), { id: f.id, siteId: f.site_id }]));

  return events.map(event => {
    // Match team names to IDs
    const teamIds = (event.teamNames || [])
      .map(name => {
        // Try exact match first, then partial match
        for (const [teamName, id] of teamMap.entries()) {
          if (teamName.includes(name.toLowerCase()) || name.toLowerCase().includes(teamName)) {
            return id;
          }
        }
        return null;
      })
      .filter(id => id !== null);

    // Match field
    let fieldId = null;
    if (event.fieldName) {
      for (const [fieldName, data] of fieldMap.entries()) {
        if (fieldName.includes(event.fieldName.toLowerCase())) {
          fieldId = data.id;
          break;
        }
      }
    }

    return {
      title: event.title,
      eventType: event.eventType,
      startTime: event.startTime,
      endTime: event.endTime,
      teamIds,
      fieldId,
      isRecurring: event.isRecurring,
      recurringDays: event.recurringDays,
      date: event.date || event.startDate,
      recurringEndDate: event.endDate,
      notes: event.notes,
      opponent: event.opponent,
    };
  });
}

// Helper function: Calculate total events including recurring
function calculateTotalEvents(events) {
  let total = 0;
  for (const event of events) {
    if (event.isRecurring && event.recurringDays && event.recurringEndDate) {
      const start = new Date(event.date);
      const end = new Date(event.recurringEndDate);
      let current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
        if (event.recurringDays.includes(dayOfWeek)) {
          total++;
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      total++;
    }
  }
  return total || 1;
}

// Helper function: Create events in database
async function createEventsFromParsed(pool, events) {
  let created = 0;
  
  for (const event of events) {
    try {
      if (event.isRecurring && event.recurringDays && event.recurringEndDate) {
        // Create recurring events
        const start = new Date(event.date);
        const end = new Date(event.recurringEndDate);
        let current = new Date(start);
        
        while (current <= end) {
          const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
          if (event.recurringDays.includes(dayOfWeek)) {
            const [sh, sm] = event.startTime.split(':');
            const [eh, em] = event.endTime.split(':');
            
            const startDateTime = new Date(current);
            startDateTime.setHours(parseInt(sh), parseInt(sm), 0);
            
            const endDateTime = new Date(current);
            endDateTime.setHours(parseInt(eh), parseInt(em), 0);

            await pool.request()
              .input('team_ids', sql.NVarChar, event.teamIds.join(',') || null)
              .input('field_id', sql.Int, event.fieldId || null)
              .input('event_type', sql.NVarChar, event.eventType)
              .input('start_time', sql.DateTime, startDateTime)
              .input('end_time', sql.DateTime, endDateTime)
              .input('description', sql.NVarChar, event.title)
              .input('notes', sql.NVarChar, event.notes || null)
              .input('status', sql.NVarChar, 'Planned')
              .query(`
                INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status)
                VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status)
              `);
            created++;
          }
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Create single event
        const eventDate = new Date(event.date);
        const [sh, sm] = event.startTime.split(':');
        const [eh, em] = event.endTime.split(':');
        
        const startDateTime = new Date(eventDate);
        startDateTime.setHours(parseInt(sh), parseInt(sm), 0);
        
        const endDateTime = new Date(eventDate);
        endDateTime.setHours(parseInt(eh), parseInt(em), 0);

        await pool.request()
          .input('team_ids', sql.NVarChar, event.teamIds.join(',') || null)
          .input('field_id', sql.Int, event.fieldId || null)
          .input('event_type', sql.NVarChar, event.eventType)
          .input('start_time', sql.DateTime, startDateTime)
          .input('end_time', sql.DateTime, endDateTime)
          .input('description', sql.NVarChar, event.title)
          .input('notes', sql.NVarChar, event.notes || null)
          .input('status', sql.NVarChar, 'Planned')
          .query(`
            INSERT INTO events (team_ids, field_id, event_type, start_time, end_time, description, notes, status)
            VALUES (@team_ids, @field_id, @event_type, @start_time, @end_time, @description, @notes, @status)
          `);
        created++;
      }
    } catch (err) {
      console.error('[AI Events] Error creating event:', err);
    }
  }
  
  return created;
}

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
// User Settings API
// ------------------------------

// Get all settings for current user
app.get('/api/settings', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .query('SELECT setting_key, setting_value FROM user_settings WHERE user_id = @user_id');
    
    // Convert to object
    const settings = {};
    for (const row of result.recordset) {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch (e) {
        settings[row.setting_key] = row.setting_value;
      }
    }
    
    res.json(settings);
  } catch (err) {
    console.error('[Settings] Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get specific setting
app.get('/api/settings/:key', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .input('setting_key', sql.NVarChar, req.params.key)
      .query('SELECT setting_value FROM user_settings WHERE user_id = @user_id AND setting_key = @setting_key');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    try {
      res.json(JSON.parse(result.recordset[0].setting_value));
    } catch (e) {
      res.json({ value: result.recordset[0].setting_value });
    }
  } catch (err) {
    console.error('[Settings] Error fetching setting:', err);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Save/update a setting (upsert)
app.put('/api/settings/:key', verifyToken, async (req, res) => {
  try {
    const settingKey = req.params.key;
    const settingValue = JSON.stringify(req.body);
    
    console.log('[Settings] Saving setting:', settingKey, 'for user:', req.user.id);
    
    const pool = await getPool();
    
    // Use MERGE for upsert
    await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .input('setting_key', sql.NVarChar, settingKey)
      .input('setting_value', sql.NVarChar, settingValue)
      .query(`
        MERGE user_settings AS target
        USING (SELECT @user_id AS user_id, @setting_key AS setting_key) AS source
        ON target.user_id = source.user_id AND target.setting_key = source.setting_key
        WHEN MATCHED THEN
          UPDATE SET setting_value = @setting_value, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, setting_key, setting_value)
          VALUES (@user_id, @setting_key, @setting_value);
      `);
    
    console.log('[Settings] Setting saved successfully');
    res.json({ success: true, key: settingKey });
  } catch (err) {
    console.error('[Settings] Error saving setting:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Delete a setting
app.delete('/api/settings/:key', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .input('setting_key', sql.NVarChar, req.params.key)
      .query('DELETE FROM user_settings WHERE user_id = @user_id AND setting_key = @setting_key');
    
    res.status(204).send();
  } catch (err) {
    console.error('[Settings] Error deleting setting:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// ------------------------------
// Spond Integration API
// ------------------------------

// Spond API client (simplified for server.js)
const SPOND_API_BASE = 'https://api.spond.com/core/v1/';
let spondToken = null;
let spondTokenExpiry = null;

async function spondLogin(username, password) {
  console.log('[Spond] Attempting login for:', username);
  
  const response = await fetch(`${SPOND_API_BASE}login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ email: username, password })
  });
  
  console.log('[Spond] Login response status:', response.status);
  
  if (!response.ok) {
    let errorMessage = 'Invalid Spond credentials';
    try {
      const errorData = await response.json();
      console.error('[Spond] Login error response:', errorData);
      
      // Handle specific Spond error messages
      if (errorData.errorKey === 'userDoesntHavePassword') {
        errorMessage = 'This account uses Facebook/social login. Please create a password in the Spond app first, or use an account with email/password login.';
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid email or password. Please check your Spond credentials.';
      } else if (response.status === 429) {
        errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
      }
    } catch (e) {
      console.error('[Spond] Could not parse error response');
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  if (!data.loginToken) {
    console.error('[Spond] No token in response:', JSON.stringify(data).substring(0, 200));
    throw new Error('Spond login failed: No authentication token received.');
  }
  
  console.log('[Spond] Successfully authenticated');
  return data.loginToken;
}

async function spondRequest(token, endpoint) {
  // Add query params to include member data for groups endpoint
  let url = `${SPOND_API_BASE}${endpoint}`;
  if (endpoint === 'groups') {
    url += '?includeMembers=true';
  }
  
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Spond API error: ${response.status}`);
  }
  
  return response.json();
}

// Get Spond integration status
app.get('/api/spond/status', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const pool = await getPool();
    
    // Check if spond_config table exists
    const tableCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'spond_config'
    `);
    
    if (tableCheck.recordset[0].count === 0) {
      return res.json({
        configured: false,
        connected: false,
        lastSync: null,
        syncedGroups: 0,
        syncedEvents: 0
      });
    }
    
    const configResult = await pool.request()
      .query('SELECT id, created_at, last_sync FROM spond_config WHERE is_active = 1');
    
    const isConfigured = configResult.recordset.length > 0;
    
    res.json({
      configured: isConfigured,
      connected: isConfigured && spondToken !== null,
      lastSync: isConfigured ? configResult.recordset[0]?.last_sync : null,
      syncedGroups: 0,
      syncedEvents: 0
    });
  } catch (err) {
    console.error('[Spond] Error getting status:', err);
    res.status(500).json({ error: 'Failed to get Spond status' });
  }
});

// Test Spond connection
app.post('/api/spond/test', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    console.log('[Spond] Testing connection for:', username);
    
    // Try to login
    const token = await spondLogin(username, password);
    
    // Try to fetch groups to verify access
    const groups = await spondRequest(token, 'groups');
    
    console.log('[Spond] Test successful, found', groups.length, 'groups');
    
    res.json({
      success: true,
      message: 'Connection successful',
      groupCount: groups.length
    });
  } catch (err) {
    console.error('[Spond] Test connection error:', err);
    res.json({
      success: false,
      message: err.message || 'Connection test failed'
    });
  }
});

// Configure Spond credentials
app.post('/api/spond/configure', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const { username, password, autoSync, syncIntervalMinutes } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Test credentials first
    const token = await spondLogin(username, password);
    const groups = await spondRequest(token, 'groups');
    
    const pool = await getPool();
    
    // Check if spond_config table exists, create if not
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'spond_config')
      BEGIN
        CREATE TABLE spond_config (
          id INT PRIMARY KEY IDENTITY(1,1),
          username NVARCHAR(255) NOT NULL,
          password NVARCHAR(255) NOT NULL,
          auto_sync BIT DEFAULT 0,
          sync_interval_minutes INT DEFAULT 60,
          is_active BIT DEFAULT 1,
          last_sync DATETIME,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        )
      END
    `);
    
    // Deactivate existing config
    await pool.request()
      .query('UPDATE spond_config SET is_active = 0 WHERE is_active = 1');
    
    // Insert new config
    await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, password)
      .input('auto_sync', sql.Bit, autoSync || false)
      .input('sync_interval', sql.Int, syncIntervalMinutes || 60)
      .query(`
        INSERT INTO spond_config (username, password, auto_sync, sync_interval_minutes, is_active)
        VALUES (@username, @password, @auto_sync, @sync_interval, 1)
      `);
    
    // Store token for session
    spondToken = token;
    
    console.log('[Spond] Configuration saved successfully');
    
    res.json({
      success: true,
      message: 'Spond configured successfully',
      groupCount: groups.length
    });
  } catch (err) {
    console.error('[Spond] Configuration error:', err);
    res.status(500).json({ error: err.message || 'Failed to configure Spond' });
  }
});

// Remove Spond configuration
app.delete('/api/spond/configure', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .query('UPDATE spond_config SET is_active = 0 WHERE is_active = 1');
    
    spondToken = null;
    
    res.json({ success: true, message: 'Spond configuration removed' });
  } catch (err) {
    console.error('[Spond] Error removing configuration:', err);
    res.status(500).json({ error: 'Failed to remove Spond configuration' });
  }
});

// Get Spond groups with subgroups for team mapping
app.get('/api/spond/groups', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    if (!spondToken) {
      // Try to load from database
      const pool = await getPool();
      const configResult = await pool.request()
        .query('SELECT username, password FROM spond_config WHERE is_active = 1');
      
      if (configResult.recordset.length === 0) {
        return res.status(400).json({ error: 'Spond not configured' });
      }
      
      const { username, password } = configResult.recordset[0];
      spondToken = await spondLogin(username, password);
    }
    
    const groups = await spondRequest(spondToken, 'groups');
    
    // Get local team mappings
    const pool = await getPool();
    const mappings = await pool.request()
      .query('SELECT id, name, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    
    const mappingMap = new Map(
      mappings.recordset.map(m => [m.spond_group_id, { id: m.id, name: m.name }])
    );

    // Flatten groups and subgroups - return subgroups as the linkable items
    const subgroupsWithMappings = [];
    
    for (const group of groups) {
      // Log the group structure for debugging
      console.log('[Spond Groups] Group:', group.name, 
        'members:', group.members?.length || 0,
        'subGroups:', group.subGroups?.length || 0);
      
      // If there are subgroups, use those as the teams
      if (group.subGroups && group.subGroups.length > 0) {
        for (const subgroup of group.subGroups) {
          // Subgroup members is an array of member IDs (strings)
          // Count them directly, or if it's empty, try to count from parent group
          const subgroupMemberIds = subgroup.members || [];
          const memberCount = Array.isArray(subgroupMemberIds) ? subgroupMemberIds.length : 0;
          
          console.log('[Spond Groups]   Subgroup:', subgroup.name, 
            'memberIds:', subgroupMemberIds.length,
            'raw members:', JSON.stringify(subgroup.members)?.substring(0, 100));
          
          subgroupsWithMappings.push({
            id: subgroup.id,
            name: subgroup.name,
            parentGroup: group.name,
            activity: group.activity,
            memberCount: memberCount,
            linkedTeam: mappingMap.get(subgroup.id) || null,
          });
        }
      } else {
        // If no subgroups, use the group itself
        subgroupsWithMappings.push({
          id: group.id,
          name: group.name,
          parentGroup: null,
          activity: group.activity,
          memberCount: group.members?.length || 0,
          linkedTeam: mappingMap.get(group.id) || null,
        });
      }
    }
    
    res.json(subgroupsWithMappings);
  } catch (err) {
    console.error('[Spond] Error fetching groups:', err);
    spondToken = null; // Reset token on error
    res.status(500).json({ error: 'Failed to fetch Spond groups' });
  }
});

// Link a local team to a Spond group/subgroup
app.post('/api/spond/link/team', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const { teamId, spondGroupId } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, teamId)
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .query('UPDATE teams SET spond_group_id = @spond_group_id WHERE id = @id');

    res.json({ success: true, message: 'Team linked to Spond group' });
  } catch (err) {
    console.error('[Spond] Link team error:', err);
    res.status(500).json({ error: 'Failed to link team' });
  }
});

// Unlink a team from Spond
app.delete('/api/spond/link/team/:id', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, teamId)
      .query('UPDATE teams SET spond_group_id = NULL WHERE id = @id');

    res.json({ success: true, message: 'Team unlinked from Spond' });
  } catch (err) {
    console.error('[Spond] Unlink team error:', err);
    res.status(500).json({ error: 'Failed to unlink team' });
  }
});

// Helper to ensure Spond token is available
async function ensureSpondToken() {
  if (spondToken) return spondToken;
  
  const pool = await getPool();
  const configResult = await pool.request()
    .query('SELECT username, password FROM spond_config WHERE is_active = 1');
  
  if (configResult.recordset.length === 0) {
    return null;
  }
  
  const { username, password } = configResult.recordset[0];
  spondToken = await spondLogin(username, password);
  return spondToken;
}

// Full sync from Spond
app.post('/api/spond/sync', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { syncGroups, syncEvents, daysAhead } = req.body;
    const results = { groups: { imported: 0 }, events: { imported: 0, updated: 0 } };
    const pool = await getPool();

    // Sync groups if requested
    if (syncGroups !== false) {
      const groups = await spondRequest(token, 'groups');
      results.groups.imported = groups.length;
    }

    // Sync events if requested
    if (syncEvents !== false) {
      const days = daysAhead || 60;
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 7);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + days);
      
      // Get events from Spond for linked teams
      const teamsResult = await pool.request()
        .query('SELECT id, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
      
      for (const team of teamsResult.recordset) {
        try {
          const events = await spondRequest(token, 
            `sponds?groupId=${team.spond_group_id}&minEndTimestamp=${minDate.toISOString()}&maxEndTimestamp=${maxDate.toISOString()}&includeComments=false&includeHidden=false`
          );
          
          for (const spondEvent of events) {
            // Check if event exists
            const existing = await pool.request()
              .input('spond_id', sql.NVarChar, spondEvent.id)
              .query('SELECT id FROM events WHERE spond_id = @spond_id');
            
            if (existing.recordset.length > 0) {
              results.events.updated++;
            } else {
              results.events.imported++;
            }
            
            // Upsert event
            await pool.request()
              .input('spond_id', sql.NVarChar, spondEvent.id)
              .input('name', sql.NVarChar, spondEvent.heading || 'Spond Event')
              .input('description', sql.NVarChar, spondEvent.description || '')
              .input('team_id', sql.Int, team.id)
              .input('start_time', sql.DateTime, new Date(spondEvent.startTimestamp))
              .input('end_time', sql.DateTime, new Date(spondEvent.endTimestamp))
              .input('event_type', sql.NVarChar, spondEvent.type === 'MATCH' ? 'Game' : 'Practice')
              .input('status', sql.NVarChar, spondEvent.cancelled ? 'Cancelled' : 'Confirmed')
              .input('spond_group_id', sql.NVarChar, team.spond_group_id)
              .query(`
                MERGE events AS target
                USING (SELECT @spond_id AS spond_id) AS source
                ON target.spond_id = source.spond_id
                WHEN MATCHED THEN
                  UPDATE SET 
                    name = @name,
                    description = @description,
                    start_time = @start_time,
                    end_time = @end_time,
                    event_type = @event_type,
                    status = @status,
                    updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                  INSERT (spond_id, name, description, team_id, start_time, end_time, event_type, status, spond_group_id, created_at, updated_at)
                  VALUES (@spond_id, @name, @description, @team_id, @start_time, @end_time, @event_type, @status, @spond_group_id, GETDATE(), GETDATE());
              `);
          }
        } catch (err) {
          console.error(`[Spond] Error syncing events for team ${team.id}:`, err.message);
        }
      }
    }

    // Update last sync time
    await pool.request().query('UPDATE spond_config SET last_sync = GETDATE() WHERE is_active = 1');

    res.json({
      success: true,
      groups: results.groups,
      events: results.events
    });
  } catch (err) {
    console.error('[Spond] Sync error:', err);
    spondToken = null;
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// Sync only groups from Spond
app.post('/api/spond/sync/groups', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const groups = await spondRequest(token, 'groups');
    
    res.json({
      success: true,
      imported: groups.length,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        subGroups: g.subGroups?.length || 0
      }))
    });
  } catch (err) {
    console.error('[Spond] Groups sync error:', err);
    spondToken = null;
    res.status(500).json({ error: 'Groups sync failed' });
  }
});

// Sync only events from Spond
app.post('/api/spond/sync/events', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { groupId, daysAhead, daysBehind } = req.body;
    const pool = await getPool();
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (daysBehind || 7));
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (daysAhead || 60));
    
    // Ensure name column exists in events table (for Spond event heading)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'name')
      BEGIN
        ALTER TABLE events ADD name NVARCHAR(255) NULL;
      END
    `);
    
    let teamsToSync = [];
    
    if (groupId) {
      teamsToSync = [{ id: null, spond_group_id: groupId }];
    } else {
      const teamsResult = await pool.request()
        .query('SELECT id, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
      teamsToSync = teamsResult.recordset;
    }
    
    const results = { imported: 0, updated: 0, errors: [] };
    
    for (const team of teamsToSync) {
      try {
        const events = await spondRequest(token, 
          `sponds?groupId=${team.spond_group_id}&minEndTimestamp=${minDate.toISOString()}&maxEndTimestamp=${maxDate.toISOString()}&includeComments=false&includeHidden=false`
        );
        
        for (const spondEvent of events) {
          const existing = await pool.request()
            .input('spond_id', sql.NVarChar, spondEvent.id)
            .query('SELECT id FROM events WHERE spond_id = @spond_id');
          
          if (existing.recordset.length > 0) {
            results.updated++;
          } else {
            results.imported++;
          }
          
          await pool.request()
            .input('spond_id', sql.NVarChar, spondEvent.id)
            .input('name', sql.NVarChar, spondEvent.heading || 'Spond Event')
            .input('description', sql.NVarChar, spondEvent.description || '')
            .input('team_id', sql.Int, team.id)
            .input('start_time', sql.DateTime, new Date(spondEvent.startTimestamp))
            .input('end_time', sql.DateTime, new Date(spondEvent.endTimestamp))
            .input('event_type', sql.NVarChar, spondEvent.type === 'MATCH' ? 'Game' : 'Practice')
            .input('status', sql.NVarChar, spondEvent.cancelled ? 'Cancelled' : 'Confirmed')
            .input('spond_group_id', sql.NVarChar, team.spond_group_id)
            .query(`
              MERGE events AS target
              USING (SELECT @spond_id AS spond_id) AS source
              ON target.spond_id = source.spond_id
              WHEN MATCHED THEN
                UPDATE SET 
                  name = @name,
                  description = @description,
                  start_time = @start_time,
                  end_time = @end_time,
                  event_type = @event_type,
                  status = @status,
                  updated_at = GETDATE()
              WHEN NOT MATCHED THEN
                INSERT (spond_id, name, description, team_id, start_time, end_time, event_type, status, spond_group_id, created_at, updated_at)
                VALUES (@spond_id, @name, @description, @team_id, @start_time, @end_time, @event_type, @status, @spond_group_id, GETDATE(), GETDATE());
            `);
        }
      } catch (err) {
        console.error(`[Spond] Error syncing events for group ${team.spond_group_id}:`, err.message);
        results.errors.push({ groupId: team.spond_group_id, error: err.message });
      }
    }

    res.json({
      success: true,
      imported: results.imported,
      updated: results.updated,
      errors: results.errors
    });
  } catch (err) {
    console.error('[Spond] Events sync error:', err);
    spondToken = null;
    res.status(500).json({ error: 'Events sync failed' });
  }
});

// Sync attendance for a single event
app.post('/api/spond/sync/attendance/event/:id', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const eventId = parseInt(req.params.id);
    const pool = await getPool();
    
    // Get event with spond_id
    const eventResult = await pool.request()
      .input('id', sql.Int, eventId)
      .query('SELECT id, spond_id, spond_group_id FROM events WHERE id = @id');
    
    if (eventResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.recordset[0];
    
    if (!event.spond_id) {
      return res.status(400).json({ error: 'Event not linked to Spond' });
    }
    
    // Fetch event details from Spond
    const spondEvent = await spondRequest(token, `sponds/${event.spond_id}`);
    
    // Count attendance
    const responses = spondEvent.responses || {};
    const accepted = responses.acceptedIds?.length || 0;
    const declined = responses.declinedIds?.length || 0;
    const unanswered = responses.unansweredIds?.length || 0;
    const waiting = responses.waitinglistIds?.length || 0;
    
    // Update event with attendance counts
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('accepted', sql.Int, accepted)
      .input('declined', sql.Int, declined)
      .input('unanswered', sql.Int, unanswered)
      .input('waiting', sql.Int, waiting)
      .query(`
        UPDATE events SET 
          attendance_accepted = @accepted,
          attendance_declined = @declined,
          attendance_unanswered = @unanswered,
          attendance_waiting = @waiting,
          attendance_last_sync = GETDATE()
        WHERE id = @id
      `);

    res.json({
      success: true,
      eventId,
      attendance: { accepted, declined, unanswered, waiting },
      message: 'Attendance synced successfully'
    });
  } catch (err) {
    console.error('[Spond] Sync attendance error:', err);
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
});

// Sync attendance for all Spond-linked events
app.post('/api/spond/sync/attendance', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { onlyFutureEvents, daysAhead, daysBehind } = req.body;
    const pool = await getPool();
    
    // Get events with spond_id
    let query = 'SELECT id, spond_id FROM events WHERE spond_id IS NOT NULL';
    
    if (onlyFutureEvents !== false) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - (daysBehind || 7));
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + (daysAhead || 30));
      query += ` AND start_time >= '${minDate.toISOString()}' AND start_time <= '${maxDate.toISOString()}'`;
    }
    
    const eventsResult = await pool.request().query(query);
    
    const results = { updated: 0, errors: [] };
    
    for (const event of eventsResult.recordset) {
      try {
        const spondEvent = await spondRequest(token, `sponds/${event.spond_id}`);
        
        const responses = spondEvent.responses || {};
        const accepted = responses.acceptedIds?.length || 0;
        const declined = responses.declinedIds?.length || 0;
        const unanswered = responses.unansweredIds?.length || 0;
        const waiting = responses.waitinglistIds?.length || 0;
        
        await pool.request()
          .input('id', sql.Int, event.id)
          .input('accepted', sql.Int, accepted)
          .input('declined', sql.Int, declined)
          .input('unanswered', sql.Int, unanswered)
          .input('waiting', sql.Int, waiting)
          .query(`
            UPDATE events SET 
              attendance_accepted = @accepted,
              attendance_declined = @declined,
              attendance_unanswered = @unanswered,
              attendance_waiting = @waiting,
              attendance_last_sync = GETDATE()
            WHERE id = @id
          `);
        
        results.updated++;
      } catch (err) {
        console.error(`[Spond] Error syncing attendance for event ${event.id}:`, err.message);
        results.errors.push({ eventId: event.id, error: err.message });
      }
    }

    res.json({
      success: results.errors.length === 0,
      message: `Synced attendance for ${results.updated} events`,
      eventsUpdated: results.updated,
      errors: results.errors
    });
  } catch (err) {
    console.error('[Spond] Sync all attendance error:', err);
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
});

// Get Spond events directly (for preview before sync)
app.get('/api/spond/events', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { groupId, daysAhead, daysBehind } = req.query;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (parseInt(daysBehind) || 7));
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (parseInt(daysAhead) || 60));
    
    const events = await spondRequest(token, 
      `sponds?groupId=${groupId}&minEndTimestamp=${minDate.toISOString()}&maxEndTimestamp=${maxDate.toISOString()}&includeComments=false&includeHidden=false`
    );
    
    res.json(events.map(e => ({
      id: e.id,
      heading: e.heading,
      description: e.description,
      startTimestamp: e.startTimestamp,
      endTimestamp: e.endTimestamp,
      type: e.type,
      cancelled: e.cancelled
    })));
  } catch (err) {
    console.error('[Spond] Error fetching events:', err);
    spondToken = null;
    res.status(500).json({ error: 'Failed to fetch Spond events' });
  }
});

// =====================================================
// Spond Sync Settings - Granular per-team configuration
// =====================================================

// Get all sync settings
app.get('/api/spond/sync-settings', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ss.*, t.name as team_name
      FROM spond_sync_settings ss
      JOIN teams t ON ss.team_id = t.id
      ORDER BY t.name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[Spond] Error fetching sync settings:', err);
    res.status(500).json({ error: 'Failed to fetch sync settings' });
  }
});

// Get sync settings for a specific team
app.get('/api/spond/sync-settings/:teamId', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const pool = await getPool();
    const result = await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT * FROM spond_sync_settings WHERE team_id = @team_id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Sync settings not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('[Spond] Error fetching sync settings:', err);
    res.status(500).json({ error: 'Failed to fetch sync settings' });
  }
});

// Create or update sync settings for a team
app.post('/api/spond/sync-settings', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const {
      teamId,
      spondGroupId,
      spondGroupName,
      spondParentGroupName,
      isSubgroup,
      syncEventsImport,
      syncEventsExport,
      syncAttendanceImport,
      syncEventTitle,
      syncEventDescription,
      syncEventTime,
      syncEventLocation,
      syncEventType,
      isActive
    } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    const pool = await getPool();
    
    // Check if settings already exist
    const existing = await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT id FROM spond_sync_settings WHERE team_id = @team_id');
    
    if (existing.recordset.length > 0) {
      // Update existing
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, spondGroupId)
        .input('spond_group_name', sql.NVarChar, spondGroupName || null)
        .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup || false)
        .input('sync_events_import', sql.Bit, syncEventsImport !== false)
        .input('sync_events_export', sql.Bit, syncEventsExport || false)
        .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
        .input('sync_event_title', sql.Bit, syncEventTitle !== false)
        .input('sync_event_description', sql.Bit, syncEventDescription !== false)
        .input('sync_event_time', sql.Bit, syncEventTime !== false)
        .input('sync_event_location', sql.Bit, syncEventLocation !== false)
        .input('sync_event_type', sql.Bit, syncEventType !== false)
        .input('is_active', sql.Bit, isActive !== false)
        .query(`
          UPDATE spond_sync_settings SET
            spond_group_id = @spond_group_id,
            spond_group_name = @spond_group_name,
            spond_parent_group_name = @spond_parent_group_name,
            is_subgroup = @is_subgroup,
            sync_events_import = @sync_events_import,
            sync_events_export = @sync_events_export,
            sync_attendance_import = @sync_attendance_import,
            sync_event_title = @sync_event_title,
            sync_event_description = @sync_event_description,
            sync_event_time = @sync_event_time,
            sync_event_location = @sync_event_location,
            sync_event_type = @sync_event_type,
            is_active = @is_active,
            updated_at = GETDATE()
          WHERE team_id = @team_id
        `);
    } else {
      // Insert new
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, spondGroupId)
        .input('spond_group_name', sql.NVarChar, spondGroupName || null)
        .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup || false)
        .input('sync_events_import', sql.Bit, syncEventsImport !== false)
        .input('sync_events_export', sql.Bit, syncEventsExport || false)
        .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
        .input('sync_event_title', sql.Bit, syncEventTitle !== false)
        .input('sync_event_description', sql.Bit, syncEventDescription !== false)
        .input('sync_event_time', sql.Bit, syncEventTime !== false)
        .input('sync_event_location', sql.Bit, syncEventLocation !== false)
        .input('sync_event_type', sql.Bit, syncEventType !== false)
        .input('is_active', sql.Bit, isActive !== false)
        .query(`
          INSERT INTO spond_sync_settings (
            team_id, spond_group_id, spond_group_name, spond_parent_group_name, is_subgroup,
            sync_events_import, sync_events_export, sync_attendance_import,
            sync_event_title, sync_event_description, sync_event_time, sync_event_location, sync_event_type,
            is_active
          ) VALUES (
            @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_name, @is_subgroup,
            @sync_events_import, @sync_events_export, @sync_attendance_import,
            @sync_event_title, @sync_event_description, @sync_event_time, @sync_event_location, @sync_event_type,
            @is_active
          )
        `);
    }
    
    // Also update the teams table spond_group_id for backwards compatibility
    await pool.request()
      .input('id', sql.Int, teamId)
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .query('UPDATE teams SET spond_group_id = @spond_group_id WHERE id = @id');
    
    res.json({ success: true, message: 'Sync settings saved' });
  } catch (err) {
    console.error('[Spond] Error saving sync settings:', err);
    res.status(500).json({ error: 'Failed to save sync settings' });
  }
});

// Delete sync settings for a team
app.delete('/api/spond/sync-settings/:teamId', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const pool = await getPool();
    
    await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('DELETE FROM spond_sync_settings WHERE team_id = @team_id');
    
    // Also clear spond_group_id from teams table
    await pool.request()
      .input('id', sql.Int, teamId)
      .query('UPDATE teams SET spond_group_id = NULL WHERE id = @id');
    
    res.json({ success: true, message: 'Sync settings deleted' });
  } catch (err) {
    console.error('[Spond] Error deleting sync settings:', err);
    res.status(500).json({ error: 'Failed to delete sync settings' });
  }
});

// =====================================================
// Import Teams from Spond
// =====================================================

// Get Spond groups/subgroups available for import (not yet linked)
app.get('/api/spond/groups-for-import', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }
    
    const groups = await spondRequest(token, 'groups');
    const pool = await getPool();
    
    // Get already linked group IDs
    const linkedResult = await pool.request()
      .query('SELECT spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    const linkedIds = new Set(linkedResult.recordset.map(r => r.spond_group_id));
    
    // Build list of importable groups/subgroups
    const importableGroups = [];
    
    for (const group of groups) {
      if (group.subGroups && group.subGroups.length > 0) {
        for (const subgroup of group.subGroups) {
          if (!linkedIds.has(subgroup.id)) {
            importableGroups.push({
              id: subgroup.id,
              name: subgroup.name,
              parentGroup: group.name,
              isSubgroup: true,
              memberCount: subgroup.members?.length || 0,
              activity: group.activity
            });
          }
        }
      } else {
        if (!linkedIds.has(group.id)) {
          importableGroups.push({
            id: group.id,
            name: group.name,
            parentGroup: null,
            isSubgroup: false,
            memberCount: group.members?.length || 0,
            activity: group.activity
          });
        }
      }
    }
    
    res.json(importableGroups);
  } catch (err) {
    console.error('[Spond] Error fetching groups for import:', err);
    spondToken = null;
    res.status(500).json({ error: 'Failed to fetch Spond groups' });
  }
});

// Import a team from Spond (creates new local team + sync settings)
app.post('/api/spond/import-team', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const {
      spondGroupId,
      spondGroupName,
      spondParentGroupName,
      isSubgroup,
      sport,
      syncEventsImport,
      syncEventsExport,
      syncAttendanceImport
    } = req.body;

    if (!spondGroupId || !spondGroupName) {
      return res.status(400).json({ error: 'spondGroupId and spondGroupName are required' });
    }

    const pool = await getPool();
    
    // Check if group is already linked
    const existing = await pool.request()
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .query('SELECT id FROM teams WHERE spond_group_id = @spond_group_id');
    
    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: 'This Spond group is already linked to a team' });
    }
    
    // Create new team
    const teamResult = await pool.request()
      .input('name', sql.NVarChar, spondGroupName)
      .input('sport', sql.NVarChar, sport || 'Tackle Football')
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .input('imported_from_spond', sql.Bit, 1)
      .input('is_active', sql.Bit, 1)
      .query(`
        INSERT INTO teams (name, sport, spond_group_id, imported_from_spond, spond_import_date, is_active)
        OUTPUT INSERTED.id, INSERTED.name
        VALUES (@name, @sport, @spond_group_id, @imported_from_spond, GETDATE(), @is_active)
      `);
    
    const newTeamId = teamResult.recordset[0].id;
    
    // Create sync settings
    await pool.request()
      .input('team_id', sql.Int, newTeamId)
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .input('spond_group_name', sql.NVarChar, spondGroupName)
      .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
      .input('is_subgroup', sql.Bit, isSubgroup || false)
      .input('sync_events_import', sql.Bit, syncEventsImport !== false)
      .input('sync_events_export', sql.Bit, syncEventsExport || false)
      .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
      .query(`
        INSERT INTO spond_sync_settings (
          team_id, spond_group_id, spond_group_name, spond_parent_group_name, is_subgroup,
          sync_events_import, sync_events_export, sync_attendance_import, is_active
        ) VALUES (
          @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_name, @is_subgroup,
          @sync_events_import, @sync_events_export, @sync_attendance_import, 1
        )
      `);
    
    res.json({
      success: true,
      message: `Team "${spondGroupName}" imported from Spond`,
      team: { id: newTeamId, name: spondGroupName }
    });
  } catch (err) {
    console.error('[Spond] Error importing team:', err);
    res.status(500).json({ error: 'Failed to import team from Spond' });
  }
});

// Bulk import teams from Spond
app.post('/api/spond/import-teams', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const { groups, sport, syncEventsImport, syncEventsExport, syncAttendanceImport } = req.body;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'groups array is required' });
    }

    const pool = await getPool();
    const results = { imported: 0, skipped: 0, errors: [] };
    
    for (const group of groups) {
      try {
        // Check if already linked
        const existing = await pool.request()
          .input('spond_group_id', sql.NVarChar, group.id)
          .query('SELECT id FROM teams WHERE spond_group_id = @spond_group_id');
        
        if (existing.recordset.length > 0) {
          results.skipped++;
          continue;
        }
        
        // Create team
        const teamResult = await pool.request()
          .input('name', sql.NVarChar, group.name)
          .input('sport', sql.NVarChar, sport || 'Tackle Football')
          .input('spond_group_id', sql.NVarChar, group.id)
          .input('imported_from_spond', sql.Bit, 1)
          .input('is_active', sql.Bit, 1)
          .query(`
            INSERT INTO teams (name, sport, spond_group_id, imported_from_spond, spond_import_date, is_active)
            OUTPUT INSERTED.id
            VALUES (@name, @sport, @spond_group_id, @imported_from_spond, GETDATE(), @is_active)
          `);
        
        const newTeamId = teamResult.recordset[0].id;
        
        // Create sync settings
        await pool.request()
          .input('team_id', sql.Int, newTeamId)
          .input('spond_group_id', sql.NVarChar, group.id)
          .input('spond_group_name', sql.NVarChar, group.name)
          .input('spond_parent_group_name', sql.NVarChar, group.parentGroup || null)
          .input('is_subgroup', sql.Bit, group.isSubgroup || false)
          .input('sync_events_import', sql.Bit, syncEventsImport !== false)
          .input('sync_events_export', sql.Bit, syncEventsExport || false)
          .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
          .query(`
            INSERT INTO spond_sync_settings (
              team_id, spond_group_id, spond_group_name, spond_parent_group_name, is_subgroup,
              sync_events_import, sync_events_export, sync_attendance_import, is_active
            ) VALUES (
              @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_name, @is_subgroup,
              @sync_events_import, @sync_events_export, @sync_attendance_import, 1
            )
          `);
        
        results.imported++;
      } catch (err) {
        console.error(`[Spond] Error importing team ${group.name}:`, err.message);
        results.errors.push({ name: group.name, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Imported ${results.imported} teams, skipped ${results.skipped}`,
      ...results
    });
  } catch (err) {
    console.error('[Spond] Error bulk importing teams:', err);
    res.status(500).json({ error: 'Failed to import teams' });
  }
});

// Sync with granular settings (respects per-team import/export settings)
app.post('/api/spond/sync-with-settings', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const token = await ensureSpondToken();
    if (!token) {
      return res.status(400).json({ error: 'Spond not configured' });
    }

    const { daysAhead, daysBehind, direction } = req.body;
    const pool = await getPool();
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (daysBehind || 7));
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (daysAhead || 60));
    
    // Get all active sync settings
    const settingsResult = await pool.request().query(`
      SELECT ss.*, t.id as team_id, t.name as team_name
      FROM spond_sync_settings ss
      JOIN teams t ON ss.team_id = t.id
      WHERE ss.is_active = 1
    `);
    
    const results = {
      imported: 0,
      exported: 0,
      attendanceUpdated: 0,
      errors: []
    };
    
    for (const settings of settingsResult.recordset) {
      try {
        // Import events from Spond
        if (settings.sync_events_import && (direction === 'import' || direction === 'both' || !direction)) {
          const events = await spondRequest(token, 
            `sponds?groupId=${settings.spond_group_id}&minEndTimestamp=${minDate.toISOString()}&maxEndTimestamp=${maxDate.toISOString()}&includeComments=false&includeHidden=false`
          );
          
          for (const spondEvent of events) {
            await pool.request()
              .input('spond_id', sql.NVarChar, spondEvent.id)
              .input('name', sql.NVarChar, settings.sync_event_title ? (spondEvent.heading || 'Spond Event') : null)
              .input('description', sql.NVarChar, settings.sync_event_description ? (spondEvent.description || '') : null)
              .input('team_id', sql.Int, settings.team_id)
              .input('start_time', sql.DateTime, settings.sync_event_time ? new Date(spondEvent.startTimestamp) : null)
              .input('end_time', sql.DateTime, settings.sync_event_time ? new Date(spondEvent.endTimestamp) : null)
              .input('event_type', sql.NVarChar, settings.sync_event_type ? (spondEvent.type === 'MATCH' ? 'Game' : 'Practice') : null)
              .input('status', sql.NVarChar, spondEvent.cancelled ? 'Cancelled' : 'Confirmed')
              .input('spond_group_id', sql.NVarChar, settings.spond_group_id)
              .query(`
                MERGE events AS target
                USING (SELECT @spond_id AS spond_id) AS source
                ON target.spond_id = source.spond_id
                WHEN MATCHED THEN
                  UPDATE SET 
                    name = COALESCE(@name, target.name),
                    description = COALESCE(@description, target.description),
                    start_time = COALESCE(@start_time, target.start_time),
                    end_time = COALESCE(@end_time, target.end_time),
                    event_type = COALESCE(@event_type, target.event_type),
                    status = @status,
                    updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                  INSERT (spond_id, name, description, team_id, start_time, end_time, event_type, status, spond_group_id, created_at, updated_at)
                  VALUES (@spond_id, COALESCE(@name, 'Spond Event'), @description, @team_id, @start_time, @end_time, COALESCE(@event_type, 'Practice'), @status, @spond_group_id, GETDATE(), GETDATE());
              `);
            results.imported++;
          }
          
          // Update last import timestamp
          await pool.request()
            .input('team_id', sql.Int, settings.team_id)
            .query('UPDATE spond_sync_settings SET last_import_sync = GETDATE() WHERE team_id = @team_id');
        }
        
        // Sync attendance
        if (settings.sync_attendance_import && (direction === 'import' || direction === 'both' || !direction)) {
          const eventsWithSpond = await pool.request()
            .input('team_id', sql.Int, settings.team_id)
            .input('min_date', sql.DateTime, minDate)
            .input('max_date', sql.DateTime, maxDate)
            .query(`
              SELECT id, spond_id FROM events 
              WHERE team_id = @team_id 
              AND spond_id IS NOT NULL
              AND start_time >= @min_date AND start_time <= @max_date
            `);
          
          for (const event of eventsWithSpond.recordset) {
            try {
              const spondEvent = await spondRequest(token, `sponds/${event.spond_id}`);
              const responses = spondEvent.responses || {};
              
              await pool.request()
                .input('id', sql.Int, event.id)
                .input('accepted', sql.Int, responses.acceptedIds?.length || 0)
                .input('declined', sql.Int, responses.declinedIds?.length || 0)
                .input('unanswered', sql.Int, responses.unansweredIds?.length || 0)
                .input('waiting', sql.Int, responses.waitinglistIds?.length || 0)
                .query(`
                  UPDATE events SET 
                    attendance_accepted = @accepted,
                    attendance_declined = @declined,
                    attendance_unanswered = @unanswered,
                    attendance_waiting = @waiting,
                    attendance_last_sync = GETDATE()
                  WHERE id = @id
                `);
              results.attendanceUpdated++;
            } catch (e) {
              // Skip individual attendance errors
            }
          }
          
          // Update last attendance timestamp
          await pool.request()
            .input('team_id', sql.Int, settings.team_id)
            .query('UPDATE spond_sync_settings SET last_attendance_sync = GETDATE() WHERE team_id = @team_id');
        }
        
        // TODO: Export events to Spond (when settings.sync_events_export is true)
        // This would require Spond API write access
        
      } catch (err) {
        console.error(`[Spond] Error syncing team ${settings.team_name}:`, err.message);
        results.errors.push({ team: settings.team_name, error: err.message });
      }
    }
    
    // Update global last sync
    await pool.request().query('UPDATE spond_config SET last_sync = GETDATE() WHERE is_active = 1');
    
    res.json({
      success: true,
      message: `Sync complete`,
      ...results
    });
  } catch (err) {
    console.error('[Spond] Sync with settings error:', err);
    spondToken = null;
    res.status(500).json({ error: 'Sync failed' });
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

// ------------------------------
// Generic LLM endpoint for frontend use
// ------------------------------
app.post('/api/llm/complete', async (req, res) => {
  try {
    const { prompt, jsonMode } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    if (!AzureOpenAI || !azureEndpoint || !azureApiKey) {
      return res.status(503).json({ error: 'LLM service not configured' });
    }

    const client = new AzureOpenAI({
      endpoint: azureEndpoint,
      apiKey: azureApiKey,
      apiVersion: '2024-08-01-preview',
    });

    const response = await client.chat.completions.create({
      model: azureDeployment,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.7,
      ...(jsonMode && { response_format: { type: 'json_object' } })
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No response from LLM' });
    }

    // Clean markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) content = content.slice(7);
    else if (content.startsWith('```')) content = content.slice(3);
    if (content.endsWith('```')) content = content.slice(0, -3);
    content = content.trim();

    res.json({ content });
  } catch (error) {
    console.error('[LLM] Error:', error);
    res.status(500).json({ error: 'LLM request failed' });
  }
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
