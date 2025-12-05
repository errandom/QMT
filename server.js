// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

// Azure SQL connection settings from App Settings
const sqlConfig = {
  server: process.env.SQL_SERVER,           // e.g., myserver.database.windows.net
  database: process.env.SQL_DATABASE,       // e.g., QMT
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

// Keep a single pool
let poolPromise;
async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(sqlConfig);
  return poolPromise;
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
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

// Teams (adjust schema/table name if needed)
app.get('/api/teams', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT TOP (50) * FROM dbo.Teams ORDER BY Id DESC'); // change dbo.Teams to your actual schema/table
    res.json(result.recordset);
  } catch (err) {
    console.error('SQL error /api/teams:', {
      message: err.message, code: err.code, number: err.number, state: err.state, name: err.name
    });
    res.status(500).json({ error: 'Failed to fetch teams', detail: err.message });
  }
});

// Serve Vite build
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// SPA// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
