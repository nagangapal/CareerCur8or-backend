const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
	// Prioritize DB_* env vars (Docker) over PG* vars (local .env)
	host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
	port: process.env.DB_PORT || process.env.PGPORT || 5432,
	database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
	user: process.env.DB_USER || process.env.PGUSER || 'postgres',
	password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
	console.error('Unexpected error on idle client', err);
});

module.exports = pool;