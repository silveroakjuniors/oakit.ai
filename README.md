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
7. … (continue through all numbered migrations in `db/migrations/`)
8. `db/migrations/080_school_fee_management.sql` — fee management schema additions (see below)

> **Note:** Always run migrations in sequential order. Never skip or re-run an existing migration.

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

## Database Schema — Recent Migrations

### Migration 080 — School Fee Management (`080_school_fee_management.sql`)

Adds infrastructure required by the school fee management feature.

**`student_fee_accounts`**
- Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` — was missing, causing the delete-fee-head cascade soft-delete to fail.

**`fee_structures`**
- Added partial unique index `idx_fee_structures_class_year_active` on `(school_id, class_id, academic_year) WHERE is_active = true AND class_id IS NOT NULL` — enforces one active fee structure per class per academic year at the DB level.

**Performance indexes added**
| Index | Table | Columns |
|---|---|---|
| `idx_fee_structures_school_year` | `fee_structures` | `(school_id, academic_year)` |
| `idx_fee_heads_structure` | `fee_heads` | `(fee_structure_id, deleted_at)` |
| `idx_student_fee_accounts_head` | `student_fee_accounts` | `(fee_head_id, deleted_at)` |
| `idx_concessions_status` | `concessions` | `(school_id, status)` |

> **Required before:** any route that soft-deletes fee heads (cascades to `student_fee_accounts`) or enforces the one-fee-structure-per-class-per-year rule.

---

## Property-Based Tests — School Fee Management

Property tests live in `apps/api-gateway/src/lib/` alongside the modules they validate. Run with:

```bash
cd apps/api-gateway && npm run test
```

### `feeInstalments.property.test.ts`

Tests two correctness properties for instalment scheduling logic.

**Property 3 — Instalment numbering is always sequential starting at 1**  
For any array of N instalment inputs, the assigned `instalment_number` values must form the contiguous sequence `[1, 2, …, N]` with no gaps or duplicates. Also verifies that `label`, `amount`, and `due_date` are preserved unchanged after numbering.  
_Validates: Requirements 12.1, 3.5 — 100 iterations minimum_

**Property 4 — Instalment replacement is atomic**  
After calling the replace-instalments operation with a new set, the stored result must equal exactly the new set — no old instalments remain and all new ones are present with correct sequential numbering.  
_Validates: Requirement 12.3 — 100 iterations minimum_

---

## Middleware Reference

### `salaryPinGuard`

Protects salary-related routes by requiring an active PIN session stored in Redis under `salary_pin_session:{userId}` (8-hour TTL). Returns `403 SALARY_PIN_REQUIRED` if no session exists.

**Bypass rules:**
- `super_admin` — bypasses the PIN requirement (no school-level PIN applies)
- `principal` — bypasses the PIN requirement (principals have unrestricted salary access)

All other roles must complete PIN verification via `POST /api/v1/financial/salary/pin/verify` before accessing salary routes.

---

## Salary Page — UI Behaviour

The salary page (`/admin/finance/salary`) shows a table of salary records for the current month. Each row has:

- **Generate** button — generates a salary slip for the staff member. Disabled while generation is in progress.
- **Mark Paid** button — shown only when the record's `status` is `'draft'`. Opens a confirmation modal where the admin selects a payment mode (`cash`, `bank_transfer`, etc.) and payment date before marking the record as paid.

---

## API Reference — Financial Module

All financial routes are under `/api/v1/financial/` and require a valid JWT (`jwtVerify`). Most also require the financial module to be enabled for the school (`financialModuleGuard`).

### Financial Settings & Permissions (`routes/financial/settings.ts`)

#### `GET /api/v1/financial/settings`
Returns the financial module status for the authenticated user's school.

**Auth:** any authenticated user  
**Response:**
```json
{ "is_enabled": true, "expense_module_enabled": true, "updated_at": "..." }
```
Returns `{ "is_enabled": true, "expense_module_enabled": true }` as defaults when no settings row exists.

---

#### `PUT /api/v1/financial/settings`
Enable or disable the financial module or expense sub-module for a school.

**Auth:** `super_admin` or `franchise_admin` only  
**Body:**
```json
{
  "school_id": "uuid",
  "is_enabled": true,
  "expense_module_enabled": false
}
```
- `franchise_admin` may only update schools within their own franchise.
- Invalidates the Redis cache key `financial_module:<school_id>` immediately so `financialModuleGuard` picks up the change.

---

#### `GET /api/v1/financial/permissions`
Returns the effective financial permission set for the authenticated user, merging JWT claims, role defaults, and per-user DB overrides.

**Auth:** any authenticated user  
**Response:**
```json
{ "permissions": ["VIEW_FEES", "MANAGE_FEE_STRUCTURE", ...], "overrides": { "APPROVE_CONCESSION": true } }
```
Privileged roles (`principal`, `admin`, `super_admin`) cannot have permissions removed by per-user overrides — only additions apply.

---

#### `GET /api/v1/financial/staff`
Lists all active staff users for the school with their current financial permission overrides.

**Auth:** `principal` only  
**Response:** array of `{ id, name, role, financial_permissions }`  
Excludes `principal`, `super_admin`, `franchise_admin`, `parent`, and `student` roles.

---

#### `PUT /api/v1/financial/permissions/:userId`
Updates the financial permission overrides for a specific staff member.

**Auth:** `principal` only  
**Params:** `userId` — UUID of the target user  
**Body:**
```json
{ "permissions": { "VIEW_FEES": true, "MANAGE_FEE_STRUCTURE": false } }
```
- Target user must belong to the same school.
- Cannot be applied to `principal`, `super_admin`, `franchise_admin`, `parent`, or `student` roles.
- Writes an `audit_logs` record with `action = 'UPDATE_PERMISSIONS'` and `module = 'financial'`.

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
