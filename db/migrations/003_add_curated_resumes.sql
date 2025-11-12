-- Add curated resumes table for AI-generated 1-page resumes
CREATE TABLE IF NOT EXISTS curated_resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resume_id)
);

-- Index for faster lookups
CREATE INDEX idx_curated_resumes_user_id ON curated_resumes(user_id);
CREATE INDEX idx_curated_resumes_resume_id ON curated_resumes(resume_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_curated_resume_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_curated_resume_timestamp
BEFORE UPDATE ON curated_resumes
FOR EACH ROW
EXECUTE FUNCTION update_curated_resume_timestamp();
