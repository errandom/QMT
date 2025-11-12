process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

import { Database } from './lib/database.js';

// ...rest of your code...

async function testConnection() {
  try {
    const users = await Database.select('users');
    console.log('Connection successful. Users:', users);
  } catch (err) {
    // Print error as string and JSON for full details
    console.error('Connection failed:');
    console.error('Error (string):', String(err));
    try {
      console.error('Error (JSON):', JSON.stringify(err, null, 2));
    } catch (jsonErr) {
      // If error can't be stringified
      console.error('Error could not be stringified:', jsonErr);
    }
    if (err && err.stack) {
      console.error('Error stack:', err.stack);
    }
  }
}

testConnection();