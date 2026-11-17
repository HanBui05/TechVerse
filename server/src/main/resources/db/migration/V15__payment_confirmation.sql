-- Who confirmed a payment and how: MANUAL rows are confirmed by an Admin; a future webhook leaves confirmed_by null.
ALTER TABLE payment_transactions
    ADD COLUMN confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN confirmation_source varchar(20),
    ADD COLUMN confirmed_at timestamptz,
    ADD CONSTRAINT ck_payment_transactions_confirmation_source
        CHECK (confirmation_source IS NULL OR confirmation_source IN ('ADMIN', 'WEBHOOK'));

-- Duplicate-payment flag for the Admin; reconciled_* keep the last close, a new anomaly reopens the flag.
ALTER TABLE orders
    ADD COLUMN needs_reconciliation boolean NOT NULL DEFAULT false,
    ADD COLUMN reconciled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN reconciled_at timestamptz;

CREATE INDEX idx_orders_needs_reconciliation ON orders (created_at DESC) WHERE needs_reconciliation;

-- A successful payment pays the order and grants access once per learner and course:
--  * the buyer's users row is locked first, so two orders of one learner are serialised;
--  * an order that was already PAID, or a course the learner can already open, flags the order
--    for reconciliation instead of a second enrollment (no revoke, no refund in the product);
--  * paid_at keeps the first payment.
CREATE OR REPLACE FUNCTION grant_course_access_after_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    buyer uuid;
BEGIN
    IF NEW.status <> 'SUCCEEDED' OR (TG_OP = 'UPDATE' AND OLD.status = 'SUCCEEDED') THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO buyer FROM orders WHERE id = NEW.order_id;
    PERFORM 1 FROM users WHERE id = buyer FOR UPDATE;

    UPDATE orders o
       SET needs_reconciliation = o.needs_reconciliation OR o.status = 'PAID' OR EXISTS (
               SELECT 1
                 FROM order_items oi
                 JOIN course_enrollments ce
                   ON ce.user_id = o.user_id AND ce.course_id = oi.course_id AND ce.revoked_at IS NULL
                WHERE oi.order_id = o.id),
           status = 'PAID',
           paid_at = COALESCE(o.paid_at, NEW.paid_at, now())
     WHERE o.id = NEW.order_id;

    INSERT INTO course_enrollments (user_id, course_id, source, order_item_id, granted_at)
    SELECT o.user_id, oi.course_id, 'PURCHASE', oi.id, now()
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = NEW.order_id
       AND NOT EXISTS (
           SELECT 1 FROM course_enrollments ce
            WHERE ce.user_id = o.user_id AND ce.course_id = oi.course_id AND ce.revoked_at IS NULL)
    ON CONFLICT (order_item_id) DO NOTHING;

    RETURN NEW;
END;
$$;
