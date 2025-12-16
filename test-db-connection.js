// Direct database connection test
const sql = require('mssql');

// Print environment
console.log('=== Environment Variables ===');
console.log('SQL_SERVER:', process.env.SQL_SERVER);
console.log('SQL_DATABASE:', process.env.SQL_DATABASE);
console.log('SQL_USER:', process.env.SQL_USER);
console.log('SQL_PASSWORD:', process.env.SQL_PASSWORD ? '***SET***' : 'MISSING');
console.log('');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

console.log('=== Connection Config (sanitized) ===');
console.log(JSON.stringify({
  ...sqlConfig,
  password: '***',
  user: sqlConfig.user
}, null, 2));
console.log('');

async function testConnection() {
  console.log('=== Starting Connection Test ===');
  console.log('Attempting to connect to Azure SQL...');
  
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✓ Connection successful!');
    
    console.log('\nTesting query...');
    const result = await pool.request().query('SELECT @@VERSION AS Version');
    console.log('✓ Query successful!');
    console.log('SQL Server Version:', result.recordset[0].Version);
    
    console.log('\nTesting database access...');
    const dbTest = await pool.request().query('SELECT DB_NAME() AS CurrentDB');
    console.log('✓ Current Database:', dbTest.recordset[0].CurrentDB);
    
    await pool.close();
    console.log('\n=== SUCCESS: All tests passed ===');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Connection failed!');
    console.error('Error type:', err.name);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    
    if (err.originalError) {
      console.error('\nOriginal error:');
      console.error('  Type:', err.originalError.name);
      console.error('  Message:', err.originalError.message);
      console.error('  Info:', err.originalError.info);
    }
    
    console.error('\nFull error object:', JSON.stringify(err, null, 2));
    
    console.error('\n=== Troubleshooting Tips ===');
    console.error('1. Verify firewall: Azure Portal > SQL Server > Networking > Allow Azure services');
    console.error('2. Check credentials: Ensure SQL_USER and SQL_PASSWORD are correct');
    console.error('3. Verify server: Should be like "yourserver.database.windows.net"');
    console.error('4. Check database name: Ensure SQL_DATABASE exists on the server');
    console.error('5. Test from Azure Portal: SQL Database > Query editor');
    
    process.exit(1);
  }
}

testConnection();
