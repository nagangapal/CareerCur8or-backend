/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');
const { login, signup } = require('./controllers/auth.cjs');
const pool = require('./db/config.cjs');
// Try to reuse the basic fallback parser from parsers if present
let basicFallbackParser = null;
try {
	const parsers = require('./parsers/gemini-parser.cjs');
	basicFallbackParser = parsers.basicFallbackParser;
} catch (e) {
	basicFallbackParser = (text) => ({ fullName: '', email: '', phone: '', location: '', summary: '', skills: [], education: [], experience: [], projects: [], links: [] });
}

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

const corsOptions = {
	origin: function (origin, callback) {
		if (!origin) return callback(null, true);
		const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'https://careercur8or.app'];
		if (allowedOrigins.indexOf(origin) !== -1) callback(null, true);
		else callback(null, true);
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

const poolReady = (async () => {
	try {
		const t0 = Date.now();
		const r = await pool.query('SELECT 1');
		console.log('Database ping ok in', Date.now() - t0, 'ms');
	} catch (e) {
		console.error('Initial database ping failed. Will retry in background.', e.message);
		let attempts = 0;
		const max = 5;
		const retry = async () => {
			attempts += 1;
			try {
				const r = await pool.query('SELECT 1');
				console.log('Database ping recovered on attempt', attempts);
			} catch (err) {
				if (attempts < max) setTimeout(retry, 1500 * attempts);
				else console.error('Database still unreachable after retries.');
			}
		};
		setTimeout(retry, 1000);
	}
})();

process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION', err));
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION', reason));

app.get('/health', (req, res) => res.json({ ok: true, api: 'up', database: 'postgresql' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/parse-resume', upload.single('file'), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ error: 'NO_FILE', message: 'No file uploaded' });
		const mime = req.file.mimetype || '';
		let text = '';
		try {
			if (mime.includes('pdf')) {
				if (typeof PDFParse === 'function') {
					let parser;
					try {
						parser = new PDFParse({ data: req.file.buffer });
						const data = await parser.getText();
						text = data.text || '';
					} catch (errPrimaryPdf) {
						console.warn('pdf-parse failed:', errPrimaryPdf?.message);
					} finally {
						if (parser?.destroy) await parser.destroy();
					}
				}
			} else if (mime.includes('word') || req.file.originalname.endsWith('.docx')) {
				const result = await mammoth.extractRawText({ buffer: req.file.buffer });
				text = result.value || '';
			} else if (mime.includes('text') || req.file.originalname.endsWith('.txt')) {
				text = req.file.buffer.toString('utf-8');
			}
		} catch (errPrimary) {
			console.warn('Primary parser failed:', errPrimary?.message);
		}
		if (!text || text.trim().length < 10) {
			try {
				text = await new Promise((resolve, reject) => {
					textract.fromBufferWithMime(mime || 'application/octet-stream', req.file.buffer, (err, t) => {
						if (err) return reject(err);
						resolve(t || '');
					});
				});
			} catch (errFallback) {
				console.warn('textract fallback failed:', errFallback?.message);
			}
		}
		if (!text || text.trim().length < 5) {
			const extracted = basicFallbackParser('');
			return res.json({ extracted, warning: 'PARSE_FAILED: Could not extract text. If this is a scanned PDF, OCR is required.' });
		}

		// Attempt to use parser service if configured
		let extracted;
		try {
			const parserUrl = process.env.PARSER_SERVICE_URL || 'http://localhost:8080';
			const FormData = require('form-data');
			const formData = new FormData();
			formData.append('resume', req.file.buffer, { filename: 'resume.txt', contentType: 'text/plain' });
			const fetch = global.fetch || require('node-fetch');
			const parserResponse = await fetch(`${parserUrl}/parse-resume`, { method: 'POST', body: formData, headers: formData.getHeaders ? formData.getHeaders() : {} });
			if (!parserResponse.ok) throw new Error(`Parser service returned ${parserResponse.status}`);
			const parserData = await parserResponse.json();
			extracted = parserData.extracted || parserData;
		} catch (parserError) {
			console.warn('Parser service failed, using basic fallback:', parserError?.message || parserError);
			extracted = basicFallbackParser(text);
		}

		return res.json({ extracted });
	} catch (e) {
		console.error('parse-resume error', e);
		return res.status(500).json({ error: 'INTERNAL', message: 'Failed to parse resume' });
	}
});

app.post('/api/auth/login', login);
app.post('/api/auth/signup', signup);

app.post('/api/resumes', async (req, res) => {
	try {
		const { userId, fullName, email, phone, location, summary, skills, education, experience, projects, links } = req.body;
		if (!userId) return res.status(400).json({ error: 'User ID required' });
		const existing = await pool.query('SELECT id FROM resumes WHERE user_id = $1', [userId]);
		const educationJson = JSON.stringify(education || []);
		const experienceJson = JSON.stringify(experience || []);
		const projectsJson = JSON.stringify(projects || []);
		const linksJson = JSON.stringify(links || []);
		let result;
		if (existing.rows.length > 0) {
			result = await pool.query(
				`UPDATE resumes SET full_name = $1, email = $2, phone = $3, location = $4, summary = $5, skills = $6::text[], education = $7::jsonb, experience = $8::jsonb, projects = $9::jsonb, links = $10::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $11 RETURNING *`,
				[fullName, email, phone, location, summary, skills, educationJson, experienceJson, projectsJson, linksJson, userId]
			);
		} else {
			result = await pool.query(
				`INSERT INTO resumes (user_id, full_name, email, phone, location, summary, skills, education, experience, projects, links) VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb) RETURNING *`,
				[userId, fullName, email, phone, location, summary, skills, educationJson, experienceJson, projectsJson, linksJson]
			);
		}
		const savedResume = result.rows[0];
		return res.json({ success: true, resume: savedResume, message: 'Resume saved to database successfully!' });
	} catch (error) {
		console.error('Save resume error:', error);
		return res.status(500).json({ error: 'Failed to save resume' });
	}
});

app.get('/api/resumes/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		const resumesResult = await pool.query('SELECT * FROM resumes WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
		if (resumesResult.rows.length === 0) return res.json({ resumes: [] });
		const resumesWithData = resumesResult.rows.map(resume => ({
			id: resume.id,
			userId: resume.user_id,
			fullName: resume.full_name,
			email: resume.email,
			phone: resume.phone,
			location: resume.location,
			summary: resume.summary,
			skills: resume.skills || [],
			education: resume.education || [],
			experience: resume.experience || [],
			projects: resume.projects || [],
			links: resume.links || [],
			createdAt: resume.created_at,
			updatedAt: resume.updated_at
		}));
		return res.json({ resumes: resumesWithData });
	} catch (error) {
		console.error('Get resumes error:', error);
		return res.status(500).json({ error: 'Failed to fetch resumes' });
	}
});

