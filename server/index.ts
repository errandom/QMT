import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getPool } from './db.js';
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Azure sets $PORT; Oryx defaults to 8080 if missing
const PORT = Number(process.env.PORT) || 8080;

/* ----------------------------- Middleware ----------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* ----------------------------- Health Check --------------------------- */

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as healthy');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: (error as Error).message
    });
  }
});

/* ----------------------------- Teams Fallback ------------------------- */
/**
 * Ensure GET /api/teams responds even if routes/teams.js fails to load
 * or doesn’t define router.get('/').
 */
app.get('/api/teams', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    // TODO: adjust to your actual table/view name
    const result = await pool.request().query('SELECT * FROM Teams');
    return res.json(result.recordset);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

/* ----------------------------- Static / SPA --------------------------- */
/**
 * In production, compiled code runs from:
 *   /home/site/wwwroot/dist/server
 * Web root with index.html is:
 *   /home/site/wwwroot  → two levels up from __dirname
 */
if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../'); // /home/site/wwwroot
  app.use(express.static(webRoot));

  // SPA fallback for non-API routes
  app.get(/.*/, (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(webRoot, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

/* ----------------------------- Error Handling ------------------------- */

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Crash visibility for unexpected failures
process.on('unhandledRejection', (err) => console.error('UNHANDLED_REJECTION:', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));

/* ----------------------------- Startup ------------------------------- */

async function registerRoutes(): Promise<void> {
  console.log('🔧 Registering routes...');
  try {
    const [
      { default: authRouter },
      { default: eventsRouter },
      { default: teamsRouter },
      { default: sitesRouter },
      { default: fieldsRouter },
      { default: equipmentRouter },
      { default: requestsRouter }
    ] = await Promise.all([
      import('./routes/auth.js'),
      import('./routes/events.js'),
      import('./routes/teams.js'),   // if this fails, the fallback above still serves /api/teams
      import('./routes/sites.js'),
      import('./routes/fields.js'),
      import('./routes/equipment.js'),
      import('./routes/requests.js')
    ]);

    app.use('/api/auth', authRouter);
    app.use('/api/events', eventsRouter);
    // NOTE: teamsRouter may override or complement the fallback for subroutes (e.g., /api/teams/:id)
    app.use('/api/teams', teamsRouter);
    app.use('/api/sites', sitesRouter);
    app.use('/api/fields', fieldsRouter);
    app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
    app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

    console.log('✅ Routes registered');
  } catch (error) {
    console.error('⚠️ Route registration failed:', error);
    console.error('Continuing startup without API routers (fallbacks/SPAs still served).');
  }
}

async function initDatabase(): Promise<void> {
  console.log('🔌 Connecting to database...');
  try {
    await getPool();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️ Database connection failed:', error);
    console.error('Continuing startup without DB connection.');
  }
}

async function startServer() {
  try {
    console.log('🚀 Bootstrapping server...');
    await initDatabase();
    await registerRoutes();

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Fatal startup error:', error);
       // Do not exit; allow platform to restart if needed
  }
}
