
// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

// --- Azure SQL connection (App Settings in Azure Portal) ---
const sqlConfig = {
  server: process.env.SQL_SERVER,           // e.g., myserver.database.windows.net
  database: process.env.SQL_DATABASE,       // e.g., QMT
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Example: teams API
app.get('/api/teams', async (_req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request()
      .query('SELECT TOP 50 * FROM Teams ORDER BY Id DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('SQL error:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Serve the Vite build output
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`QMT listening on port ${port}`);
};
