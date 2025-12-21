// Run database migration to add notes, team_ids, recurring_days, and recurring_end_date columns
import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate required environment variables
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set these environment variables before running the migration.');
  process.exit(1);
}

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
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
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    console.log('Connected successfully!');

    // Read the migration SQL file
    const migrationSQL = readFileSync(join(__dirname, 'add-notes-and-team-ids.sql'), 'utf8');
    
    console.log('\nRunning migration...\n');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\nGO\s*$/gim).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`Executing batch ${i + 1}/${batches.length}...`);
        const result = await pool.request().query(batch);
        console.log('Success!');
        
        // Print any messages from the server
        if (result.recordset && result.recordset.length > 0) {
          console.log(result.recordset);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    await pool.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
