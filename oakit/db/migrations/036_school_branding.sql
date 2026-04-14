-- Migration 036: School branding — logo, primary color, tagline
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1A3C2E';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Ensure school_settings table has updated_at column
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
