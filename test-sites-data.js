// Test script to check sites data
require('dotenv').config();
const sql = require('mssql');

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
  }
};

async function testSitesData() {
  console.log('=== Testing Sites Data ===\n');
  
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✓ Connected to database\n');
    
    // Get all sites
    const result = await pool.request().query(`
      SELECT * FROM sites
    `);
    
    console.log(`Found ${result.recordset.length} sites:\n`);
    
    result.recordset.forEach((site, index) => {
      console.log(`Site ${index + 1}:`);
      console.log(`  ID: ${site.id}`);
      console.log(`  Name: ${site.name}`);
      console.log(`  Address: ${site.address}`);
      console.log(`  City: ${site.city}`);
      console.log(`  Zip Code: ${site.zip_code}`);
      console.log(`  Latitude: ${site.latitude}`);
      console.log(`  Longitude: ${site.longitude}`);
      console.log(`  Contact First Name: ${site.contact_first_name}`);
      console.log(`  Contact Last Name: ${site.contact_last_name}`);
      console.log(`  Contact Phone: ${site.contact_phone}`);
      console.log(`  Contact Email: ${site.contact_email}`);
      console.log(`  Is Sports Facility: ${site.is_sports_facility}`);
      console.log(`  Amenities: ${site.amenities}`);
      console.log(`  Active: ${site.active}`);
      console.log('');
    });
    
    await pool.close();
    console.log('✓ Test complete');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testSitesData();
