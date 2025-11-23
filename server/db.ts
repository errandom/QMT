// server/db.ts
import sql from 'mssql';

let cachedPool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (cachedPool) return cachedPool;

  const config: sql.config = {
    server: process.env.DB_SERVER ?? '',
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? '',
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  // Basic validation to surface missing env quickly
   const required = ['DB_SERVER', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing database environment variables: ${missing.join(', ')}`);
  }

  cachedPool = await sql.connect(config);
  return cachedPool;
