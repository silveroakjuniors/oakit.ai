# Oakit Database Migrations

Run these in order against your Supabase/PostgreSQL instance:

1. `001_extensions.sql` — Enable uuid-ossp and pgvector
2. `002_schools_roles_users.sql` — Core auth tables
3. `003_classes_sections.sql` — School structure
4. `004_calendar.sql` — Academic calendar
5. `005_curriculum.sql` — PDF documents and chunks with vector embeddings
6. `006_plans_logs.sql` — Day plans and coverage tracking

For Supabase: paste each file into the SQL editor in order.
For local Docker: `psql -U oakit -d oakit -f migrations/00X_name.sql`
