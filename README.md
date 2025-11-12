# CareerCur8or — Backend Showcase

This folder is a sanitized, public-facing copy of the CareerCur8or backend. It intentionally
omits any embedded AI prompts, private model endpoints, or credentials so the structure,
APIs, and parsing/curation flows can be reviewed without exposing proprietary content.

This README documents the architecture, main components, HTTP endpoints, how to run the
showcase locally, and the safe local workflow for re-enabling AI features for private/testing
only (prompts are not included in this repository).

## High-level architecture

The showcase keeps the original service boundaries but replaces AI model calls with safe
stubs or optional integrations. The main components are:

- API Gateway / Resume API (`index.cjs`) — main HTTP entrypoint for auth, resume CRUD,
  parsing and curated resume actions.
- Parser modules (`parsers/*`) — extract text from uploaded files and produce structured
  resume JSON (uses pdf-parse, mammoth, textract and an OCR fallback).
- Curator Service — reads parsed resume data and (in private forks) calls an AI model to
  produce curated resumes. In this public copy the AI calls are disabled/stubbed.
- Chat Service — real-time chat in the original app would call AI with resume context;
  here the `/chat` route returns 501 Not Implemented.
- Storage — PostgreSQL (JSONB) for `resumes` and `curated_resumes`.

## Important note on prompts and credentials

- This showcase intentionally does NOT include any prompt text or model credentials.
- If you want to run AI-based parsing/curation locally, place prompt files in a local-only
  directory (for example `src/backend-showcase/prompts/`). The server will attempt to
  read prompt files at runtime if they exist. Example file names (NOT included in this
  repo): `parsing_prompt.txt`, `career_growth.txt`, `job_match.txt`.
- Ensure `prompts/` and `.env` are in `.gitignore` before any push. The default
  `.gitignore` in this showcase already excludes them.

## Main HTTP endpoints (sanitized)

- GET /health — returns a small health JSON to confirm the service is up.
- POST /api/auth/login — email/password login (returns token + user on success).
- POST /api/parse-resume — multipart/form-data upload with `file` field; returns parsed JSON.
- POST /api/resumes — save/update resume JSON.
- GET /api/resumes/:userId — list resumes for a user.
- POST /chat — NOTE: returns 501 Not Implemented in this public copy.

Refer to the code for additional, less commonly used routes (parse-linkedin, curated resume
endpoints, admin/debug helpers).

## Running locally (quick start)

From the repository root:

1. Ensure Node.js is installed (recommended Node 16+).
2. Configure environment variables via a local `.env` (do NOT commit it):
   - PORT=3001
   - DATABASE_URL=postgres://user:pass@localhost:5432/dbname
   - PARSER_SERVICE_URL=http://localhost:8080 (optional)
3. Start the server:
   node src/backend-showcase/index.cjs

The server listens on $PORT or 3001 by default. Use POST /api/parse-resume to test parsing.

## Parser fallback behavior

The server attempts layered parsing of uploaded documents: pdf-parse → mammoth → textract
→ OCR fallback. If a parser-service is configured via `PARSER_SERVICE_URL`, some parsing
work may be forwarded to that service; otherwise the local `basicFallbackParser` will be used.

## Re-enabling AI features (private forks only)

To enable AI-based curation or chat in a private environment:

1. Place prompt files under `src/backend-showcase/prompts/` (local-only). Example names:
   `parsing_prompt.txt`, `career_growth.txt`, `job_match.txt`.
2. Configure model endpoints and credentials via environment variables (do not store in repo).
3. Re-enable the model-calling code paths in the server code (they are intentionally disabled
   in this public copy). Test only in a private environment.

## Security & privacy

- NEVER commit prompt files or `.env` files with credentials to the repository.
- Use a secret manager for production credentials and lock down CORS origins.

## Notes and next steps

- This showcase is intended for review and learning. I can run a final repo-wide scan to
  ensure no prompt text remains anywhere in the codebase and remove any remaining occurrences.
- Optionally I can add a lightweight smoke-test harness that validates `/health` and
  `/api/parse-resume`.

---

![unnamed (2)](https://github.com/user-attachments/assets/e17274e7-2d9d-42e0-803e-7f43d91280b2)
