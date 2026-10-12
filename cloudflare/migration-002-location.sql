ALTER TABLE videos ADD COLUMN location_description TEXT;
ALTER TABLE videos ADD COLUMN location_checked INTEGER NOT NULL DEFAULT 0;
