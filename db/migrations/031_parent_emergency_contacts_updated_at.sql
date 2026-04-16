-- Migration 031: auto-update updated_at on parent_emergency_contacts
CREATE OR REPLACE FUNCTION set_updated_at_parent_emergency_contacts()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_parent_emergency_contacts ON parent_emergency_contacts;
CREATE TRIGGER trg_set_updated_at_parent_emergency_contacts
BEFORE UPDATE ON parent_emergency_contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at_parent_emergency_contacts();
