# Smart Security Monitor - Agent Documentation

## Project Overview
A full-stack video surveillance, face recognition, and visitor tracking system.
- Backend: Node.js + Express + TypeScript
- Face Engine: Python (FastAPI + InsightFace) bridge
- Database: SQLite via Prisma ORM
- Frontend: React 19 + Vite + Tailwind CSS

## Architecture
- `server.ts` — Express REST API + WebSocket server (port 3000)
- `face-engine.ts` — TS client to Python FastAPI face recognition server (port 8001)
- `db.ts` — Prisma singleton (SQLite)
- `prisma/schema.prisma` — DB schema
- `src/` — React frontend (Vite dev server on port 5173, proxies to :3000)

## Key Scripts
- `npm run dev` — starts face-engine, server, Vite concurrently
- `npm run build` — bundles server via esbuild + Vite build for frontend
- `npm start` — runs production server from `dist/server.mjs`
- `npm run lint` — TypeScript check + ESLint

## Security Middleware (added)
- `helmet()` — HTTP security headers
- `cors()` — CORS configuration (env: `CORS_ORIGIN`)
- `express-rate-limit` — rate limiting on `/api` and `/webhooks`
  - API: 100 req/min
  - Webhooks: 10 req/min

## Environment Variables (.env)
Required for production:
- `API_KEY` — secret key for API + WebSocket auth (set BOTH server and client)
- `FACE_API_KEY` — secret key for Python face server `/update-index` endpoint
- `FACE_SERVER_URL` — URL of Python FastAPI server (default: `http://localhost:8001`)
- `DATABASE_URL` — SQLite path (default: `file:./dev.db?journal_mode=WAL`)
- `NODE_ENV` — `development` or `production`

### IMPORTANT
- The `.env` file must be customized from `.env.example` before production deployment
- `FACE_API_KEY=super-secret-change-me` in `.env.example` is a known placeholder — change it
- Camera default credentials `admin/admin` in example config must be changed

## Logging
Uses `winston` with `winston-daily-rotate-file`:
- `logs/app-YYYY-MM-DD.log` — daily rotating, max 20MB, keep 14 days
- `logs/errors-YYYY-MM-DD.log` — daily rotating errors, keep 30 days

## Testing & Linting
- TypeScript: `tsc --noEmit --skipLibCheck`
- ESLint: `eslint . --ext .ts,.tsx` (config in `eslint.config.js`)
- Combined: `npm run lint`

## Known Issues / Unresolved
1. npm audit shows 12 transitive vulnerabilities through `exceljs → archiver → brace-expansion` chain — requires upstream fix or migration away from exceljs
2. ESLint `no-undef` shows false positives for TypeScript types (e.g., `RequestInit` in face-engine.ts) — pre-existing, not new
3. `start-face.js` spawns Python server using `spawn` with `shell: true` removed in fix (now `shell: false`)
4. No Prisma migration has been run yet (DB is at `prisma/dev.db`)