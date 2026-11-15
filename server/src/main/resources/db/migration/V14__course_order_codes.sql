-- Order codes are 'TV' + 12 digits from this sequence: unique, never reused, short enough for a bank
-- transfer description, and they do not expose the order UUID.
CREATE SEQUENCE order_code_seq;

-- "I have transferred" flag set by the buyer; it never changes the order status or grants access.
ALTER TABLE orders ADD COLUMN transfer_reported_at timestamptz;
