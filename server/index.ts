import express, { Request, Response, NextFunction, Router } from 'express';
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

/* ----------------------------- Static (assets) ------------------------ */
/**
 * NOTE: Only static assets middleware is added here.
 * The SPA catch‑all route is added AFTER routers are registered,
 * so API endpoints don't get short‑circuited to 404.
 */
if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../'); // /home/site/wwwroot
  app.use(express.static(webRoot));
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

/* ----------------------------- Helpers -------------------------------- */

/**
 * Safely load an Express router from a module path.
 * Avoids TypeScript “default” property issues on dynamic import.
 */
async function loadRouter(modulePath: string): Promise<Router | null> {
  try {
    const mod = await import(modulePath);
    // At runtime, CJS modules are often under "default"; ESM routers may be direct.
    const router = (mod as any).default ?? mod;
    // Best-effort runtime narrow:
    if (typeof router === 'function') {
      return router as Router;
    }
    console.error(`Module at ${modulePath} did not export a Router function.`);
    return null;
  } catch (error) {
    console.error(`Failed to load router at ${modulePath}:`, error);
    return null;
  }
}

/* ----------------------------- Startup -------------------------------- */

async function registerRoutes(): Promise<void> {
  console.log('🔧 Registering routes...');

  const authRouter     = await loadRouter('./routes/auth.js');
  const eventsRouter   = await loadRouter('./routes/events.js');
  const teamsRouter    = await loadRouter('./routes/teams.js');
  const sitesRouter    = await loadRouter('./routes/sites.js');
  const fieldsRouter   = await loadRouter('./routes/fields.js');
  const equipmentRouter= await loadRouter('./routes/equipment.js');
  const requestsRouter = await loadRouter('./routes/requests.js');

  if (authRouter)      app.use('/api/auth', authRouter);
  if (eventsRouter)    app.use('/api/events', eventsRouter);
  if (teamsRouter)     app.use('/api/teams', teamsRouter);
  if (sitesRouter)     app.use('/api/sites', sitesRouter);
  if (fieldsRouter)    app.use('/api/fields', fieldsRouter);
  if (equipmentRouter) app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
  if (requestsRouter)  app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

  console.log('✅ Routes registered');
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

    // SPA catch‑all AFTER routers, so /api/* is not short-circuited to 404
    if (process.env.NODE_ENV === 'production') {
      const webRoot = path.join(__dirname, '../../'); // /home/site/wwwroot
      app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(webRoot, 'index.html'));
        } else {
          next(); // let API routers handle /api/* paths
        }
      });
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Fatal startup error:', error);
       // Do not exit; allow platform to restart if needed
  }
}
