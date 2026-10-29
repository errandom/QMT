// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readConfig } = require('./server/config.cjs');
const { createLazyPool } = require('./server/pool.cjs');
const { createLimiter, eventRange, validateEvent } = require('./server/limits.cjs');
const { createLogger } = require('./server/logger.cjs');
const { registerBookingRoutes } = require('./server/bookings.cjs');
const { registerRequestRoutes } = require('./server/requests.cjs');
const { siteScheduleSchema, registerPublishedScheduleRoutes } = require('./server/published-schedules.cjs');

function createApp({ env = process.env, connect } = {}) {
const config = readConfig(env);
const console = createLogger();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Express basics
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

// JWT Secret for authentication
const JWT_SECRET = config.jwtSecret;

// ------------------------------
// Azure SQL connection settings
// ------------------------------
const sqlConfig = {
  server: env.SQL_SERVER,
  database: env.SQL_DATABASE,
  user: env.SQL_USER,
  password: env.SQL_PASSWORD,
  connectionTimeout: 10000,
  requestTimeout: 10000,
  options: {
    encrypt: true,                          // REQUIRED for Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true
  },
  pool: {
    max: config.poolMax,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const database = createLazyPool(connect || (async () => {
  if (!sqlConfig.server || !sqlConfig.database || !sqlConfig.user || !sqlConfig.password) {
    throw new Error('Database credentials not configured');
  }
  const pool = new sql.ConnectionPool(sqlConfig);
  try { return await pool.connect(); }
  catch (error) { await pool.close(); throw error; }
}), console.error);
const getPool = database.getPool;
app.locals.close = database.close;

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const collection = req.path.split('/')[1];
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 500) return json({ error: 'Service unavailable; retry later' });
    if (req.method === 'GET' && !req.headers.authorization) {
      const allowed = {
        teams: ['id', 'name', 'sport', 'age_group', 'active'],
        sites: ['id', 'name', 'address', 'city', 'zip_code', 'latitude', 'longitude', 'is_sports_facility', 'amenities', 'active'],
        fields: ['id', 'name', 'site_id', 'location_type', 'field_type', 'surface_type', 'has_lights', 'capacity', 'active'],
        equipment: ['id', 'name', 'category', 'quantity', 'condition', 'location'],
        events: ['id', 'description', 'event_type', 'status', 'start_time', 'end_time', 'field_id', 'field_ids', 'team_id', 'team_ids', 'recurring_days', 'recurring_end_date', 'game_location', 'away_street', 'away_zip', 'away_city'],
      }[collection];
      if (allowed && res.statusCode < 400) {
        const clean = value => Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
        return json(Array.isArray(body) ? body.map(clean) : clean(body));
      }
      return json(body);
    }
    return json(body);
  };
  next();
});

