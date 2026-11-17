-- Commission history and order-time snapshots are immutable. A policy can only be closed once
-- (is_active true -> false, effective_to set once); changing the rate means a new policy row.
CREATE FUNCTION protect_commission_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.rate_bps <> OLD.rate_bps
       OR NEW.effective_from <> OLD.effective_from
       OR (NEW.is_active AND NOT OLD.is_active)
       OR (OLD.effective_to IS NOT NULL AND NEW.effective_to IS DISTINCT FROM OLD.effective_to) THEN
        RAISE EXCEPTION 'Commission policy % is immutable; it can only be closed', OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commission_policies_protect
BEFORE UPDATE ON commission_policies
FOR EACH ROW
EXECUTE FUNCTION protect_commission_policy();

-- The split is computed once at insert; recomputing on UPDATE would hide a rewrite attempt.
DROP TRIGGER trg_order_items_calculate_revenue ON order_items;
CREATE TRIGGER trg_order_items_calculate_revenue
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION calculate_order_item_revenue();

CREATE FUNCTION protect_order_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.order_id, NEW.course_id, NEW.unit_price_amount, NEW.commission_policy_id,
        NEW.commission_rate_bps, NEW.commission_amount, NEW.author_net_amount)
       IS DISTINCT FROM
       (OLD.order_id, OLD.course_id, OLD.unit_price_amount, OLD.commission_policy_id,
        OLD.commission_rate_bps, OLD.commission_amount, OLD.author_net_amount) THEN
        RAISE EXCEPTION 'Order item % price and commission snapshot is immutable', OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_items_protect_snapshot
BEFORE UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION protect_order_item_snapshot();
