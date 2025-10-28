require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

module.exports = pool;

// Check database connection at startup
pool.query('SELECT NOW()')
	.then(res => {
		console.log('Database connected:', res.rows[0].now);
	})
	.catch(err => {
		console.error('Database connection error:', err.message);
	});