app.get('/api/capabilities', (_req, res) => res.json({
  ai: config.aiEnabled, spond: config.spondEnabled, weather: false,
  clubName: config.clubName, timezone: config.timezone,
  transport: Boolean(config.transportEmail),
}));

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return apiLimit(req, res, next);
});
const apiLimit = createLimiter({ limit: config.requestsPerMinute, key: () => 'application' });
const loginLimit = createLimiter({ limit: 5 });
const submissionLimit = createLimiter({ limit: 10 });
app.use('/api', (req, res, next) => {
  if (req.path === '/warmup') return res.status(404).json({ error: 'Warmup is intentionally disabled' });
  if (req.path === '/llm/complete') return res.status(410).json({ error: 'Generic model completion has been retired' });
  if (req.path.startsWith('/spond') && !config.spondEnabled) {
    return res.status(503).json({ error: 'Spond is disabled by deployment policy' });
  }
  if (req.path === '/events/create-from-natural-language') {
    return res.status(410).json({ error: 'Legacy AI event creation is retired; use the reviewed booking editor' });
  }
  if (req.path === '/auth/login') return loginLimit(req, res, next);
  if (req.method === 'POST' && req.path === '/requests') return submissionLimit(req, res, next);
  const publicRead = req.method === 'GET' &&
    /^\/(health|teams(?:\/\d+)?|events(?:\/\d+)?|sites(?:\/\d+)?|fields(?:\/\d+)?|equipment(?:\/\d+)?)$/.test(req.path);
  if (publicRead && !req.headers.authorization) return next();
  verifyToken(req, res, async () => {
    try {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, req.user.id)
        .query('SELECT role, is_active, username FROM users WHERE id = @id');
      const user = result.recordset[0];
      if (!user?.is_active) return res.status(401).json({ error: 'Inactive or expired session' });
      req.user.role = user.role;
      req.user.username = user.username;
      req.authChecked = true;
      if (!publicRead && !req.path.startsWith('/auth/') && !req.path.startsWith('/settings')
          && !['admin', 'mgmt'].includes(user.role)) {
        return res.status(403).json({ error: 'Operations access required' });
      }
      next();
    } catch (error) {
      console.error('Session verification failed', error);
      res.status(503).json({ error: 'Session verification unavailable' });
    }
  });
});
app.use('/api/events', (req, res, next) => {
  if (['POST', 'PUT'].includes(req.method) && !req.path.includes('transport-request')
      && !req.path.includes('natural-language')) {
    try { validateEvent(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  }
  next();
});
registerBookingRoutes(app, { getPool, logger: console });
registerRequestRoutes(app, { getPool, logger: console });
registerPublishedScheduleRoutes(app, { getPool, logger: console, timezone: config.timezone });

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
  if (req.authChecked) return next();
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
app.get('/api/events', async (req, res) => {
  let range;
  try { range = eventRange(req.query); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    console.log('[GET /api/events] 🔄 Fetching events...');
    const pool = await getPool();
    console.log('[GET /api/events] ✓ Pool obtained');
    const result = await pool.request()
      .input('from', sql.DateTime2, range.from)
      .input('to', sql.DateTime2, range.to)
      .input('limit', sql.Int, range.limit)
      .input('after', sql.Int, range.after)
      .query(`
      SELECT TOP (@limit)
        e.*,
        f.name as field_name,
        s.name as site_name,
        s.address as site_address
      FROM events e
      OUTER APPLY (
        SELECT TOP 1 f.id, f.name, f.site_id
        FROM fields f
        WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
      ) f
      LEFT JOIN sites s ON f.site_id = s.id
      WHERE e.end_time > @from AND e.start_time < @to AND e.id > @after
      ORDER BY e.id ASC
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
        OUTER APPLY (
          SELECT TOP 1 f.id, f.name, f.site_id
          FROM fields f
          WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
        ) f
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








// Generate an operator-reviewed transport draft; this route never sends mail.
app.post('/api/events/:id/transport-request', async (req, res) => {
  if (!config.transportEmail) {
    return res.status(503).json({ error: 'A club transport contact must be configured before generating transport drafts' });
  }
  try {
    const pool = await getPool();
    
    // Fetch the event with team details
    const eventResult = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT e.*, f.name as field_name, s.name as site_name
        FROM events e
        OUTER APPLY (
              SELECT TOP 1 f.id, f.name, f.site_id
              FROM fields f
              WHERE CHARINDEX(',' + CAST(f.id AS VARCHAR) + ',', ',' + ISNULL(e.field_ids, '') + ',') > 0
            ) f
        LEFT JOIN sites s ON f.site_id = s.id
        WHERE e.id = @id
      `);
    
    if (eventResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.recordset[0];
    
    if (event.event_type !== 'Game' || event.game_location !== 'away') {
      return res.status(400).json({ error: 'Transport request is only available for away games' });
    }
    
    // Get team details with coach and manager emails
    const teamIds = event.team_ids ? event.team_ids.split(',').map(id => parseInt(id.trim())) : [];
    
    const ccRecipients = [];
    const teamNames = [];
    
    if (teamIds.length > 0) {
      const teamsResult = await pool.request()
        .query(`
          SELECT id, name, head_coach_email, head_coach_first_name, head_coach_last_name,
                 team_manager_email, team_manager_first_name, team_manager_last_name
          FROM teams 
          WHERE id IN (${teamIds.join(',')})
        `);
      
      for (const team of teamsResult.recordset) {
        teamNames.push(team.name);
        if (team.head_coach_email) {
          ccRecipients.push(team.head_coach_email);
        }
        if (team.team_manager_email) {
          ccRecipients.push(team.team_manager_email);
        }
      }
    }
    
    // Format event details
    const eventDate = new Date(event.start_time);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric', timeZone: 'UTC'
    });
    
    const startTime = eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, timeZone: 'UTC'
    });
    
    const endDate = new Date(event.end_time);
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, timeZone: 'UTC'
    });
    
    // Build the away address
    const awayAddress = [event.away_street, event.away_zip, event.away_city]
      .filter(Boolean)
      .join(', ');
    
    // Build email content
    const subject = `Transport Request: ${teamNames.join(', ')} - Away Game ${formattedDate}`;
    
    const body = `Dear Transport Team,

We would like to request transport for an upcoming away game.

EVENT DETAILS:
Team(s): ${teamNames.join(', ') || 'TBD'}
Event: ${event.description || 'Away Game'}
Date: ${formattedDate}
Time: ${startTime} - ${eventDate.toISOString().slice(0, 10) === endDate.toISOString().slice(0, 10) ? '' : endDate.toISOString().slice(0, 10) + ' '}${endTime}

DESTINATION:
${awayAddress || 'Address not specified'}

Please confirm availability and provide details for the transport arrangement.

Thank you,
${config.clubName} operations`;

    // The legacy sent_at column records draft generation, not mail delivery.
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('transport_request_sent_at', sql.DateTime, new Date())
      .query(`
        UPDATE events
        SET transport_requested = 1, transport_request_sent_at = @transport_request_sent_at
        WHERE id = @id
      `);
    
    res.json({
      success: true,
      email: {
        to: config.transportEmail,
        cc: [...new Set(ccRecipients)], // Remove duplicates
        subject: subject,
        body: body
      }
    });
    
  } catch (err) {
    console.error('Error creating transport request:', err);
    res.status(500).json({ error: 'Failed to create transport request' });
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
    const schedule = siteScheduleSchema.safeParse(req.body);
    if (!schedule.success) return res.status(400).json({ error: schedule.error.issues[0].message });
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
      .input('published_schedule_url', sql.NVarChar(2048), schedule.data.publishedScheduleUrl || null)
      .input('published_booking_name', sql.NVarChar(200), schedule.data.publishedBookingName || null)
      .input('active', sql.Bit, isActive !== false)
      .query(`
        INSERT INTO sites (
          name, address, city, zip_code, latitude, longitude,
          contact_first_name, contact_last_name, contact_phone, contact_email,
          is_sports_facility, amenities, active, published_schedule_url, published_booking_name
        )
        OUTPUT INSERTED.*
        VALUES (
          @name, @address, @city, @zip_code, @latitude, @longitude,
          @contact_first_name, @contact_last_name, @contact_phone, @contact_email,
          @is_sports_facility, @amenities, @active, @published_schedule_url, @published_booking_name
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
    const schedule = siteScheduleSchema.safeParse(req.body);
    if (!schedule.success) return res.status(400).json({ error: schedule.error.issues[0].message });
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
      .input('published_schedule_url', sql.NVarChar(2048), schedule.data.publishedScheduleUrl ?? null)
      .input('published_schedule_url_present', sql.Bit, schedule.data.publishedScheduleUrl !== undefined)
      .input('published_booking_name', sql.NVarChar(200), schedule.data.publishedBookingName ?? null)
      .input('published_booking_name_present', sql.Bit, schedule.data.publishedBookingName !== undefined)
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
            published_schedule_url = CASE WHEN @published_schedule_url_present = 1 THEN @published_schedule_url ELSE published_schedule_url END,
            published_booking_name = CASE WHEN @published_booking_name_present = 1 THEN @published_booking_name ELSE published_booking_name END,
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
    const { site_id, name, location_type, field_type, surface_type, has_lights, capacity, active } = req.body;

    console.log('[Fields POST] Received data:', JSON.stringify(req.body, null, 2));

    const pool = await getPool();
    
    // Check if location_type column exists (backward compatibility)
    const columnCheck = await pool.request().query(`
      SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'location_type'
    `);
    const hasLocationTypeColumn = columnCheck.recordset.length > 0;
    
    let result;
    if (hasLocationTypeColumn) {
      result = await pool.request()
        .input('site_id', sql.Int, site_id)
        .input('name', sql.NVarChar, name)
        .input('location_type', sql.NVarChar, location_type || 'field')
        .input('field_type', sql.NVarChar, field_type || null)
        .input('surface_type', sql.NVarChar, surface_type || null)
        .input('has_lights', sql.Bit, has_lights || false)
        .input('capacity', sql.Int, capacity || null)
        .input('active', sql.Bit, active !== false ? 1 : 0)
        .query(`
          INSERT INTO fields (site_id, name, location_type, field_type, surface_type, has_lights, capacity, active)
          OUTPUT INSERTED.*
          VALUES (@site_id, @name, @location_type, @field_type, @surface_type, @has_lights, @capacity, @active)
        `);
    } else {
      // Fallback for databases without location_type column
      result = await pool.request()
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
    }
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating field:', err);
    res.status(500).json({ error: 'Failed to create field' });
  }
});

app.put('/api/fields/:id', async (req, res) => {
  try {
    const { site_id, name, location_type, field_type, surface_type, has_lights, capacity, active } = req.body;

    console.log('[Fields PUT] Received data:', JSON.stringify(req.body, null, 2));

    const pool = await getPool();
    
    // Check if location_type column exists (backward compatibility)
    const columnCheck = await pool.request().query(`
      SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'location_type'
    `);
    const hasLocationTypeColumn = columnCheck.recordset.length > 0;
    
    let result;
    if (hasLocationTypeColumn) {
      result = await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('site_id', sql.Int, site_id)
        .input('name', sql.NVarChar, name)
        .input('location_type', sql.NVarChar, location_type || 'field')
        .input('field_type', sql.NVarChar, field_type || null)
        .input('surface_type', sql.NVarChar, surface_type || null)
        .input('has_lights', sql.Bit, has_lights || false)
        .input('capacity', sql.Int, capacity || null)
        .input('active', sql.Bit, active !== false ? 1 : 0)
        .query(`
          UPDATE fields 
          SET site_id = @site_id, 
              name = @name,
              location_type = @location_type,
              field_type = @field_type, 
              surface_type = @surface_type,
              has_lights = @has_lights,
              capacity = @capacity,
              active = @active,
              updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @id
        `);
    } else {
      // Fallback for databases without location_type column
      result = await pool.request()
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
    }

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

async function spondRequest(token, endpoint, params = {}) {
  // Add query params to include member data for groups endpoint
  let url = `${SPOND_API_BASE}${endpoint}`;
  const queryParams = new URLSearchParams(params);
  
  if (endpoint === 'groups') {
    // Request full member data from Spond
    queryParams.set('includeMembers', 'true');
  }
  
  const queryString = queryParams.toString();
  if (queryString) {
    url += '?' + queryString;
  }
  
  console.log('[Spond] Request URL:', url);
  
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Spond API error: ${response.status}`);
  }
  
  return await response.json();
}

