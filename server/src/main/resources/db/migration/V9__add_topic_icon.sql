-- Optional brand icon for a topic: a simple-icons slug picked by an admin (e.g. 'docker'), rendered by the frontend.
-- Only the slug is stored, never a URL or markup; NULL means the UI shows the topic's initials.
ALTER TABLE topics ADD COLUMN icon varchar(64);
ALTER TABLE topics ADD CONSTRAINT topics_icon_slug_check CHECK (icon IS NULL OR icon ~ '^[a-z0-9]{1,64}$');
