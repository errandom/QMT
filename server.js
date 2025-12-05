// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

/**
 * Azure SQL connection settings from environment variables
 * (App Service → Configuration → Application settings)
 */
const sqlConfig = {
  server: process.env.SQL_SERVER,           // e.g., myserver.database.windows.net
  database: process.env.SQL_DATABASE,       // e.g., QMT
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,                          // REQUIRED for Azure SQL
    trustServerCertificate: false
  }
};

// Optional: maintain a single global pool (prevents multiple pool creation)
let poolPromise;

/**
 * Get or create a global connection pool
 */
async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig);
  }
  return poolPromise;
}

/**
 * Health check
 */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/**
 * Teams API
 * Adjust the SQL query to match your actual table/schema
 * (e.g., 'dbo.Teams' if needed)
 */
app.get('/api/teams', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT TOP 50 * FROM dbo.Teams ORDER BY Id DESC'); // change to your schema/table if different
    res.json(result.recordset);
  } catch (err) {
    console.error('SQL error:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

/**
 * Static assets from Vite build
 * Ensure your CI built to /dist and deployed it into wwwroot
 */
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

/**
 * * SPA fallback to index.html
 */
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`QMT app listening on port ${port}`);
});
