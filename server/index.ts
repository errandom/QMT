
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './db.js';

// Routers
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import teamsRouter from './routes/teams.js';
import sitesRouter from './routes/sites.js';
import fieldsRouter from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter from './routes/requests.js';

// Middleware
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

// Load environment variables
dotenv.config();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Global Middleware
// --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// --------------------
// Health Check
// --------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as healthy');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: (error as Error).message
    });
  }
});

// --------------------
// API Routes
// --------------------
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/fields', fieldsRouter);

// Public request submission
app.post('/api/requests', requestsRouter);

// Protected routes
app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

// --------------------
// Static Files & SPA Fallback
// --------------------
if (process.env.NODE_ENV === 'production') {
  // ✅ Corrected path: one level up from /server to /dist
  const distPath = path.resolve(__dirname, '..'); // Points to /home/site/wwwroot/dist
  app.use(express.static(distPath));

  // ✅ SPA fallback using regex for all non-API routes
  app.get(/.*/, (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// --------------------
// Error Handling
// --------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --------------------
// Start Server
// --------------------
async function startServer() {
  try {
    await getPool(); // Ensure DB connection before starting
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

