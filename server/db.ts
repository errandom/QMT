import * as sql from 'mssql';

let cachedPool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (cachedPool) {
    return cachedPool;
  }

  const server = process.env.DB_SERVER ?? '';
  const user = process.env.DB_USER ?? '';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_DATABASE ?? '';

  const missing: string[] = [];
  if (!server) missing.push('DB_SERVER');
  if (!user) missing.push('DB_USER');
  if (!password) missing.push('DB_PASSWORD');
  if (!database) missing.push('DB_DATABASE');

  if (missing.length) {
    throw new Error(`Missing database environment variables: ${missing.join(', ')}`);
  }

  const config: sql.config = {
    server,
    user,
    password,
    database,
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

  cachedPool = await sql.connect(config);
  return cachedPool;
}
