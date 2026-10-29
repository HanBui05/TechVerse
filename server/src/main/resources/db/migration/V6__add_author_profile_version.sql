-- Keep existing applications; version protects review/resubmit against stale browser tabs.
ALTER TABLE author_profiles ADD COLUMN version bigint NOT NULL DEFAULT 0;
