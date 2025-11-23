let cachedPool: any = null;

exportexport async function getPool() {
  if (cachedPool) return cachedPool;

  const sql = await import('mssql'); // dynamic import
  const config = {
    server: process.env.DB_SERVER!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    options: { encrypt: true, trustServerCertificate: false }
  };

  cachedPool = await sql.connect(config);
  return cachedPool;
}
