-- Peacock — initial schema
-- Run with: psql -d peacock -f sql/001_init.sql   (or: npm run db:setup)

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- ---- enums ----
DO $$ BEGIN
  CREATE TYPE share_type AS ENUM ('ONE_TIME', 'TIME_BASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE access_type AS ENUM ('PUBLIC', 'PASSWORD_PROTECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- users ----
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- notes ----
CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_author_id_idx ON notes(author_id);

-- ---- share links ----
CREATE TABLE IF NOT EXISTS share_links (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token           TEXT NOT NULL UNIQUE,
  note_id         TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  creator_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  share_type      share_type  NOT NULL,
  access_type     access_type NOT NULL,

  -- bcrypt hash of the generated access key (NULL for PUBLIC links)
  password_hash   TEXT,

  -- absolute expiry for TIME_BASED links (NULL for ONE_TIME links)
  expires_at      TIMESTAMPTZ,

  -- lifecycle
  revoked         BOOLEAN     NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,            -- set when a ONE_TIME link is consumed

  -- atomic view counter (only successful views increment it)
  view_count      INTEGER     NOT NULL DEFAULT 0,

  -- brute-force throttling for PASSWORD_PROTECTED links
  failed_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_note_id_idx    ON share_links(note_id);
CREATE INDEX IF NOT EXISTS share_links_creator_id_idx ON share_links(creator_id);

-- ---- view log (one row per successful, counted view) ----
CREATE TABLE IF NOT EXISTS view_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  share_link_id TEXT NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash       TEXT
);
CREATE INDEX IF NOT EXISTS view_logs_share_link_id_idx ON view_logs(share_link_id);
