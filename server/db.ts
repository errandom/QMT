// server/db.ts
import * as sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER ?? '',
  database: process.env.DB_DATABASE ?? '',
  user: process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000
  },
  pool: {
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000
  }
};

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * Connect with retry logic to handle cold starts and transient failures.
 */
async function connectWithRetry(retries = 5, delayMs = 2000): Promise<sql.ConnectionPool> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const p = await new sql.ConnectionPool(config).connect();
      pool = p;
      return p;
    } catch (err) {
      console.error(`DB connect attempt ${attempt}/${retries} failed:`, (err as Error)?.message ?? err);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unable to connect to SQL after retries');
}

/**
 * Get a singleton pool instance. Creates and caches if not already connected.
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  if (!poolPromise) poolPromise = connectWithRetry(5, 2000);
  return poolPromise;
}

/**
 * Close the pool gracefully (optional for shutdown hooks).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
  }
