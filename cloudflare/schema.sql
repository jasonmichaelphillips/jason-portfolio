CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS videos_published_at_idx
ON videos(published_at DESC);