// POST request to Spond API (for creating/updating events)
async function spondPostRequest(token, endpoint, body) {
  const url = `${SPOND_API_BASE}${endpoint}`;
  console.log('[Spond] POST Request URL:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spond API POST error: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
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
    
    // Get local team mappings - now supports 1:n (one Spond group to many teams)
    const pool = await getPool();
    const mappings = await pool.request()
      .query('SELECT id, name, spond_group_id FROM teams WHERE spond_group_id IS NOT NULL');
    
    // Build a map of spond_group_id -> array of linked teams
    const mappingMap = new Map();
    for (const m of mappings.recordset) {
      const existing = mappingMap.get(m.spond_group_id) || [];
      existing.push({ id: m.id, name: m.name });
      mappingMap.set(m.spond_group_id, existing);
    }

    // Helper to count members - handles both array of objects and array of IDs
    const countMembers = (members) => {
      if (!members) return 0;
      if (Array.isArray(members)) return members.length;
      if (typeof members === 'object') return Object.keys(members).length;
      return 0;
    };

    // Return both parent groups AND subgroups as selectable items
    // This allows users to map to either a group or a subgroup
    const allGroupsWithMappings = [];
    
    for (const group of groups) {
      // Get member count - Spond returns members as array of member objects
      const parentMemberCount = countMembers(group.members);
      
      // Log the group structure for debugging
      console.log('[Spond Groups] Group:', group.name, 
        'members:', parentMemberCount,
        'subGroups:', group.subGroups?.length || 0);
      
      const hasSubgroups = group.subGroups && group.subGroups.length > 0;
      const linkedTeams = mappingMap.get(group.id) || [];
      
      // Always add the parent group as a selectable item
      allGroupsWithMappings.push({
        id: group.id,
        name: group.name,
        parentGroup: null,
        parentGroupId: null,
        activity: group.activity,
        memberCount: parentMemberCount,
        linkedTeam: linkedTeams.length > 0 ? linkedTeams[0] : null,
        linkedTeams: linkedTeams,
        isParentGroup: true,
        hasSubgroups: hasSubgroups,
      });
      
      // If there are subgroups, also add them as selectable items
      if (hasSubgroups) {
        // Build a map of member IDs to count subgroup members
        // Parent group members have full profile data, subgroups reference by ID
        
        for (const subgroup of group.subGroups) {
          // Subgroup members can be either:
          // 1. Array of member IDs (strings) that reference parent group members
          // 2. Array of member objects with full data
          const subgroupMembers = subgroup.members || [];
          let subMemberCount = 0;
          
          if (Array.isArray(subgroupMembers)) {
            subMemberCount = subgroupMembers.length;
          }
          
          const subLinkedTeams = mappingMap.get(subgroup.id) || [];
          
          console.log('[Spond Groups]   Subgroup:', subgroup.name, 
            'members:', subMemberCount);
          
          allGroupsWithMappings.push({
            id: subgroup.id,
            name: subgroup.name,
            parentGroup: group.name,
            parentGroupId: group.id,
            activity: group.activity,
            memberCount: subMemberCount,
            linkedTeam: subLinkedTeams.length > 0 ? subLinkedTeams[0] : null,
            linkedTeams: subLinkedTeams,
            isParentGroup: false,
            hasSubgroups: false,
          });
        }
      }
    }
    
    res.json(allGroupsWithMappings);
  } catch (err) {
    console.error('[Spond] Error fetching groups:', err);
    spondToken = null; // Reset token on error
    res.status(500).json({ error: 'Failed to fetch Spond groups' });
  }
});

