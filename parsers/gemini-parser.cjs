/* eslint-disable no-console */
// Sanitized parser for the public backend showcase.
// The original implementation used Vertex AI (Gemma). To avoid exposing
// model details or prompts, this showcase provides only a basic fallback
// parser and a stub for the advanced parser.

function basicFallbackParser(text) {
    const emailMatch = text ? text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) : null;
    const phoneMatch = text ? text.match(/(\+?\d[\d\s\-()]{7,}\d)/) : null;
    const lines = text ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
    const fullName = lines[0]?.length < 60 ? lines[0] : '';
    const skillsSection = text && text.toLowerCase().includes('skills') ? text.split(/skills[:]?/i)[1]?.split(/\n{2,}/)[0] || '' : '';
    const skills = skillsSection ? skillsSection.split(/[,•\n]/).map((s) => s.trim()).filter((s) => s && s.length < 40).slice(0, 30) : [];
    return { fullName: fullName || '', email: emailMatch?.[0] || '', phone: phoneMatch?.[0] || '', location: '', summary: '', skills, education: [], experience: [], projects: [], links: [] };
}

async function parseResumeWithGemini(text) {
    // Disabled in showcase; callers should use the parser-service or the fallback parser.
    throw new Error('Advanced parser (Vertex AI Gemma) removed from public showcase.');
}

module.exports = { parseResumeWithGemini, basicFallbackParser };
