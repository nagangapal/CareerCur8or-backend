const pool = require('./config.cjs');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
	const client = await pool.connect();
	try {
		console.log('🗄️  Initializing database...');
		
		const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
		await client.query(schemaSQL);
		
		console.log('✅ Database initialized successfully!');
	} catch (error) {
		console.error('❌ Error initializing database:', error);
		throw error;
	} finally {
		client.release();
	}
}

module.exports = initDatabase;