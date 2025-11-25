
// server/index.ts
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🟢 index module loaded');

import { getPool } from './db.js';
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

/* ----------------------------- Env ----------------------------- */
try {
  dotenv.config();
  console.log('🔧 dotenv configured');
} catch (err) {
  console.error('dotenv.config failed:', err);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;

/* ----------------------------- Middleware ----------------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* ----------------------------- Health ----------------------------- */
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

/* ----------------------------- Static / SPA ----------------------------- */
/**
 * Production serving:
 * - Vite builds to dist/client
 * - Express serves static assets from dist/client
 * - Non-/api routes fall back to dist/client/index.html (SPA)
 */
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client'); // dist/server/../client -> dist/client
  app.use(express.static(clientPath));
}

/* ----------------------------- Helper: Safe router loader ----------------------------- */
/**
 * Dynamic import of route modules compiled to JS in dist/server/routes/*.js.
 * Accepts default export or named 'router'. Returns null if not a Router.
 */
async function loadRouter(modulePath: string): Promise<Router | null> {
  try {
    const mod: any = await import(modulePath);
    const candidate = mod?.default ?? mod?.router;

    // Express Router instances are callable functions; guard accordingly
    if (candidate && typeof candidate === 'function') {
      return candidate as Router;
    }

    console.error(`Module at ${modulePath} did not export an Express Router (default or named 'router').`);
    return null;
  } catch (error) {
    console.error(`Failed to load router at ${modulePath}:`, error);
    return null;
  }
}

/* ----------------------------- Startup ----------------------------- */
async function registerRoutes() {
  console.log('🔧 Registering routes...');

  const authRouter      = await loadRouter('./routes/auth.js');
  const eventsRouter    = await loadRouter('./routes/events.js');
  const teamsRouter     = await loadRouter('./routes/teams.js');
  const sitesRouter     = await loadRouter('./routes/sites.js');
  const fieldsRouter    = await loadRouter('./routes/fields.js');
  const equipmentRouter = await loadRouter('./routes/equipment.js');
  const requestsRouter  = await loadRouter('./routes/requests.js');

  if (authRouter)      app.use('/api/auth', authRouter);
  if (eventsRouter)    app.use('/api/events', eventsRouter);
  if (teamsRouter)     app.use('/api/teams', teamsRouter);
  if (sitesRouter)     app.use('/api/sites', sitesRouter);
  if (fieldsRouter)    app.use('/api/fields', fieldsRouter);
  if (equipmentRouter) app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
  if (requestsRouter)  app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

  console.log('✅ Routes registered');
}

async function initDatabase() {
  console.log('🔌 Connecting to database...');
  try {
    await getPool();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️ Database connection failed:', error);
    console.error('Starting without DB...');
  }
}

/**
 * SPA fallback AFTER routers so /api/* is handled by the API and
 * non-API routes serve index.html (client-side routing).
 */
function installSpaFallback() {
  if (process.env.NODE_ENV !== 'production') return;

  const clientPath = path.join(__dirname, '../client');
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

async function startServer() {
  try {
    console.log('🚀 Bootstrapping server...');
    await initDatabase();
    await registerRoutes();
    installSpaFallback();
  } catch (err) {
    console.error('❌ Startup error before listen:', err);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

/* ----------------------------- Global error handling ----------------------------- */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

process.on('unhandledRejection', (err) => console.error('UNHANDLED_REJECTION:', err));
process.onprocess.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));
process.on('exit', (code) => console.error(`🔴 process exiting with code ${code}`));

/* ----------------------------- Go ----------------------------- */
