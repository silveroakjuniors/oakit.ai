import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// When using Supabase pgbouncer (transaction mode), we need a small pool
// and must avoid prepared statements (they're not supported in transaction mode)
const isPgBouncer = (process.env.DATABASE_URL || '').includes('pgbouncer=true');
const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isPgBouncer ? 5 : 10,
  // Supabase requires SSL in production
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // pgbouncer transaction mode doesn't support prepared statements
  ...(isPgBouncer ? { statement_timeout: 30000 } : {}),
});
