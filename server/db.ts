import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const config: sql.config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 60000, // 60 seconds - allows time for serverless DB to wake
    requestTimeout: 60000, // 60 seconds for queries
  },
  pool: {
    max: 10,
    min: 1, // Keep at least 1 connection alive
    idleTimeoutMillis: 300000, // 5 minutes before closing idle connections
    acquireTimeoutMillis: 60000, // Wait up to 60s to acquire connection
  },
};

// Create connection pool
let pool: sql.ConnectionPool | null = null;
let isConnecting = false;
let keepAliveInterval: NodeJS.Timeout | null = null;

/**
 * Get database connection pool with retry logic for serverless DB wake-up
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  // If we have a healthy pool, return it
  if (pool && pool.connected) {
    return pool;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for the ongoing connection attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getPool();
  }

  isConnecting = true;
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}/${maxRetries}...`);
      
      // Close any stale pool
      if (pool) {
        try {
          await pool.close();
        } catch (e) {
          // Ignore close errors
        }
        pool = null;
      }

      pool = await sql.connect(config);
      console.log('✓ Connected to Azure SQL Database');
      
      // Start keep-alive ping to prevent connection from going stale
      startKeepAlive();
      
      isConnecting = false;
      return pool;
    } catch (error) {
      lastError = error as Error;
      console.error(`[DB] Connection attempt ${attempt} failed:`, (error as Error).message);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(5000 * attempt, 15000);
        console.log(`[DB] Retrying in ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  isConnecting = false;
  throw lastError || new Error('Failed to connect to database');
}

/**
 * Keep the database connection alive with periodic pings
 * This helps prevent the Azure SQL serverless database from pausing
 */
function startKeepAlive(): void {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // Ping the database every 4 minutes to keep it awake
  // Azure SQL serverless pauses after no activity (configurable, default 1 hour)
  const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 minutes
  
  keepAliveInterval = setInterval(async () => {
    try {
      if (pool && pool.connected) {
        await pool.request().query('SELECT 1');
        console.log('[DB] Keep-alive ping successful');
      }
    } catch (error) {
      console.error('[DB] Keep-alive ping failed:', (error as Error).message);
      // Connection might be stale, clear the pool so next request reconnects
      pool = null;
    }
  }, KEEP_ALIVE_INTERVAL);

  // Don't let this interval prevent the process from exiting
  keepAliveInterval.unref();
}

export async function closePool(): Promise<void> {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  if (pool) {
    await pool.close();
    pool = null;
    console.log('✓ Database connection closed');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

export default sql;