app.get('/api/curated-resume/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		const result = await pool.query(
			`SELECT cr.*, r.id as resume_id FROM curated_resumes cr JOIN resumes r ON cr.resume_id = r.id WHERE cr.user_id = $1 ORDER BY cr.updated_at DESC LIMIT 1`,
			[userId]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'No curated resume found' });
		const curatedResume = result.rows[0];
		return res.json({ id: curatedResume.id, resumeId: curatedResume.resume_id, content: curatedResume.content, createdAt: curatedResume.created_at, updatedAt: curatedResume.updated_at });
	} catch (error) {
		console.error('Get curated resume error:', error);
		return res.status(500).json({ error: 'Failed to fetch curated resume' });
	}
});

app.put('/api/curated-resume/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const { content } = req.body;
		if (!content) return res.status(400).json({ error: 'Content is required' });
		await pool.query('UPDATE curated_resumes SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(content), id]);
		return res.json({ success: true, message: 'Curated resume updated' });
	} catch (error) {
		console.error('Update curated resume error:', error);
		return res.status(500).json({ error: 'Failed to update curated resume' });
	}
});

// Chat endpoint is disabled in the public showcase
app.post('/chat', async (req, res) => {
	return res.status(501).json({ error: 'Chat endpoint removed in backend showcase. AI functionality is not included.', restore_instructions: 'Restore original chat logic and supply prompt files in src/backend-showcase/prompts/ to re-enable.' });
});

app.post('/api/parse-linkedin', upload.single('linkedinExport'), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ error: 'No LinkedIn export ZIP file provided' });
		const FormData = require('form-data');
		const formData = new FormData();
		formData.append('linkedinExport', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
		const fetch = global.fetch || require('node-fetch');
		const parserUrl = process.env.PARSER_SERVICE_URL || 'http://localhost:8080';
		const response = await fetch(`${parserUrl}/parse-linkedin`, { method: 'POST', body: formData, headers: formData.getHeaders ? formData.getHeaders() : {} });
		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || 'Parser service error');
		}
		const data = await response.json();
		return res.json(data);
	} catch (error) {
		console.error('LinkedIn parse error:', error);
		return res.status(500).json({ error: 'Failed to parse LinkedIn export', message: error.message });
	}
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
	console.log('API server running on http://localhost:' + port);
});


