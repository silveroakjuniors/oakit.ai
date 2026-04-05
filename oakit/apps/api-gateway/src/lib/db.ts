import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// When using Supabase pgbouncer (transaction mode), we need a small pool
// and must avoid prepared statements (they're not supported in transaction mode)
const isPgBouncer = (process.env.DATABASE_URL || '').includes('pgbouncer=true');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isPgBouncer ? 5 : 10,
  // pgbouncer transaction mode doesn't support prepared statements
  ...(isPgBouncer ? { statement_timeout: 30000 } : {}),
});
