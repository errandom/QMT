import bcrypt from 'bcryptjs';

/**
 * Utility script to generate bcrypt password hashes
 * Usage: npx tsx server/utils/hashPassword.ts <password>
 */

const password = process.argv[2];

if (!password) {
  console.error('Usage: npx tsx server/utils/hashPassword.ts <password>');
  process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log('\n=================================');
console.log('Password Hash Generated');
console.log('=================================');
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUse this hash in your SQL INSERT statement:');
console.log(`INSERT INTO users (username, password_hash, role, email, full_name, is_active)`);
console.log(`VALUES ('username', '${hash}', 'admin', 'email@example.com', 'Full Name', 1);`);
console.log('=================================\n');
