-- Paid courses: price 0 (free) or 10.000–50.000.000 VND; one commission policy seeded at 20%.
-- Refunds are out of scope for the product: dropping the table also drops its indexes and triggers
-- (trg_refunds_validate, trg_refunds_revoke_course_access, trg_refunds_set_updated_at).
ALTER TABLE courses DROP CONSTRAINT ck_courses_free;
ALTER TABLE courses
    ADD CONSTRAINT ck_courses_price
        CHECK (price_amount = 0 OR price_amount BETWEEN 10000 AND 50000000);

INSERT INTO commission_policies (rate_bps, is_active) VALUES (2000, true);

-- A price-only update keeps updated_at: price is outside the review, and the moderator review token
-- is bound to updated_at, so changing the price must not invalidate (or revalidate) a review.
DROP TRIGGER trg_courses_set_updated_at ON courses;
CREATE TRIGGER trg_courses_set_updated_at
    BEFORE UPDATE ON courses FOR EACH ROW
    WHEN ((to_jsonb(OLD) - 'price_amount') IS DISTINCT FROM (to_jsonb(NEW) - 'price_amount'))
    EXECUTE FUNCTION set_updated_at();

DROP TABLE refunds;
DROP FUNCTION validate_refund();
DROP FUNCTION revoke_course_access_after_refund();
