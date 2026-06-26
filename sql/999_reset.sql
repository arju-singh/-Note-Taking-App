-- Drops everything (dev convenience). Used by `npm run db:reset`.
DROP TABLE IF EXISTS view_logs CASCADE;
DROP TABLE IF EXISTS share_links CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS share_type;
DROP TYPE IF EXISTS access_type;
