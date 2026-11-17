-- One receiving bank account per author; only the owner and Admins read it.
CREATE TABLE author_payout_accounts (
    user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bank_id      varchar(20)  NOT NULL,
    account_no   varchar(30)  NOT NULL,
    account_name varchar(100) NOT NULL,
    updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_author_payout_accounts_set_updated_at
BEFORE UPDATE ON author_payout_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Money an Admin transferred to an author by hand; the account is snapshotted at payout time.
-- Balance is never stored: earned (PAID author_net_amount) minus the sum of these rows.
CREATE TABLE author_payouts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id      uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount         bigint       NOT NULL CONSTRAINT ck_author_payouts_amount CHECK (amount > 0),
    bank_reference varchar(255) NOT NULL CONSTRAINT uq_author_payouts_bank_reference UNIQUE,
    bank_id        varchar(20)  NOT NULL,
    account_no     varchar(30)  NOT NULL,
    account_name   varchar(100) NOT NULL,
    created_by     uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_author_payouts_author ON author_payouts (author_id, created_at DESC, id DESC);

-- A recorded payout is final; mistakes are settled outside the system.
CREATE FUNCTION reject_author_payout_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Author payout % is immutable', OLD.id;
END;
$$;

CREATE TRIGGER trg_author_payouts_immutable
BEFORE UPDATE OR DELETE ON author_payouts
FOR EACH ROW
EXECUTE FUNCTION reject_author_payout_change();
