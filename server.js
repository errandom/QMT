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
      server: sqlConfig.server,
      database: sqlConfig.database,
      user: sqlConfig.user,
      passwordSet: !!sqlConfig.password,
      options: sqlConfig.options
    });
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

// ------------------------------
// Data API endpoints
// ------------------------------

// Teams
app.get('/api/teams', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM teams ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
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

// Events
app.get('/api/events', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        e.*,
        t.name as team_name,
        t.sport,
        f.name as field_name,
        s.name as site_name,
        s.address as site_address
      FROM events e
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN fields f ON e.field_id = f.id
      LEFT JOIN sites s ON f.site_id = s.id
      ORDER BY e.start_time DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
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
          t.name as team_name,
          t.sport,
          f.name as field_name,
          s.name as site_name,
          s.address as site_address
        FROM events e
        LEFT JOIN teams t ON e.team_id = t.id
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

// Sites
app.get('/api/sites', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM fields WHERE site_id = s.id) as field_count
      FROM sites s
      ORDER BY s.name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching sites:', err);
    res.status(500).json({ error: 'Failed to fetch sites' });
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

// Fields
app.get('/api/fields', async (_req, res) => {
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
  } catch (err) {
    console.error('Error fetching fields:', err);
    res.status(500).json({ error: 'Failed to fetch fields' });
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

// Equipment
app.get('/api/equipment', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM equipment ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to fetch equipment' });
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

// ------------------------------
// Static assets + SPA fallback
// ------------------------------
const distDir = path.join(__dirname, 'dist');

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
