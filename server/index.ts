// server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './db.js';

import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import teamsRouter from './routes/teams.js';
import sitesRouter from './routes/sites.js';
import fieldsRouter from './routes/fields.js';
import equipmentRouter from './routes/equipment.js';
import requestsRouter from './routes/requests.js';

import { authenticateToken, requireAdminOrMgmt } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as healthy');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: (error as Error).message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/fields', fieldsRouter);

app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get(/.*/, (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

async function startServer() {
  try {
    await getPool();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (_error) {
    process.exit(1);
  }
}

startServer();
