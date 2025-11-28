import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getPool } from './db.js';
import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

// Static imports for routes
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import teamsRouter from './routes/teams.js';
import sitesRouter from './routes/sites.js';
import fieldsRouter from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter from './routes/requests.js';

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
const clientPath = path.resolve(__dirname, '../client'); // dist/server/../client -> dist/client
app.use(express.static(clientPath));

app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientPath, 'index.html'));
});

/* ----------------------------- Startup ----------------------------- */
(async () => {
  try {
    console.log('🚀 Bootstrapping server...');
    await getPool(); // Warm-up DB
    console.log('✅ Database connected (warm)');
  } catch (error) {
    console.error('⚠️ Database warm-up failed:', error);
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
process.onprocess.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));
