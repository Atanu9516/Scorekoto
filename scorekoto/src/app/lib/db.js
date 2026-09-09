import { Pool } from 'pg';

let pool;

const getPool = () => {
  if (!pool) {
    if (process.env.USE_DATABASE_URL === 'true' && process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    } else {
      pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'Scorekoto',
        password: process.env.DB_PASSWORD || 'atanu',
        port: Number(process.env.DB_PORT) || 5432,
      });
    }
  }
  return pool;
};

export default getPool();