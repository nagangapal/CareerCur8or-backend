const pool = require('../db/config.cjs');
const bcrypt = require('bcrypt');

async function login(req, res) {
	try {
		const { username, password } = req.body;
		
		if (!username || !password) {
			return res.status(400).json({ error: 'Username and password required' });
		}

		// Fetch user by username only
		const result = await pool.query(
			'SELECT id, username, email, password FROM users WHERE username = $1',
			[username]
		);
		if (result.rows.length === 0) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}
		const row = result.rows[0];

		let valid = false;
		// Prefer bcrypt comparison; if hash is not bcrypt (legacy), fallback to plain compare
		if (typeof row.password === 'string' && row.password.startsWith('$2')) {
			valid = await bcrypt.compare(password, row.password);
		} else {
			valid = password === row.password;
		}
		if (!valid) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		const user = { id: row.id, username: row.username, email: row.email };
		
		console.log('🔍 Login successful for user:', user);
		
		// In a real app, you'd use JWT or sessions here
		// For now, we'll return the user info
		res.json({ 
			success: true,
			token: 'db-auth-token',
			user: {
				id: user.id,
				username: user.username,
				email: user.email
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Login failed' });
	}
}

async function signup(req, res) {
	try {
		const { username, password, email } = req.body;
		
		if (!username || !password) {
			return res.status(400).json({ error: 'Username and password required' });
		}

		// Hash password with bcrypt
		const hash = await bcrypt.hash(password, 10);
		const result = await pool.query(
			'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email',
			[username, hash, email]
		);
		
		const user = result.rows[0];
		
		res.json({ 
			success: true, 
			user: {
				id: user.id,
				username: user.username,
				email: user.email
			}
		});
	} catch (error) {
		if (error.code === '23505') { // Unique violation
			return res.status(409).json({ error: 'Username already exists' });
		}
		console.error('Signup error:', error);
		res.status(500).json({ error: 'Signup failed' });
	}
}

module.exports = { login, signup };