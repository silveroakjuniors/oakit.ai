/**
 * Run this to generate a bcrypt hash for the admin password.
 * Usage: node seed_admin_hash.js
 * Then replace the placeholder in seed.sql with the output.
 */
const bcrypt = require('bcryptjs');
const password = process.argv[2] || 'Admin@1234';
const hash = bcrypt.hashSync(password, 12);
console.log(`\nPassword: ${password}`);
console.log(`Hash:     ${hash}`);
console.log('\nReplace the placeholder in seed.sql with this hash.\n');
