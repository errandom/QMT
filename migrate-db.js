// Run database migration to add notes, team_ids, recurring_days, and recurring_end_date columns
import sql from 'mssql';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment or hardcoded values
// NOTE: In production, use environment variables or secure configuration
const config = {
  user: process.env.SQL_USER || process.env.DB_USER || '',
  password: process.env.SQL_PASSWORD || process.env.DB_PASSWORD || '',
  server: process.env.SQL_SERVER || process.env.DB_SERVER || '',
  database: process.env.SQL_DATABASE || process.env.DB_NAME || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function runMigration() {
  // Check if we have database credentials
  if (!config.user || !config.password || !config.server || !config.database) {
    console.error('\n❌ ERROR: Missing database credentials!');
    console.error('\nPlease provide database credentials in one of these ways:');
    console.error('1. Set environment variables: SQL_USER, SQL_PASSWORD, SQL_SERVER, SQL_DATABASE');
    console.error('   (or DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME)');
    console.error('2. Create a .env file with these variables');
    console.error('\nExample .env file:');
    console.error('SQL_USER=your_username');
    console.error('SQL_PASSWORD=your_password');
    console.error('SQL_SERVER=your_server.database.windows.net');
    console.error('SQL_DATABASE=your_database_name');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    console.log(`Server: ${config.server}`);
    console.log(`Database: ${config.database}`);
    console.log(`User: ${config.user}\n`);
    
    const pool = await sql.connect(config);
    console.log('✓ Connected successfully!\n');

    // Read the migration SQL file
    const migrationSQL = readFileSync(join(__dirname, 'add-notes-and-team-ids.sql'), 'utf8');
    
    console.log('Running migration...\n');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\nGO\s*$/gim).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`Executing batch ${i + 1}/${batches.length}...`);
        const result = await pool.request().query(batch);
        console.log('✓ Success!');
        
        // Print any messages from the server (like PRINT statements)
        if (result.recordset && result.recordset.length > 0) {
          console.log(result.recordset);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nThe following columns have been added to the events table:');
    console.log('  - notes (for separate notes field)');
    console.log('  - team_ids (for multiple teams support)');
    console.log('  - recurring_days (for recurring events)');
    console.log('  - recurring_end_date (for recurring events)');
    console.log('\nPlease restart your server for the changes to take effect.');
    
    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

runMigration();
