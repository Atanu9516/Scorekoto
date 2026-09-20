import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// PostgreSQL connection pool: connects to Supabase when DATABASE_URL is set, or falls back to local
const pool = new Pool({
  ...(connectionString
    ? {
        connectionString,
        ssl: connectionString.includes('localhost')
          ? false
          : { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'Scorekoto',
        password: process.env.DB_PASSWORD || 'atanu',
        port: Number(process.env.DB_PORT) || 5432,
      }),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export default pool;