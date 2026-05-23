# Project Structure

## Repository Layout

```
oakit/                          # Monorepo root (npm workspaces)
├── apps/
│   ├── frontend/               # Next.js 14 app (port 3000)
│   ├── api-gateway/            # Express API server (port 3001)
│   └── ai-service/             # Python FastAPI AI server (port 8000)
├── db/
│   ├── migrations/             # Sequential SQL migration files (001_*.sql → 079_*.sql)
│   └── seeds/                  # Seed data SQL files
├── docker-compose.yml          # Local infra: PostgreSQL, Redis, Ollama
└── .env.example                # Template for all service env vars
```

## Frontend (`apps/frontend/src`)

```
src/
├── app/                        # Next.js App Router pages
│   ├── admin/                  # School admin portal
│   ├── teacher/                # Teacher portal
│   ├── principal/              # Principal portal
│   ├── parent/                 # Parent portal
│   ├── student/                # Student portal
│   ├── franchise-admin/        # Franchise admin portal
│   ├── super-admin/            # Platform super admin
│   ├── auth/ login/            # Authentication pages
│   └── layout.tsx / page.tsx   # Root layout and home redirect
├── components/                 # Shared feature components (modals, editors, etc.)
│   ├── layout/                 # Shell/nav layout components
│   └── ui/                     # Generic UI wrappers
├── UIComponents/               # Design system component library
│   ├── primitives/             # Atoms: Button, Badge, Input, Toggle, Spinner, Avatar
│   ├── components/             # Molecules: Card, Modal, Alert, Tabs, CollapsiblePanel
│   ├── patterns/               # Organisms: PageHeader, EmptyState, StatCard
│   ├── feedback/               # Skeleton, Toast
│   ├── tokens/                 # Design tokens (colors, spacing, animation)
│   └── index.ts                # Barrel export — always import from here
├── features/                   # Feature-specific components (admin, feed, parent, student)
├── contexts/                   # React contexts (ThemeContext)
├── hooks/                      # Custom hooks (useVoiceInput, useSessionManager, etc.)
└── lib/                        # Client utilities (api.ts, auth.ts, branding.ts, theme.ts)
```

## API Gateway (`apps/api-gateway/src`)

```
src/
├── index.ts                    # Express app entry — all route registration here
├── routes/
│   ├── admin/                  # Admin-only routes
│   ├── teacher/                # Teacher routes
│   ├── principal/              # Principal routes
│   ├── parent/                 # Parent routes
│   ├── student/                # Student portal routes
│   ├── financial/              # Financial module routes (fee-gated)
│   ├── franchise/              # Franchise admin routes
│   ├── super-admin/            # Super admin routes
│   ├── staff/                  # Staff HR self-service
│   ├── shared/                 # Cross-role shared routes
│   └── public/                 # Unauthenticated routes
├── middleware/
│   ├── auth.ts                 # JWT verification + role enforcement
│   ├── rateLimit.ts            # API and auth rate limiters
│   ├── piiGuard.ts             # Blocks franchise_admin from school PII
│   ├── chunkGuard.ts           # Blocks school users from modifying franchise curriculum
│   ├── financialModuleGuard.ts # Gates financial routes behind module enable flag
│   └── salaryPinGuard.ts       # PIN protection for salary data
└── lib/
    ├── db.ts                   # pg Pool singleton
    ├── redis.ts                # Redis client
    ├── jwt.ts                  # Token sign/verify helpers
    ├── permissions.ts          # Role permission helpers
    ├── feeCalculation.ts       # Fee computation logic
    ├── salaryCalculation.ts    # Salary computation logic
    ├── templateSubstitution.ts # HR letter template engine
    ├── pdfService.ts           # PDF generation helpers
    ├── storage.ts              # Supabase Storage helpers
    └── today.ts                # Date/time helpers (respects time-machine)
```

## AI Service (`apps/ai-service`)

```
main.py                         # FastAPI app — all HTTP endpoints
query_pipeline.py               # RAG query logic (embed → search → LLM)
planner_service.py              # Monthly plan generation
planner_engine.py               # Plan scheduling logic
ingestion_service.py            # PDF ingestion orchestration
extractor.py                    # PDF text/table extraction (pdfplumber)
chunker.py                      # Curriculum chunking logic
embeddings.py                   # Embedding generation
coverage_analyzer.py            # Coverage log analysis
llm_client.py                   # Ollama LLM client
prompts.py                      # LLM prompt templates
db.py                           # asyncpg pool
api-gateway/                    # Duplicate gateway (legacy — prefer apps/api-gateway)
```

## Database Conventions

- Migrations are numbered sequentially: `NNN_description.sql`
- New migrations always get the next number — never modify existing migration files
- All tables include `school_id` for multi-tenant isolation
- UUIDs used for all primary keys
- `created_at` / `updated_at` timestamps on all tables
- Raw SQL only — no ORM

## Key Conventions

**API Routes**
- All routes versioned under `/api/v1/`
- Route files grouped by role: `routes/teacher/`, `routes/admin/`, etc.
- Each router applies `jwtVerify` middleware internally — not at the index level
- Financial routes additionally require `financialModuleGuard`

**Frontend**
- Always import UI components from `@/UIComponents` (the barrel export)
- Use `apiGet` / `apiPost` / `apiPatch` / `apiDelete` from `src/lib/api.ts` for all API calls
- Auth token stored in cookies, accessed via `src/lib/auth.ts`
- Role-based pages live under `src/app/{role}/` — each role has its own directory tree

**Multi-tenancy**
- Every DB query must filter by `school_id` — never return cross-school data
- `franchise_admin` role has a `piiGuard` that blocks access to student/teacher/parent PII endpoints
- Franchise-owned curriculum chunks are protected by `chunkGuard` — schools cannot modify them
