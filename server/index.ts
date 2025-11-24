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
    res.status(503).json({ status: 'error', database: 'disconnected', error: (error as Error).message });
  }
});

/* ----------------------------- Static / SPA --------------------------- */
if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../');
  app.use(express.static(webRoot));

  // Explicit homepage route
  app.get('/', (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));

  // SPA fallback AFTER API routes
  app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(webRoot, 'index.html'));
    } else {
      next();
    }
  });
}

/* ----------------------------- Error Handling ------------------------- */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

process.on('unhandledRejection', (err) => console.error('UNHANDLED_REJECTION:', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));

/* ----------------------------- Helpers -------------------------------- */
async function loadRouter(modulePath: string): Promise<Router | null> {
  try {
    const mod = await import(modulePath);
    return (mod as any).default ?? null;
  } catch (error) {
    console.error(`Failed to load router ${modulePath}:`, error);
    return null;
  }
}

/* ----------------------------- Startup -------------------------------- */
async function registerRoutes() {
  console.log('🔧 Registering routes...');
  const authRouter = await loadRouter('./routes/auth.js');
  const eventsRouter = await loadRouter('./routes/events.js');
  const teamsRouter = await loadRouter('./routes/teams.js');
  const sitesRouter = await loadRouter('./routes/sites.js');
  const fieldsRouter = await loadRouter('./routes/fields.js');
  const equipmentRouter = await loadRouter('./routes/equipment.js');
  const requestsRouter = await loadRouter('./routes/requests.js');

  if (authRouter) app.use('/api/auth', authRouter);
  if (eventsRouter) app.use('/api/events', eventsRouter);
  if (teamsRouter) app.use('/api/teams', teamsRouter);
  if (sitesRouter) app.use('/api/sites', sitesRouter);
  if (fieldsRouter) app.use('/api/fields', fieldsRouter);
  if (equipmentRouter) app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
  if (requestsRouter) app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

  console.log('✅ Routes registered');
}

async function initDatabase() {
  console.log('🔌 Connecting to database...');
  try {
    await getPool();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️ Database connection failed:', error);
  }
}

async function startServer() {
  console.log('🚀 Bootstrapping server...');
  await initDatabase();
  await registerRoutes();
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

startServer();
