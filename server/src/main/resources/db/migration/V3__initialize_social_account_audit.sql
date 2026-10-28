-- A newly linked social identity is owned by the user it identifies.
CREATE OR REPLACE FUNCTION initialize_social_account_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_by := COALESCE(NEW.created_by, NEW.user_id);
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, NEW.user_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_social_accounts_initialize_audit_fields
BEFORE INSERT ON social_accounts
FOR EACH ROW
EXECUTE FUNCTION initialize_social_account_audit_fields();
