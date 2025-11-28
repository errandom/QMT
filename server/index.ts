// server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getPool } from './db.js';
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

// Prefer static imports to catch compile-time errors
import authRouter      from './routes/auth.js';
import eventsRouter    from './routes/events.js';
import teamsRouter     from './routes/teams.js';
import sitesRouter     from './routes/sites.js';
import fieldsRouter    from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter  from './routes/requests.js';

console.log('🟢 index module loaded');

/* ----------------------------- Env ----------------------------- */
dotenv.config();
console.log('🔧 dotenv configured');

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

/* ----------------------------- API Routers ----------------------------- */
// Mount only when present so build failures are visible in logs
if (authRouter)      app.use('/api/auth', authRouter);
if (eventsRouter)    app.use('/api/events', eventsRouter);
if (teamsRouter)     app.use('/api/teams', teamsRouter);
if (sitesRouter)     app.use('/api/sites', sitesRouter);
if (fieldsRouter)    app.use('/api/fields', fieldsRouter);
if (equipmentRouter) app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
if (requestsRouter)  app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

console.log('✅ Routes registered');

/* ----------------------------- Static / SPA ----------------------------- */
// Always serve static, regardless of NODE_ENV
const clientPath = path.resolve(__dirname, '../client'); // dist/server/../client -> dist/client
app.use(express.static(clientPath));

/**
 * SPA fallback AFTER routers so /api/* is handled by the API and
 * non-API routes serve index.html (client-side routing).
 */
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientPath, 'index.html'));
});

/* ----------------------------- Startup ----------------------------- */
async function initDatabase() {
  console.log('🔌 Connecting to database...');
  try {
    await getPool(); // warm-up pool with retry
    console.log('✅ Database connected (warm)');
  } catch (error) {
    console.error('⚠️ Database warm-up failed:', error);
    console.error('Continuing; API will retry on demand');
  }
}

async function startServer() {
  try {
    console.log('🚀 Bootstrapping server...');
    await initDatabase();
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
process.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));
process.on('exit', (code) => console.error(`🔴 process exiting with code ${code}`));

/* ----------------------------- Go ----------------------------- */
startServer();
