-- Idempotent schema. Safe to run repeatedly (npm run db:migrate).
CREATE TABLE IF NOT EXISTS reel_items (
  id SERIAL PRIMARY KEY,
  reel SMALLINT NOT NULL CHECK (reel IN (1,2,3)),
  label TEXT NOT NULL,
  image_url TEXT,
  weight INT NOT NULL DEFAULT 1 CHECK (weight >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spins (
  id BIGSERIAL PRIMARY KEY,
  reel1_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  reel2_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  reel3_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  reel1_label TEXT NOT NULL,
  reel2_label TEXT NOT NULL,
  reel3_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE spins ADD COLUMN IF NOT EXISTS script_position INT;
CREATE INDEX IF NOT EXISTS spins_created_idx ON spins (created_at DESC);
-- Spin script: row N decides the Nth spin since the last position reset. NULL reel = random for that reel.
CREATE TABLE IF NOT EXISTS spin_script (
  position INT PRIMARY KEY CHECK (position > 0),
  reel1_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  reel2_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  reel3_item_id INT REFERENCES reel_items(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Images uploaded in the admin. Kept in the database because the hosting (Vercel) cannot write files at runtime.
CREATE TABLE IF NOT EXISTS images (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
