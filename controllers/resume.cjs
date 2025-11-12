const pool = require('../db/config');

async function saveResume(req, res) {
	try {
		const { userId, resumeData } = req.body;
		
		if (!userId) {
			return res.status(400).json({ error: 'User ID required' });
		}
		
		const {
			fullName,
			email,
			phone,
			location,
			summary,
			skills,
			education,
			experience,
			projects,
			links
		} = resumeData;
		
		// Check if user already has a resume
		const existing = await pool.query(
			'SELECT id FROM resumes WHERE user_id = $1',
			[userId]
		);
		
		let result;
		if (existing.rows.length > 0) {
			// Update existing resume
			result = await pool.query(
				`UPDATE resumes SET 
					full_name = $1, email = $2, phone = $3, location = $4, 
					summary = $5, skills = $6, education = $7, experience = $8,
					projects = $9, links = $10, updated_at = CURRENT_TIMESTAMP
				WHERE user_id = $11 
				RETURNING *`,
				[fullName, email, phone, location, summary, 
				 JSON.stringify(skills), JSON.stringify(education), JSON.stringify(experience),
				 JSON.stringify(projects), JSON.stringify(links), userId]
			);
		} else {
			// Insert new resume
			result = await pool.query(
				`INSERT INTO resumes 
					(user_id, full_name, email, phone, location, summary, skills, education, experience, projects, links)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				RETURNING *`,
				[userId, fullName, email, phone, location, summary,
				 JSON.stringify(skills), JSON.stringify(education), JSON.stringify(experience),
				 JSON.stringify(projects), JSON.stringify(links)]
			);
		}
		
		res.json({ 
			success: true, 
			resume: result.rows[0]
		});
	} catch (error) {
		console.error('Save resume error:', error);
		res.status(500).json({ error: 'Failed to save resume' });
	}
}

async function getResume(req, res) {
	try {
		const { userId } = req.params;
		
		if (!userId) {
			return res.status(400).json({ error: 'User ID required' });
		}
		
		const result = await pool.query(
			'SELECT * FROM resumes WHERE user_id = $1',
			[userId]
		);
		
		if (result.rows.length === 0) {
			return res.json({ resume: null });
		}
		
		const resume = result.rows[0];
		
		// Parse JSON fields
		res.json({ 
			success: true,
			resume: {
				id: resume.id,
				fullName: resume.full_name,
				email: resume.email,
				phone: resume.phone,
				location: resume.location,
				summary: resume.summary,
				skills: resume.skills,
				education: resume.education,
				experience: resume.experience,
				projects: resume.projects,
				links: resume.links,
				createdAt: resume.created_at,
				updatedAt: resume.updated_at
			}
		});
	} catch (error) {
		console.error('Get resume error:', error);
		res.status(500).json({ error: 'Failed to get resume' });
	}
}

module.exports = { saveResume, getResume };