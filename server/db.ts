import sql from 'mssql';

let pending: Promise<sql.ConnectionPool> | undefined;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!pending) {
    const config: sql.config = {
      server: process.env.SQL_SERVER || '',
      database: process.env.SQL_DATABASE,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      connectionTimeout: 10000,
      requestTimeout: 10000,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { min: 0, max: 5, idleTimeoutMillis: 30000 },
    };
    const pool = new sql.ConnectionPool(config);
    pending = pool.connect().catch(async error => {
      pending = undefined;
      await pool.close();
      throw error;
    });
    pool.on('error', error => {
      console.error('Retired backend pool failed', error.code);
      pending = undefined;
      void pool.close().catch(closeError => console.error('Pool close failed', closeError.code));
    });
  }
  return pending;
}

export async function closePool(): Promise<void> {
  const pool = pending && await pending;
  pending = undefined;
  await pool?.close();
}

export default sql;
