// filepath: /workspaces/spark-template/src/test-mssql.ts
import sql from 'mssql';

const sqlConfig = {
  user: 'QMTmgmt',
  password: 'Renegades!1982',
  server: 'qmt.database.windows.net',
  database: 'renegadesdb',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function testMssql() {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query('SELECT 1 AS test');
    console.log('Connection successful:', result.recordset);
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testMssql();