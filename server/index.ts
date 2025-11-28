
// server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getPool } from './db.js';
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

// Static imports for routes (each must export default router)
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import teamsRouter from './routes/teams.js';
import sitesRouter from './routes/sites.js';
import fieldsRouter from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter from './routes/requests.js';

/* ----------------------------- Env ----------------------------- */
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;

/* ----------------------------- Middleware ----------------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
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

/* ----------------------------- API Routes ----------------------------- */
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/fields', fieldsRouter);
app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

console.log('✅ Routes registered');

/* ----------------------------- Static / SPA ----------------------------- */
/**
 * Your build layout in Kudu:
 *   site/wwwroot/dist/
 *     ├─ index.html
 *     ├─ assets/...
 *     └─ server/ (compiled backend)
 *
 * Since __dirname === site/wwwroot/dist/server at runtime,
 * ".." resolves to site/wwwroot/dist (the client bundle root).
 */
const clientPath = path.resolve(__dirname, '..'); // -> dist
app.use(express.static(clientPath));

/**
 * SPA fallback AFTER API routers so /api/* hits the API,
 * and other routes return the built index.html.
 */
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientPath, 'index.html'));
});

/* ----------------------------- Startup ----------------------------- */
(async () => {
  try {
    console.log('🚀 Bootstrapping server...');
    await getPool(); // warm DB pool (db.ts handles retries)
    console.log('✅ Database connected (warm)');
  } catch (error) {
    console.error('⚠️ Database warm-up failed:', error);
    // Continue: endpoints call getPool() on demand and will retry there
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();

/* ----------------------------- Global error handling ----------------------------- */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

process.on('unhandledRejection', (err) => console.error('UNHANDLED_REJECTION:', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));
process.on('exit', (code) => console.error(`🔴 process exiting with code ${code}`));
