-- Baseline migration: pre-existing tables that predate the migrations folder.
-- Idempotent so it is safe to apply on a DB already created via init.sql.
-- This migration does NOT recreate the legacy overtime tables (overtime_permit /
-- overtime / overtime_detail) — those were dropped by 20260607_overtime_module
-- and replaced by overtime_request / overtime_line.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nik"          NUMERIC,
  "name"         VARCHAR(255),
  "role"         VARCHAR(255),
  "access"       VARCHAR(255),
  "email"        VARCHAR(255),
  "departement"  VARCHAR(255),
  "section"      VARCHAR(255),
  "status"       VARCHAR(255),
  "worker_stats" VARCHAR(255),
  "join_date"    DATE,
  "username"     VARCHAR(255),
  "password"     VARCHAR(255),
  "hash"         CHAR(255),
  "link_image"   VARCHAR(255),
  "deletedAt"    TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS "performance" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID REFERENCES "users"("id"),
  "quarter"     INTEGER,
  "status"      VARCHAR(255),
  "description" VARCHAR(255),
  "created_at"  TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);
