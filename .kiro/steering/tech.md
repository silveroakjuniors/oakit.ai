# Tech Stack

## Services

| Service | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS 3 + PWA (next-pwa) |
| API Gateway | Node.js + Express 4 + TypeScript 5 |
| AI Service | Python 3.11 + FastAPI + Ollama (Llama 3.1 8B) |
| Database | PostgreSQL + pgvector (hosted on Supabase) |
| Cache | Redis 4 |
| Storage | Supabase Storage (S3-compatible) |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 |

## Key Libraries

**API Gateway**
- `pg` — PostgreSQL client (raw SQL, no ORM)
- `jsonwebtoken` — JWT auth
- `bcryptjs` — password hashing
- `helmet` + `express-rate-limit` — security
- `multer` — file uploads
- `pdf-lib` / `pdfkit` — PDF generation
- `exceljs` / `xlsx` — spreadsheet import/export
- `redis` — caching and session management
- `fast-check` — property-based testing
- `jest` + `ts-jest` — unit testing

**Frontend**
- `swr` — data fetching and caching
- `framer-motion` — animations
- `lucide-react` — icons
- `@tiptap/*` — rich text editor
- `pdfjs-dist` — PDF preview
- `@playwright/test` — E2E and functional testing

**AI Service**
- `fastapi` + `uvicorn` — HTTP server
- `asyncpg` — async PostgreSQL
- `pdfplumber` — PDF text extraction
- `reportlab` — PDF generation
- `openpyxl` — Excel parsing

## Common Commands

### Root (workspace)
```bash
# Install all workspaces
npm install

# Start frontend dev server
npm run dev:frontend

# Start API gateway dev server
npm run dev:api
```

### API Gateway (`oakit/apps/api-gateway`)
```bash
npm run dev       # ts-node-dev with hot reload (port 3001)
npm run build     # tsc compile to dist/
npm run start     # run compiled dist/index.js
npm run test      # jest --run (single pass, no watch)
```

### Frontend (`oakit/apps/frontend`)
```bash
npm run dev       # Next.js dev server (port 3000)
npm run build     # Next.js production build
npm run start     # serve production build

# Playwright tests (run manually — do not use watch mode)
npm run test:e2e              # all E2E tests
npm run test:e2e:teacher      # teacher role only
npm run test:functional       # functional tests
```

### AI Service (`oakit/apps/ai-service`)
```bash
# Activate venv first (Windows)
venv\Scripts\activate

uvicorn main:app --reload --port 8000
```

### Infrastructure
```bash
# Start local PostgreSQL + Redis + Ollama
docker-compose up -d

# Pull Ollama model (one-time)
docker exec -it oakit-ollama-1 ollama pull llama3.1:8b
```

### Database
```bash
# Run migrations in order in Supabase SQL editor
# Files are in oakit/db/migrations/ numbered sequentially

# Generate admin password hash
node db/seed_admin_hash.js Admin@1234
```

## Environment Variables

Copy `.env.example` to each service's `.env` / `.env.local`:
- `apps/api-gateway/.env` — `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `AI_SERVICE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `apps/frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `apps/ai-service/.env` — `DATABASE_URL`, `OLLAMA_BASE_URL`

## Testing Conventions

- API Gateway unit tests: `*.test.ts` files co-located in `src/lib/`
- Property-based tests: `*.property.test.ts` using `fast-check`
- Frontend E2E: Playwright tests in `apps/frontend/tests/`
- Always run `npm run test` (not `--watch`) in CI and spec task execution
