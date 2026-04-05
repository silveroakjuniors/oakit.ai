// Run this from oakit/apps/api-gateway directory:
//   node ../../db/generate_parent_hashes.js
//
// It generates the SQL to update parent passwords using bcryptjs
// (same library the API uses), so hashes are guaranteed compatible.

const bcrypt = require('bcryptjs');

const SCHOOL_ID = 'a0000000-0000-0000-0000-000000000001';
const parents = [
  { mobile: '9900000001', name: 'Rajesh Sharma' },
  { mobile: '9900000002', name: 'Amit Mehta' },
  { mobile: '9900000003', name: 'Anil Verma' },
  { mobile: '9900000004', name: 'Rohit Sharma' },
  { mobile: '9900000005', name: 'Farhan Ahmed' },
  { mobile: '9900000006', name: 'Suresh Patel' },
];

async function main() {
  console.log('-- Run this SQL in Supabase to fix parent passwords');
  console.log('-- Password for each parent = their mobile number\n');

  for (const p of parents) {
    const hash = await bcrypt.hash(p.mobile, 12);
    console.log(`UPDATE parent_users SET password_hash = '${hash}', is_active = true, force_password_reset = false`);
    console.log(`  WHERE school_id = '${SCHOOL_ID}' AND mobile = '${p.mobile}'; -- ${p.name}`);
    console.log();
  }

  console.log('-- After running above SQL, login with:');
  console.log('-- School: sojs | Mobile: <number> | Password: <same number>');
}

main().catch(console.error);
