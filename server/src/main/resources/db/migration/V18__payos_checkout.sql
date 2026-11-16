-- payOS checkout: the link payOS made for an order, the "someone is requesting a link" mark (a request
-- older than 60 seconds may be retaken) and the amount payOS last reported as received.
ALTER TABLE orders
    ADD COLUMN payos_payment_link_id varchar(64) CONSTRAINT uq_orders_payos_payment_link_id UNIQUE,
    ADD COLUMN payos_link_requested_at timestamptz,
    ADD COLUMN payos_amount_paid bigint;

-- A payment confirmed by the server looking the order up on payOS.
ALTER TABLE payment_transactions
    DROP CONSTRAINT ck_payment_transactions_confirmation_source,
    ADD CONSTRAINT ck_payment_transactions_confirmation_source
        CHECK (confirmation_source IS NULL OR confirmation_source IN ('ADMIN', 'WEBHOOK', 'PAYOS'));

-- The 12 digits after 'TV' are the payOS orderCode; a 13th digit must fail, never be cut silently.
ALTER SEQUENCE order_code_seq MAXVALUE 999999999999;
