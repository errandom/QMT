// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();

// --- Log early and clearly so you see it in Log Stream ---
console.log('QMT starting at', new Date().toISOString(), 'PORT =', process.env.PORT);

// Express basics
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Port: App Service injects PORT (e.g., 8080). Fall back locally.
const port = process.env.PORT || 3000;

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

// Teams (adjust schema/table to match your DB)
app.get('/api/teams', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT TOP (50) * FROM dbo.Teams ORDER BY Id DESC'); // change dbo.Teams if needed
    res.json(result.recordset);
  } catch (err) {
    console.error('SQL error /api/teams:', {
      message: err.message, code: err.code, number: err.number, state: err.state, name: err.name
    });
    res.status(500).json({ error: 'Failed to fetch teams', detail: err.message });
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
