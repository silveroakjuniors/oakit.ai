# Oakit.ai — Curriculum Management Platform

AI-powered curriculum management for schools. Built with Next.js, Node.js, Python FastAPI, PostgreSQL + pgvector, and Ollama (local LLM — zero API cost).

---

## Project Structure

```
oakit/
  apps/
    frontend/        Next.js 14 + Tailwind CSS (deploy to Vercel)
    api-gateway/     Node.js + Express (deploy to Railway/Render)
    ai-service/      Python FastAPI (deploy to Railway/Render)
  db/
    migrations/      SQL migration files (run in Supabase SQL editor)
    seed.sql         Initial data for Silveroak Juniors
    seed_admin_hash.js  Helper to generate admin password hash
  docker-compose.yml  Local dev: PostgreSQL+pgvector, Redis, Ollama
  .env.example        Copy to .env and fill in values
```

---

## Quick Start

### 1. Database (Supabase)

Run these SQL files in order in your Supabase SQL editor:
1. `db/migrations/001_extensions.sql`
2. `db/migrations/002_schools_roles_users.sql`
3. `db/migrations/003_classes_sections.sql`
4. `db/migrations/004_calendar.sql`
5. `db/migrations/005_curriculum.sql`
6. `db/migrations/006_plans_logs.sql`

Then generate the admin password hash:
```bash
node db/seed_admin_hash.js Admin@1234
```
Replace the placeholder in `db/seed.sql`, then run it in Supabase.

### 2. Environment Variables

```bash
cp .env.example apps/api-gateway/.env
cp .env.example apps/ai-service/.env
cp .env.example apps/frontend/.env.local
```

Edit each `.env` with your Supabase DATABASE_URL, Redis URL, etc.
For frontend `.env.local`, set:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Local Development

Start infrastructure:
```bash
docker-compose up -d
```

Pull Ollama model (one-time):
```bash
docker exec -it oakit-ollama-1 ollama pull llama3.1:8b
```

Install dependencies:
```bash
# Node
npm install                              # root workspaces
cd apps/api-gateway && npm install
cd apps/frontend && npm install

# Python
cd apps/ai-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Start services (run each in a separate terminal):
```bash
# API Gateway
cd apps/api-gateway && npm run dev

# AI Service
cd apps/ai-service && uvicorn main:app --reload --port 8000

# Frontend
cd apps/frontend && npm run dev
```

Open http://localhost:3000

### 4. First Login

- School code: `sojs`
- Email: `admin@silveroakjuniors.edu`
- Password: `Admin@1234` (or whatever you set in seed)

---

## Deployment

### Frontend → Vercel
```bash
cd apps/frontend
vercel deploy
```
Set `NEXT_PUBLIC_API_URL` to your Railway/Render API gateway URL.

### API Gateway + AI Service → Railway
1. Create two Railway services from the `apps/api-gateway` and `apps/ai-service` directories.
2. Set environment variables from `.env.example`.
3. For AI service, note: Ollama needs a GPU instance or a machine with enough RAM (8GB+).

---

## Brand

- Primary color: `#1B4332` (dark forest green)
- Accent color: `#F5A623` (golden yellow)
- Font: Inter

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS + PWA |
| API Gateway | Node.js + Express + TypeScript |
| AI Service | Python 3.11 + FastAPI |
| LLM | Ollama (Llama 3.1 8B) — free, local |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 — free |
| Database | PostgreSQL + pgvector (Supabase) |
| Cache | Redis |
| PDF Parsing | pdfplumber |
