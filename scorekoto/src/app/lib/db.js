import { Pool } from 'pg';

// PostgreSQL connection pool configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Scorekoto',
  password: 'atanu',
  port: 5432,
});

export default pool;