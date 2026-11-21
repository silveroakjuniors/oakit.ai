import { Pool } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Force IPv4 DNS resolution globally — prevents ETIMEDOUT on IPv6 Supabase endpoints
dns.setDefaultResultOrder('ipv4first');

const rawUrl = process.env.DATABASE_URL || '';
const isPgBouncer = rawUrl.includes('pgbouncer=true');
const isSupabase  = rawUrl.includes('supabase.com');

// Supabase requires SSL regardless of environment
const sslConfig = isSupabase ? { rejectUnauthorized: false } : false;

// Build pool config — parse password separately to handle special chars like @
// that get mangled when percent-encoded in a connection string
function buildPoolConfig() {
  const config: any = {
    ssl: sslConfig,
    max: isPgBouncer ? 5 : 10,
    ...(isPgBouncer ? { statement_timeout: 30000 } : {}),
  };

  try {
    const url = new URL(rawUrl);
    config.host     = url.hostname;
    config.port     = Number(url.port) || 5432;
    config.database = url.pathname.replace(/^\//, '');
    config.user     = url.username;
    // decodeURIComponent decodes %40 → @ which Node's URL.password does NOT do
    config.password = decodeURIComponent(url.password);
  } catch {
    config.connectionString = rawUrl;
  }

  // PGPASSWORD env always wins — explicit override for special characters
  if (process.env.PGPASSWORD) {
    config.password = process.env.PGPASSWORD;
  }

  console.log('[db] Connecting to', config.host || 'connection-string', 'as', config.user || 'url-user');
  return config;
}

export const pool = new Pool(buildPoolConfig());
