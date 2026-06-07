-- Drop broken legacy overtime tables (child-first for FK order)
DROP TABLE IF EXISTS "overtime_detail" CASCADE;
DROP TABLE IF EXISTS "overtime" CASCADE;
DROP TABLE IF EXISTS "overtime_permit" CASCADE;

-- Header: one row per submitted batch
CREATE TABLE "overtime_request" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "submitted_by"  UUID NOT NULL REFERENCES "users"("id"),
  "departement"   VARCHAR(255),
  "date"          DATE NOT NULL,
  "shift"         INTEGER,
  "status"        VARCHAR(20) NOT NULL DEFAULT 'pending',
  "approved_by"   UUID REFERENCES "users"("id"),
  "approved_at"   TIMESTAMP(6),
  "reject_reason" VARCHAR(255),
  "created_at"    TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMP(6) NOT NULL DEFAULT now()
);

-- Line: one row per worker within a batch
CREATE TABLE "overtime_line" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL REFERENCES "overtime_request"("id") ON DELETE CASCADE,
  "user_id"    UUID NOT NULL REFERENCES "users"("id"),
  "start_time" TIMESTAMP(6) NOT NULL,
  "end_time"   TIMESTAMP(6) NOT NULL,
  "hours"      DECIMAL(5,2) NOT NULL,
  "reason"     VARCHAR(255),
  "multiplier" DECIMAL(4,2),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "idx_ot_request_status" ON "overtime_request"("status");
CREATE INDEX "idx_ot_request_submitted_by" ON "overtime_request"("submitted_by");
CREATE INDEX "idx_ot_request_date" ON "overtime_request"("date");
CREATE INDEX "idx_ot_line_request" ON "overtime_line"("request_id");
CREATE INDEX "idx_ot_line_user" ON "overtime_line"("user_id");
