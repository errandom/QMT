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
const PORT = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as healthy');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: (error as Error).message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../');
  app.use(express.static(webRoot));
  app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(webRoot, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

app.use((err: Error, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (err) => console.error('UNHANDLED_REJECTION:', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT_EXCEPTION:', err));

async function startServer() {
  console.log('🚀 Bootstrapping server...');
  try {
    await getPool();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️ Database connection failed:', error);
  }

  try {
    console.log('🔧 Registering routes...');
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
      import('./routes/teams.js'),
      import('./routes/sites.js'),
      import('./routes/fields.js'),
      import('./routes/equipment.js'),
      import('./routes/requests.js')
    ]);

    app.use('/api/auth', authRouter);
    app.use('/api/events', eventsRouter);
    app.use('/api/teams', teamsRouter);
    app.use('/api/sites', sitesRouter);
    app.use('/api/fields', fieldsRouter);
    app.use('/api/equipment', authenticateToken, requireAdminOrMgmt, equipmentRouter);
    app.use('/api/requests', authenticateToken, requireAdminOrMgmt, requestsRouter);

    console.log('✅ Routes registered');
  } catch (error) {
    console.error('⚠️ Route registration failed:', error);
  }

  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

startServer();
``