// Link a local team to a Spond group/subgroup
app.post('/api/spond/link/team', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const { teamId, spondGroupId, parentGroupId, groupName, parentGroupName } = req.body;

    if (!teamId || !spondGroupId) {
      return res.status(400).json({ error: 'teamId and spondGroupId are required' });
    }

    // Normalize Spond IDs to consistent format (uppercase, no hyphens)
    const normalizedGroupId = normalizeSpondUUID(spondGroupId);
    const normalizedParentGroupId = normalizeSpondUUID(parentGroupId);

    if (!normalizedGroupId) {
      return res.status(400).json({ error: 'Invalid spondGroupId format' });
    }

    const pool = await getPool();
    
    // Update the team's spond_group_id with normalized ID
    await pool.request()
      .input('id', sql.Int, teamId)
      .input('spond_group_id', sql.NVarChar, normalizedGroupId)
      .query('UPDATE teams SET spond_group_id = @spond_group_id WHERE id = @id');

    // Determine if this is a subgroup (has a parent group)
    const isSubgroup = !!normalizedParentGroupId;

    // Create or update sync settings with parent group info
    const existingSettings = await pool.request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT id FROM spond_sync_settings WHERE team_id = @team_id');

    if (existingSettings.recordset.length > 0) {
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, normalizedGroupId)
        .input('spond_group_name', sql.NVarChar, groupName || null)
        .input('spond_parent_group_id', sql.NVarChar, normalizedParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, parentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup)
        .input('updated_at', sql.DateTime, new Date())
        .query(`
          UPDATE spond_sync_settings SET
            spond_group_id = @spond_group_id,
            spond_group_name = @spond_group_name,
            spond_parent_group_id = @spond_parent_group_id,
            spond_parent_group_name = @spond_parent_group_name,
            is_subgroup = @is_subgroup,
            updated_at = @updated_at
          WHERE team_id = @team_id
        `);
    } else {
      await pool.request()
        .input('team_id', sql.Int, teamId)
        .input('spond_group_id', sql.NVarChar, normalizedGroupId)
        .input('spond_group_name', sql.NVarChar, groupName || null)
        .input('spond_parent_group_id', sql.NVarChar, normalizedParentGroupId || null)
        .input('spond_parent_group_name', sql.NVarChar, parentGroupName || null)
        .input('is_subgroup', sql.Bit, isSubgroup)
        .query(`
          INSERT INTO spond_sync_settings (
            team_id, spond_group_id, spond_group_name, 
            spond_parent_group_id, spond_parent_group_name, 
            is_subgroup, sync_events_import, sync_attendance_import, is_active
          )
          VALUES (
            @team_id, @spond_group_id, @spond_group_name,
            @spond_parent_group_id, @spond_parent_group_name,
            @is_subgroup, 1, 1, 1
          )
        `);
    }

    const linkType = isSubgroup 
      ? `Team linked to Spond subgroup (parent: ${parentGroupName || normalizedParentGroupId})` 
      : 'Team linked to Spond group';
    
    console.log(`[Spond] ${linkType} - Team ${teamId} -> Group ${normalizedGroupId}${isSubgroup ? ` (parent: ${normalizedParentGroupId})` : ''}`);

    res.json({ 
      success: true, 
      message: linkType,
      isSubgroup,
      parentGroupId: normalizedParentGroupId || null
    });
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
              .input('team_ids', sql.NVarChar, String(team.id))
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
                    team_ids = COALESCE(@team_ids, target.team_ids),
                    updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                  INSERT (spond_id, name, description, team_id, team_ids, start_time, end_time, event_type, status, spond_group_id, created_at, updated_at)
                  VALUES (@spond_id, @name, @description, @team_id, @team_ids, @start_time, @end_time, @event_type, @status, @spond_group_id, GETDATE(), GETDATE());
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
          
          // Parse timestamps - preserve local time from Spond without timezone conversion
          // Spond sends ISO strings like "2026-02-15T18:00:00+01:00"
          // We want to store 18:00 as-is, not convert to UTC
          const startTimeStr = spondEvent.startTimestamp;
          const endTimeStr = spondEvent.endTimestamp;
          
          // Extract date/time components from ISO string (ignore timezone for storage)
          const parseLocalTime = (isoStr) => {
            // Match: YYYY-MM-DDTHH:MM:SS (ignore timezone offset)
            const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
              const [, year, month, day, hour, min, sec] = match;
              return new Date(year, month - 1, day, hour, min, sec);
            }
            return new Date(isoStr); // Fallback
          };
          
          const startTime = parseLocalTime(startTimeStr);
          const endTime = parseLocalTime(endTimeStr);
          
          console.log(`[Spond] Event "${spondEvent.heading}": Spond=${startTimeStr}, Stored=${startTime.toISOString()}`);
          
          await pool.request()
            .input('spond_id', sql.NVarChar, spondEvent.id)
            .input('name', sql.NVarChar, spondEvent.heading || 'Spond Event')
            .input('description', sql.NVarChar, spondEvent.description || '')
            .input('team_id', sql.Int, team.id)
            .input('start_time', sql.DateTime, startTime)
            .input('end_time', sql.DateTime, endTime)
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
    const estimatedAttendance = accepted + waiting;
    
    console.log(`[Spond] Attendance for event ${eventId}: ${accepted} accepted, ${waiting} waiting = ${estimatedAttendance} estimated`);
    
    // Update event with attendance counts and estimated_attendance
    await pool.request()
      .input('id', sql.Int, eventId)
      .input('accepted', sql.Int, accepted)
      .input('declined', sql.Int, declined)
      .input('unanswered', sql.Int, unanswered)
      .input('waiting', sql.Int, waiting)
      .input('estimated_attendance', sql.Int, estimatedAttendance)
      .query(`
        UPDATE events SET 
          attendance_accepted = @accepted,
          attendance_declined = @declined,
          attendance_unanswered = @unanswered,
          attendance_waiting = @waiting,
          estimated_attendance = @estimated_attendance,
          attendance_last_sync = GETDATE()
        WHERE id = @id
      `);

    res.json({
      success: true,
      eventId,
      attendance: { accepted, declined, unanswered, waiting, estimatedAttendance },
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
        const estimatedAttendance = accepted + waiting;
        
        console.log(`[Spond] Attendance for event ${event.id}: ${accepted} accepted, ${waiting} waiting = ${estimatedAttendance} estimated`);
        
        await pool.request()
          .input('id', sql.Int, event.id)
          .input('accepted', sql.Int, accepted)
          .input('declined', sql.Int, declined)
          .input('unanswered', sql.Int, unanswered)
          .input('waiting', sql.Int, waiting)
          .input('estimated_attendance', sql.Int, estimatedAttendance)
          .query(`
            UPDATE events SET 
              attendance_accepted = @accepted,
              attendance_declined = @declined,
              attendance_unanswered = @unanswered,
              attendance_waiting = @waiting,
              estimated_attendance = @estimated_attendance,
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
      spondParentGroupId,
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
        .input('spond_parent_group_id', sql.NVarChar, spondParentGroupId || null)
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
            spond_parent_group_id = @spond_parent_group_id,
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
        .input('spond_parent_group_id', sql.NVarChar, spondParentGroupId || null)
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
            team_id, spond_group_id, spond_group_name, spond_parent_group_id, spond_parent_group_name, is_subgroup,
            sync_events_import, sync_events_export, sync_attendance_import,
            sync_event_title, sync_event_description, sync_event_time, sync_event_location, sync_event_type,
            is_active
          ) VALUES (
            @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_id, @spond_parent_group_name, @is_subgroup,
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
    
    // Helper to count members - handles both array of objects and array of IDs
    const countMembers = (members) => {
      if (!members) return 0;
      if (Array.isArray(members)) return members.length;
      if (typeof members === 'object') return Object.keys(members).length;
      return 0;
    };
    
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
              parentGroupId: group.id,
              isSubgroup: true,
              memberCount: countMembers(subgroup.members),
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
            parentGroupId: null,
            isSubgroup: false,
            memberCount: countMembers(group.members),
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
      spondParentGroupId,
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
      .input('active', sql.Bit, 1)
      .query(`
        INSERT INTO teams (name, sport, spond_group_id, imported_from_spond, spond_import_date, active)
        OUTPUT INSERTED.id, INSERTED.name
        VALUES (@name, @sport, @spond_group_id, @imported_from_spond, GETDATE(), @active)
      `);
    
    const newTeamId = teamResult.recordset[0].id;
    
    // Create sync settings
    await pool.request()
      .input('team_id', sql.Int, newTeamId)
      .input('spond_group_id', sql.NVarChar, spondGroupId)
      .input('spond_group_name', sql.NVarChar, spondGroupName)
      .input('spond_parent_group_id', sql.NVarChar, spondParentGroupId || null)
      .input('spond_parent_group_name', sql.NVarChar, spondParentGroupName || null)
      .input('is_subgroup', sql.Bit, isSubgroup || false)
      .input('sync_events_import', sql.Bit, syncEventsImport !== false)
      .input('sync_events_export', sql.Bit, syncEventsExport || false)
      .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
      .query(`
        INSERT INTO spond_sync_settings (
          team_id, spond_group_id, spond_group_name, spond_parent_group_id, spond_parent_group_name, is_subgroup,
          sync_events_import, sync_events_export, sync_attendance_import, is_active
        ) VALUES (
          @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_id, @spond_parent_group_name, @is_subgroup,
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
          .input('active', sql.Bit, 1)
          .query(`
            INSERT INTO teams (name, sport, spond_group_id, imported_from_spond, spond_import_date, active)
            OUTPUT INSERTED.id
            VALUES (@name, @sport, @spond_group_id, @imported_from_spond, GETDATE(), @active)
          `);
        
        const newTeamId = teamResult.recordset[0].id;
        
        // Create sync settings
        await pool.request()
          .input('team_id', sql.Int, newTeamId)
          .input('spond_group_id', sql.NVarChar, group.id)
          .input('spond_group_name', sql.NVarChar, group.name)
          .input('spond_parent_group_id', sql.NVarChar, group.parentGroupId || null)
          .input('spond_parent_group_name', sql.NVarChar, group.parentGroup || null)
          .input('is_subgroup', sql.Bit, group.isSubgroup || false)
          .input('sync_events_import', sql.Bit, syncEventsImport !== false)
          .input('sync_events_export', sql.Bit, syncEventsExport || false)
          .input('sync_attendance_import', sql.Bit, syncAttendanceImport !== false)
          .query(`
            INSERT INTO spond_sync_settings (
              team_id, spond_group_id, spond_group_name, spond_parent_group_id, spond_parent_group_name, is_subgroup,
              sync_events_import, sync_events_export, sync_attendance_import, is_active
            ) VALUES (
              @team_id, @spond_group_id, @spond_group_name, @spond_parent_group_id, @spond_parent_group_name, @is_subgroup,
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

// Export diagnostic - check which events can be exported
app.get('/api/spond/export-diagnostic', verifyToken, requireAdminOrMgmt, async (req, res) => {
  try {
    const pool = await getPool();
    const daysAhead = parseInt(req.query.daysAhead) || 60;
    const daysBehind = parseInt(req.query.daysBehind) || 7;
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - daysBehind);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + daysAhead);
    
    // Get all events in date range
    const eventsQuery = await pool.request()
      .input('min_date', sql.DateTime, minDate)
      .input('max_date', sql.DateTime, maxDate)
      .query(`
        SELECT 
          e.id, e.name, e.description, e.event_type, e.start_time, e.end_time, e.status,
          e.spond_id, e.spond_group_id as event_spond_group_id,
          e.team_ids
        FROM events e
        WHERE e.start_time >= @min_date AND e.start_time <= @max_date
        ORDER BY e.start_time
      `);
    
    const teamsQuery = await pool.request().query(`
      SELECT id, name, spond_group_id FROM teams WHERE active = 1 ORDER BY name
    `);
    
    // Build team lookup map
    const teamsMap = new Map();
    for (const t of teamsQuery.recordset) {
      teamsMap.set(String(t.id), { name: t.name, spondGroupId: t.spond_group_id });
    }
    
    const events = eventsQuery.recordset.map(evt => {
      const issues = [];
      let canExport = true;
      let teamNames = [];
      let hasSpondGroup = false;
      let spondGroupId = null;
      
      if (evt.spond_id) {
        issues.push('Already exported to Spond');
        canExport = false;
      }
      
      if (!evt.team_ids || evt.team_ids.trim() === '') {
        issues.push('No team assigned');
        canExport = false;
      } else {
        // Check if any team has spond_group_id
        const teamIdList = evt.team_ids.split(',').map(id => id.trim());
        for (const tid of teamIdList) {
          const teamInfo = teamsMap.get(tid);
          if (teamInfo) {
            teamNames.push(teamInfo.name);
            if (teamInfo.spondGroupId) {
              hasSpondGroup = true;
              spondGroupId = teamInfo.spondGroupId;
            }
          }
        }
        
        if (!hasSpondGroup) {
          issues.push('No team linked to Spond group');
          canExport = false;
        }
      }
      
      if (evt.status === 'Cancelled') {
        issues.push('Event is cancelled');
        canExport = false;
      }
      
      return {
        id: evt.id,
        name: evt.name || evt.description?.substring(0, 50),
        eventType: evt.event_type,
        startTime: evt.start_time,
        status: evt.status,
        spondId: evt.spond_id,
        teamIds: evt.team_ids,
        teamNames: teamNames.join(', '),
        teamSpondGroupId: spondGroupId,
        canExport,
        issues: issues.length > 0 ? issues : ['Ready to export']
      };
    });
    
    const teams = teamsQuery.recordset.map(t => ({
      id: t.id,
      name: t.name,
      spondGroupId: t.spond_group_id,
      isLinked: !!t.spond_group_id
    }));
    
    res.json({
      summary: {
        dateRange: { from: minDate.toISOString(), to: maxDate.toISOString() },
        totalEvents: events.length,
        exportableEvents: events.filter(e => e.canExport).length,
        alreadyExported: events.filter(e => e.spondId).length,
        noTeamAssigned: events.filter(e => !e.teamId).length,
        teamNotLinked: events.filter(e => e.teamId && !e.teamSpondGroupId).length,
        totalTeams: teams.length,
        linkedTeams: teams.filter(t => t.isLinked).length,
        unlinkedTeams: teams.filter(t => !t.isLinked).length
      },
      events,
      teams
    });
  } catch (err) {
    console.error('[Spond] Export diagnostic error:', err);
    res.status(500).json({ error: 'Failed to run diagnostic' });
  }
});

// Helper function to normalize and validate Spond UUID
// Accepts both formats: with hyphens (a1b2c3d4-e5f6-7890-abcd-ef1234567890) 
// and without hyphens (A1B2C3D4E5F67890ABCDEF1234567890)
// Returns Spond API format: uppercase, no hyphens
function normalizeSpondUUID(id) {
  if (!id) return null;
  
  // Remove any existing hyphens and convert to uppercase (Spond API format)
  const cleanId = id.replace(/-/g, '').toUpperCase();
  
  // Check if it's a valid 32-char hex string
  if (!/^[0-9A-F]{32}$/.test(cleanId)) {
    return null; // Invalid UUID
  }
  
  // Return in Spond API format: uppercase, no hyphens
  return cleanId;
}

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
    
    console.log(`[Spond] Sync with settings: direction=${direction}, dateRange=${minDate.toISOString()} to ${maxDate.toISOString()}`);
    
    // Get all active sync settings
    const settingsResult = await pool.request().query(`
      SELECT 
        ss.id as settings_id,
        ss.spond_group_id,
        ss.spond_group_name,
        ss.spond_parent_group_id,
        ss.is_subgroup,
        ss.sync_events_import,
        ss.sync_events_export,
        ss.sync_attendance_import,
        ss.sync_event_title,
        ss.sync_event_description,
        ss.sync_event_time,
        ss.sync_event_location,
        ss.sync_event_type,
        ss.is_active,
        t.id as team_id,
        t.name as team_name
      FROM spond_sync_settings ss
      JOIN teams t ON ss.team_id = t.id
      WHERE ss.is_active = 1
    `);
    
    const results = {
      imported: 0,
      exported: 0,
      attendanceUpdated: 0,
      errors: [],
      exportDiagnostic: null
    };
    
    // EXPORT: If direction is 'export' or 'both', also export events from teams with spond_group_id
    // This is a fallback that doesn't rely on spond_sync_settings
    if (direction === 'export' || direction === 'both') {
      console.log('[Spond] Checking for events to export (via teams.spond_group_id)...');
      
      // Get all events that: 1) have no spond_id, 2) are in date range, 3) not cancelled
      // Note: events use team_ids (comma-separated) not team_id foreign key
      const eventsToExportQuery = await pool.request()
        .input('min_date', sql.DateTime, minDate)
        .input('max_date', sql.DateTime, maxDate)
        .query(`
          SELECT e.id, e.name, e.description, e.event_type, e.start_time, e.end_time, e.status,
                 e.team_ids
          FROM events e
          WHERE e.spond_id IS NULL
            AND e.team_ids IS NOT NULL AND e.team_ids != ''
            AND e.start_time >= @min_date AND e.start_time <= @max_date
            AND (e.status IS NULL OR e.status != 'Cancelled')
        `);
      
      console.log(`[Spond] Found ${eventsToExportQuery.recordset.length} events with team_ids in date range`);
      
      // Now filter to find events where at least one team has spond_group_id
      // And collect the spond_group_id to export to (using spond_sync_settings for subgroup handling)
      const teamsResult = await pool.request().query(`
        SELECT t.id, t.name, t.spond_group_id, 
               ss.spond_parent_group_id, ss.is_subgroup
        FROM teams t
        LEFT JOIN spond_sync_settings ss ON t.id = ss.team_id
        WHERE t.spond_group_id IS NOT NULL
      `);
      const teamsWithSpond = new Map();
      for (const t of teamsResult.recordset) {
        // When team is linked to a subgroup, use parent_group_id for the API call
        // The subgroup ID is stored in spond_group_id, parent is in spond_parent_group_id
        const effectiveGroupId = (t.is_subgroup && t.spond_parent_group_id) 
          ? t.spond_parent_group_id 
          : t.spond_group_id;
        teamsWithSpond.set(String(t.id), { 
          name: t.name, 
          spondGroupId: effectiveGroupId,
          subgroupId: t.is_subgroup ? t.spond_group_id : null,
          isSubgroup: t.is_subgroup
        });
      }
      console.log(`[Spond] Found ${teamsWithSpond.size} teams with spond_group_id`);
      
      // Filter events that have at least one team with spond_group_id
      const eligibleEvents = [];
      for (const event of eventsToExportQuery.recordset) {
        const teamIdList = event.team_ids.split(',').map(id => id.trim());
        // Find the first team that has a spond_group_id
        for (const teamId of teamIdList) {
          const teamInfo = teamsWithSpond.get(teamId);
          if (teamInfo) {
            eligibleEvents.push({
              ...event,
              team_name: teamInfo.name,
              spond_group_id: teamInfo.spondGroupId,
              spond_subgroup_id: teamInfo.subgroupId,
              is_subgroup: teamInfo.isSubgroup
            });
            break; // Use the first matching team's spond group
          }
        }
      }
      
      console.log(`[Spond] ${eligibleEvents.length} events eligible for export (have team with spond_group_id)`);
      
      // Diagnostic info
      const diagnosticQuery = await pool.request()
        .input('min_date', sql.DateTime, minDate)
        .input('max_date', sql.DateTime, maxDate)
        .query(`
          SELECT COUNT(*) as total FROM events e
          WHERE e.start_time >= @min_date AND e.start_time <= @max_date
        `);
      
      const totalInRange = diagnosticQuery.recordset[0].total;
      const alreadyExported = eventsToExportQuery.recordset.length > 0 ? 
        (await pool.request()
          .input('min_date', sql.DateTime, minDate)
          .input('max_date', sql.DateTime, maxDate)
          .query(`SELECT COUNT(*) as cnt FROM events WHERE spond_id IS NOT NULL AND start_time >= @min_date AND start_time <= @max_date`)
        ).recordset[0].cnt : 0;
      
      results.exportDiagnostic = {
        totalInRange: totalInRange,
        eligible: eligibleEvents.length,
        alreadyExported: alreadyExported,
        noTeam: totalInRange - eventsToExportQuery.recordset.length - alreadyExported,
        teamNotLinked: eventsToExportQuery.recordset.length - eligibleEvents.length
      };
      console.log('[Spond] Export diagnostic:', results.exportDiagnostic);
      
      for (const event of eligibleEvents) {
        let normalizedGroupId = null;
        let normalizedSubgroupId = null;
        try {
          const heading = event.name || event.description?.substring(0, 100) || `${event.event_type || 'Event'} - ${event.team_name}`;
          
          // Normalize UUIDs to standard format (with hyphens)
          normalizedGroupId = normalizeSpondUUID(event.spond_group_id);
          normalizedSubgroupId = event.spond_subgroup_id ? normalizeSpondUUID(event.spond_subgroup_id) : null;
          
          // VERBOSE LOGGING: Show exactly what we're sending to Spond
          console.log(`[Spond] ========== EXPORTING EVENT ${event.id} ==========`);
          console.log(`[Spond] Event Details:`);
          console.log(`[Spond]   - ID: ${event.id}`);
          console.log(`[Spond]   - Heading: "${heading}"`);
          console.log(`[Spond]   - Type: ${event.event_type}`);
          console.log(`[Spond]   - Start: ${event.start_time}`);
          console.log(`[Spond]   - team_ids from DB: "${event.team_ids}"`);
          console.log(`[Spond]   - Matched team name: "${event.team_name}"`);
          console.log(`[Spond]   - Original spond_group_id: "${event.spond_group_id}"`);
          console.log(`[Spond]   - Normalized spond_group_id: "${normalizedGroupId}"`);
          console.log(`[Spond]   - spond_subgroup_id: "${normalizedSubgroupId || 'none'}"`);
          console.log(`[Spond]   - is_subgroup: ${event.is_subgroup || false}`);
          
          // Validate normalized spond_group_id before sending
          if (!normalizedGroupId) {
            const errorMsg = `Event ${event.id}: Invalid or missing spond_group_id "${event.spond_group_id}". Team "${event.team_name}" may not be linked to a valid Spond group.`;
            console.error(`[Spond] ❌ ${errorMsg}`);
            results.errors.push({ eventId: event.id, error: errorMsg, team: event.team_name, groupId: event.spond_group_id });
            continue;
          }
          
          // Build recipients object - include subgroup if team is linked to a subgroup
          const recipients = {
            group: { id: normalizedGroupId }
          };
          
          // If the team is linked to a subgroup, add subgroup to recipients
          if (event.is_subgroup && normalizedSubgroupId) {
            recipients.subGroups = [{ id: normalizedSubgroupId }];
            console.log(`[Spond] Adding subgroup to recipients: ${normalizedSubgroupId}`);
          }
          
          const spondPayload = {
            heading: heading,
            description: event.description || '',
            startTimestamp: new Date(event.start_time).toISOString(),
            endTimestamp: new Date(event.end_time).toISOString(),
            spilesType: event.event_type === 'Game' ? 'MATCH' : 'EVENT',
            recipients: recipients,
            autoAccept: false
          };
          
          console.log(`[Spond] Sending to Spond API with group.id: "${normalizedGroupId}"${event.is_subgroup ? ` and subgroup: "${normalizedSubgroupId}"` : ''}`);
          
          const createdEvent = await spondPostRequest(token, 'sponds', spondPayload);
          
          await pool.request()
            .input('id', sql.Int, event.id)
            .input('spond_id', sql.NVarChar, createdEvent.id)
            .input('spond_group_id', sql.NVarChar, normalizedGroupId)
            .query(`
              UPDATE events SET 
                spond_id = @spond_id,
                spond_group_id = @spond_group_id,
                updated_at = GETDATE()
              WHERE id = @id
            `);
          
          console.log(`[Spond] ✅ Successfully exported event ${event.id} as Spond event ${createdEvent.id}`);
          console.log(`[Spond] ==========================================`);
          results.exported++;
        } catch (exportErr) {
          console.error(`[Spond] ❌ EXPORT FAILED for event ${event.id}`);
          console.error(`[Spond]   - Error message: ${exportErr.message}`);
          console.error(`[Spond]   - Team: "${event.team_name}"`);
          console.error(`[Spond]   - spond_group_id used: "${normalizedGroupId}" (original: "${event.spond_group_id}")`);
          
          // Parse Spond error for more helpful message
          let userFriendlyError = exportErr.message;
          if (exportErr.message.includes('Unable to load group')) {
            userFriendlyError = `Spond cannot find group "${normalizedGroupId}". This group may have been deleted in Spond, or your account doesn't have access to it. Please re-link team "${event.team_name}" to a valid Spond group.`;
          } else if (exportErr.message.includes('401') || exportErr.message.includes('Unauthorized')) {
            userFriendlyError = `Spond authentication failed. Please reconfigure your Spond credentials.`;
          } else if (exportErr.message.includes('403') || exportErr.message.includes('Forbidden')) {
            userFriendlyError = `Access denied to Spond group "${normalizedGroupId}". Your Spond account may not have permission to create events in this group.`;
          }
          
          console.error(`[Spond]   - User message: ${userFriendlyError}`);
          console.error(`[Spond] ==========================================`);
          
          results.errors.push({ 
            eventId: event.id, 
            error: userFriendlyError,
            team: event.team_name,
            groupId: normalizedGroupId,
            originalGroupId: event.spond_group_id,
            rawError: exportErr.message
          });
        }
      }
    }
    
    for (const settings of settingsResult.recordset) {
      try {
        // Import events from Spond
        if (settings.sync_events_import && (direction === 'import' || direction === 'both' || !direction)) {
          const events = await spondRequest(token, 
            `sponds?groupId=${settings.spond_group_id}&minEndTimestamp=${minDate.toISOString()}&maxEndTimestamp=${maxDate.toISOString()}&includeComments=false&includeHidden=false`
          );
          
          // Helper function to parse local time from ISO string (ignore timezone)
          const parseLocalTime = (isoStr) => {
            if (!isoStr) return null;
            const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
              const [, year, month, day, hour, min, sec] = match;
              return new Date(year, month - 1, day, hour, min, sec);
            }
            return new Date(isoStr);
          };
          
          for (const spondEvent of events) {
            // Parse timestamps preserving local time
            const startTime = settings.sync_event_time ? parseLocalTime(spondEvent.startTimestamp) : null;
            const endTime = settings.sync_event_time ? parseLocalTime(spondEvent.endTimestamp) : null;
            
            console.log(`[Spond] Syncing event "${spondEvent.heading}": Spond=${spondEvent.startTimestamp}, Stored=${startTime?.toISOString()}`);
            
            await pool.request()
              .input('spond_id', sql.NVarChar, spondEvent.id)
              .input('name', sql.NVarChar, settings.sync_event_title ? (spondEvent.heading || 'Spond Event') : null)
              .input('description', sql.NVarChar, settings.sync_event_description ? (spondEvent.description || '') : null)
              .input('team_id', sql.Int, settings.team_id)
              .input('team_ids', sql.NVarChar, String(settings.team_id))
              .input('start_time', sql.DateTime, startTime)
              .input('end_time', sql.DateTime, endTime)
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
                    team_ids = COALESCE(@team_ids, target.team_ids),
                    updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                  INSERT (spond_id, name, description, team_id, team_ids, start_time, end_time, event_type, status, spond_group_id, created_at, updated_at)
                  VALUES (@spond_id, COALESCE(@name, 'Spond Event'), @description, @team_id, @team_ids, @start_time, @end_time, COALESCE(@event_type, 'Practice'), @status, @spond_group_id, GETDATE(), GETDATE());
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
              WHERE CHARINDEX(',' + CAST(@team_id AS VARCHAR) + ',', ',' + ISNULL(team_ids, '') + ',') > 0
              AND spond_id IS NOT NULL
              AND start_time >= @min_date AND start_time <= @max_date
            `);
          
          for (const event of eventsWithSpond.recordset) {
            try {
              const spondEvent = await spondRequest(token, `sponds/${event.spond_id}`);
              const responses = spondEvent.responses || {};
              
              const acceptedCount = responses.acceptedIds?.length || 0;
              const waitingCount = responses.waitinglistIds?.length || 0;
              const estimatedAttendance = acceptedCount + waitingCount;
              
              console.log(`[Spond] Attendance for event ${event.id}: ${acceptedCount} accepted, ${waitingCount} waiting = ${estimatedAttendance} estimated`);
              
              await pool.request()
                .input('id', sql.Int, event.id)
                .input('accepted', sql.Int, acceptedCount)
                .input('declined', sql.Int, responses.declinedIds?.length || 0)
                .input('unanswered', sql.Int, responses.unansweredIds?.length || 0)
                .input('waiting', sql.Int, waitingCount)
                .input('estimated_attendance', sql.Int, estimatedAttendance)
                .query(`
                  UPDATE events SET 
                    attendance_accepted = @accepted,
                    attendance_declined = @declined,
                    attendance_unanswered = @unanswered,
                    attendance_waiting = @waiting,
                    estimated_attendance = @estimated_attendance,
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
        
        // Export events to Spond (when direction is export or both)
        if (settings.sync_events_export && (direction === 'export' || direction === 'both')) {
          console.log(`[Spond] Checking for events to export for team ${settings.team_name} (spond_group_id: ${settings.spond_group_id})`);
          
          // Get local events that need to be exported to this team's Spond group
          const eventsToExport = await pool.request()
            .input('team_id', sql.Int, settings.team_id)
            .input('min_date', sql.DateTime, minDate)
            .input('max_date', sql.DateTime, maxDate)
            .query(`
              SELECT id, name, description, event_type, start_time, end_time, status
              FROM events 
              WHERE CHARINDEX(',' + CAST(@team_id AS VARCHAR) + ',', ',' + ISNULL(team_ids, '') + ',') > 0
              AND spond_id IS NULL
              AND start_time >= @min_date AND start_time <= @max_date
              AND (status IS NULL OR status != 'Cancelled')
            `);
          
          console.log(`[Spond] Found ${eventsToExport.recordset.length} events to export for team ${settings.team_name}`);
          
          for (const event of eventsToExport.recordset) {
            try {
              // Build event payload for Spond
              const heading = event.name || `${event.event_type} - ${settings.team_name}`;
              const spondPayload = {
                heading: heading,
                description: event.description || '',
                startTimestamp: new Date(event.start_time).toISOString(),
                endTimestamp: new Date(event.end_time).toISOString(),
                spilesType: event.event_type === 'Game' ? 'MATCH' : 'EVENT',
                recipients: {
                  group: { id: settings.spond_group_id }
                },
                autoAccept: false
              };
              
              console.log(`[Spond] Exporting event ${event.id} "${heading}" to Spond group ${settings.spond_group_id}`);
              
              // Create event in Spond
              const createdEvent = await spondPostRequest(token, 'sponds', spondPayload);
              
              // Update local event with Spond ID
              await pool.request()
                .input('id', sql.Int, event.id)
                .input('spond_id', sql.NVarChar, createdEvent.id)
                .input('spond_group_id', sql.NVarChar, settings.spond_group_id)
                .query(`
                  UPDATE events SET 
                    spond_id = @spond_id,
                    spond_group_id = @spond_group_id,
                    updated_at = GETDATE()
                  WHERE id = @id
                `);
              
              console.log(`[Spond] Successfully exported event ${event.id} as Spond event ${createdEvent.id}`);
              results.exported++;
            } catch (exportErr) {
              console.error(`[Spond] Failed to export event ${event.id}:`, exportErr.message);
              results.errors.push({ eventId: event.id, error: exportErr.message });
            }
          }
          
          // Update last export timestamp
          await pool.request()
            .input('team_id', sql.Int, settings.team_id)
            .query('UPDATE spond_sync_settings SET last_export_sync = GETDATE() WHERE team_id = @team_id');
        }
        
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
app.use('/_spark', (_req, res) => res.status(410).json({ error: 'Spark runtime has been retired' }));





// ⭐ Spark lifecycle endpoint


// ------------------------------
// Generic LLM endpoint for frontend use
// ------------------------------


// Serve the Vite production build (must come before fallback)
app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(distDir, { maxAge: 0 }));

// Handle unmatched API routes (return JSON 404 instead of HTML)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found', path: req.path, method: req.method });
});

// SPA fallback for client-side routing (only for non-API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ------------------------------
// Error handling (last)
// ------------------------------
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(err.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500)
    .json({ error: err.status === 413 ? 'Request body too large' : 'Request failed' });
});

return app;
}

module.exports = { createApp };

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const app = createApp();
  const { port } = readConfig();
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`QMT listening on port ${server.address().port}; optional providers disabled by default`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 15000);
      deadline.unref();
      server.close(async () => {
        try { await app.locals.close(); clearTimeout(deadline); }
        catch (error) { console.error('Database shutdown failed', error.code); process.exitCode = 1; }
      });
      server.closeIdleConnections();
    });
  }
}
