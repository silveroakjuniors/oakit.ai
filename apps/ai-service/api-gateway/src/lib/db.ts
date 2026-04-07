import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isPgBouncer = (process.env.DATABASE_URL || '').includes('pgbouncer=true');
const isSupabase = (process.env.DATABASE_URL || '').includes('supabase.com');

// Supabase requires SSL regardless of environment (pooler enforces it)
const sslConfig = isSupabase ? { rejectUnauthorized: false } : false;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isPgBouncer ? 5 : 10,
  ssl: sslConfig,
  ...(isPgBouncer ? { statement_timeout: 30000 } : {}),
});
