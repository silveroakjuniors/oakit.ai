# Oakit.ai — Product Overview

Oakit.ai is an AI-powered curriculum management and school operations platform for preschools and primary schools. It is a multi-tenant SaaS product where each school is an isolated tenant identified by a `school_id`.

## Core Value Proposition
- AI assistant ("Oakie") that helps teachers plan lessons, track curriculum coverage, and communicate with parents
- Curriculum ingestion from PDF textbooks, chunked and embedded for RAG-based Q&A
- Day-by-day lesson planning with coverage tracking and carry-forward logic
- Parent engagement: feed, homework, attendance, milestones, observations, messaging
- School operations: financial module (fees, salary, expenses), HR (offer letters, leave), student portal, quizzes

## User Roles
- **super_admin** — platform-level, manages all schools and franchises
- **franchise_admin** — manages a group of schools; cannot access individual school PII
- **admin** — school admin; full access within their school
- **principal** — school principal; oversight of teachers, coverage, HR
- **teacher** — manages their assigned sections; core daily user
- **parent** — read-only access to their child's data
- **student** — access to student portal (feed, quizzes)
- **staff** — non-teaching staff; HR self-service only

## AI Assistant ("Oakie")
- Never refer to the AI as "AI" in user-facing text — always use "Oakie"
- Uses pgvector for semantic search over curriculum chunks
- AI credits system controls usage per school

## Brand
- Primary color: `#1B4332` (dark forest green) — CSS var `--brand-primary`
- Accent color: `#E8960C` (warm amber)
- Font: Inter / SF Pro Display
- Tone: warm, encouraging, teacher-friendly
