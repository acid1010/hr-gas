-- HR Gas PostgreSQL init script
-- Runs once on first container boot (postgres entrypoint auto-runs /docker-entrypoint-initdb.d/*.sql)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nik          NUMERIC,
  name         VARCHAR(255),
  role         VARCHAR(255),
  access       VARCHAR(255),
  email        VARCHAR(255),
  departement  VARCHAR(255),
  section      VARCHAR(255),
  status       VARCHAR(255),
  worker_stats VARCHAR(255),
  join_date    DATE,
  username     VARCHAR(255),
  password     VARCHAR(255),
  hash         CHAR(255),
  link_image   VARCHAR(255),
  "deletedAt"  TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS overtime_permit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  permission VARCHAR(255),
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overtime (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_permit_id UUID REFERENCES overtime_permit(id),
  departement       VARCHAR(255),
  dates             DATE,
  shift             INTEGER,
  created_at        TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overtime_detail (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  necessary  VARCHAR(255),
  start_time DATE,
  end_time   DATE,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  overtime_id UUID REFERENCES overtime(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  device_uid VARCHAR(50),
  punch_time TIMESTAMP(6) NOT NULL,
  punch_type INTEGER,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_device_uid_punch_time_key UNIQUE (device_uid, punch_time)
);

CREATE TABLE IF NOT EXISTS performance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  quarter     INTEGER,
  status      VARCHAR(255),
  description VARCHAR(255),
  created_at  TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- ── Seed: admin user ────────────────────────────────────────────────────────
-- username: mdata  /  password: gasjaya  (bcrypt cost 10)

INSERT INTO users (
  nik, name, role, access, departement, username, hash, status
) VALUES (
  0,
  'Admin',
  'admin',
  'full',
  'it',
  'mdata',
  '$2b$10$Eg4MtjJpAPFpmdX2idKciuoOyhJ1WURHf3SEx1JBUxa4aGW2hLSaC',
  'active'
) ON CONFLICT DO NOTHING;
