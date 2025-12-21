import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { getPool } from './db.js';

// Import routes
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import teamsRouter from './routes/teams.js';
import sitesRouter from './routes/sites.js';
import fieldsRouter from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter from './routes/requests.js';

// Import middleware
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 as healthy');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'error', database: 'disconnected', error: (error as Error).message });
  }
});

// API Routes
// Public routes (no authentication required)
app.use('/api/auth', authRouter);

// Public request submission (anyone can submit a request)
app.post('/api/requests', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const { type, requestor_name, requestor_phone, event_type, team_ids, purpose, opponent, date, start_time, duration, description } = req.body;
    
    const result = await pool.request()
      .input('type', sql.NVarChar, type)
      .input('requestor_name', sql.NVarChar, requestor_name)
      .input('requestor_phone', sql.NVarChar, requestor_phone)
      .input('event_type', sql.NVarChar, event_type)
      .input('team_ids', sql.NVarChar, team_ids || null)
      .input('purpose', sql.NVarChar, purpose || null)
      .input('opponent', sql.NVarChar, opponent || null)
      .input('date', sql.Date, date)
      .input('start_time', sql.Time, start_time)
      .input('duration', sql.Int, duration)
      .input('description', sql.NVarChar, description || null)
      .input('status', sql.NVarChar, 'Pending')
      .query(`
        INSERT INTO requests (type, requestor_name, requestor_phone, event_type, team_ids, purpose, opponent, date, start_time, duration, description, status)
        OUTPUT INSERTED.*
        VALUES (@type, @requestor_name, @requestor_phone, @event_type, @team_ids, @purpose, @opponent, @date, @start_time, @duration, @description, @status)
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Public read-only routes (GET requests - anyone can view data)
// Handle GET requests without authentication
app.get('/api/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await getPool();
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
    console.log('[API GET Events] Retrieved', result.recordset.length, 'events');
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Events] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/teams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await getPool();
    // IMPORTANT: Return ALL teams, regardless of active status
    // The frontend filters based on active status in the UI
    const result = await pool.request().query(`SELECT * FROM teams ORDER BY sport, name`);
    console.log('[API GET Teams] Retrieved', result.recordset.length, 'teams');
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Teams] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/sites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT s.*, (SELECT COUNT(*) FROM fields WHERE site_id = s.id) as field_count FROM sites s ORDER BY s.name`);
    console.log('[API GET Sites] Retrieved', result.recordset.length, 'sites');
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Sites] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/fields', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT f.*, s.name as site_name, s.address as site_address FROM fields f LEFT JOIN sites s ON f.site_id = s.id ORDER BY s.name, f.name`);
    console.log('[API GET Fields] Retrieved', result.recordset.length, 'fields');
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Fields] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/equipment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT * FROM equipment ORDER BY name`);
    console.log('[API GET Equipment] Retrieved', result.recordset.length, 'equipment items');
    res.json(result.recordset);
  } catch (error) {
    console.error('[API GET Equipment] ERROR:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/events/:id', async (req: Request, res: Response, next: NextFunction) => {
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
  res.json(result.recordset.length > 0 ? result.recordset[0] : { error: 'Not found' });
});

app.get('/api/teams/:id', async (req: Request, res: Response, next: NextFunction) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query(`SELECT * FROM teams WHERE id = @id`);
  res.json(result.recordset.length > 0 ? result.recordset[0] : { error: 'Not found' });
});

app.get('/api/sites/:id', async (req: Request, res: Response, next: NextFunction) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query(`SELECT * FROM sites WHERE id = @id`);
  res.json(result.recordset.length > 0 ? result.recordset[0] : { error: 'Not found' });
});

app.get('/api/fields/:id', async (req: Request, res: Response, next: NextFunction) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query(`SELECT f.*, s.name as site_name, s.address as site_address FROM fields f LEFT JOIN sites s ON f.site_id = s.id WHERE f.id = @id`);
  res.json(result.recordset.length > 0 ? result.recordset[0] : { error: 'Not found' });
});

app.get('/api/equipment/:id', async (req: Request, res: Response, next: NextFunction) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query(`SELECT * FROM equipment WHERE id = @id`);
  res.json(result.recordset.length > 0 ? result.recordset[0] : { error: 'Not found' });
});

// Protected routes (require authentication and admin/mgmt role)
app.use('/api/events', authenticateToken, requireAdminOrMgmt, eventsRouter);
app.use('/api/teams', authenticateToken, requireAdminOrMgmt, teamsRouter);
app.use('/api/sites', authenticateToken, requireAdminOrMgmt, sitesRouter);
app.use('/api/fields', authenticateToken, requireAdminOrMgmt, fieldsRouter);
app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // Handle client-side routing
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Initialize database connection and start server
async function startServer() {
  try {
    await getPool();
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
