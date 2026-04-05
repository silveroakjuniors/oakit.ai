"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// When using Supabase pgbouncer (transaction mode), we need a small pool
// and must avoid prepared statements (they're not supported in transaction mode)
const isPgBouncer = (process.env.DATABASE_URL || '').includes('pgbouncer=true');
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: isPgBouncer ? 5 : 10,
    // pgbouncer transaction mode doesn't support prepared statements
    ...(isPgBouncer ? { statement_timeout: 30000 } : {}),
});
