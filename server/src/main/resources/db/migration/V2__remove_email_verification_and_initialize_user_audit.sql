-- Email verification is not part of the current authentication flow.
ALTER TABLE users
    DROP COLUMN email_verified_at;

-- Backfill existing local accounts before the insert trigger handles new ones.
UPDATE users
SET created_by = COALESCE(created_by, id),
    updated_by = COALESCE(updated_by, created_by, id)
WHERE created_by IS NULL
   OR updated_by IS NULL;

-- A self-registered account is its own creator and initial updater.
-- For authenticated actions, Spring Data auditing preserves the acting user's UUID instead.
CREATE OR REPLACE FUNCTION initialize_user_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_by := COALESCE(NEW.created_by, NEW.id);
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_initialize_audit_fields
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_audit_fields();
