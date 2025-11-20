import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Public read-only routes (anyone can view events, teams, sites, fields)
app.get('/api/events', eventsRouter);
app.get('/api/events/:id', eventsRouter);
app.get('/api/teams', teamsRouter);
app.get('/api/teams/:id', teamsRouter);
app.get('/api/sites', sitesRouter);
app.get('/api/sites/:id', sitesRouter);
app.get('/api/fields', fieldsRouter);
app.get('/api/fields/:id', fieldsRouter);

// Public request submission (anyone can submit a request)
app.post('/api/requests', requestsRouter);

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
