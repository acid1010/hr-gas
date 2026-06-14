-- Leave module: request header + per-user annual balance
-- Mirrors overtime_request approval flow (pending -> approved/rejected)

-- Header: one row per leave request (typically one user per request)
CREATE TABLE "leave_request" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       UUID NOT NULL REFERENCES "users"("id"),
  "submitted_by"  UUID NOT NULL REFERENCES "users"("id"),
  "leave_type"    VARCHAR(20) NOT NULL,
  "start_date"    DATE NOT NULL,
  "end_date"      DATE NOT NULL,
  "days"          DECIMAL(4,1) NOT NULL,
  "reason"        VARCHAR(500),
  "status"        VARCHAR(20) NOT NULL DEFAULT 'pending',
  "approved_by"   UUID REFERENCES "users"("id"),
  "approved_at"   TIMESTAMP(6),
  "reject_reason" VARCHAR(255),
  "created_at"    TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "leave_request_dates_chk" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "leave_request_type_chk"  CHECK ("leave_type" IN ('annual','sick','personal','maternity','unpaid')),
  CONSTRAINT "leave_request_status_chk" CHECK ("status" IN ('pending','approved','rejected'))
);

CREATE INDEX "idx_leave_request_user"      ON "leave_request"("user_id");
CREATE INDEX "idx_leave_request_submitter" ON "leave_request"("submitted_by");
CREATE INDEX "idx_leave_request_status"    ON "leave_request"("status");
CREATE INDEX "idx_leave_request_start"     ON "leave_request"("start_date");

-- Annual quota tracking (one row per user/year/type)
CREATE TABLE "leave_balance" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "year"       INTEGER NOT NULL,
  "leave_type" VARCHAR(20) NOT NULL,
  "entitled"   DECIMAL(4,1) NOT NULL DEFAULT 0,
  "used"       DECIMAL(4,1) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "leave_balance_unique" UNIQUE ("user_id","year","leave_type"),
  CONSTRAINT "leave_balance_type_chk" CHECK ("leave_type" IN ('annual','sick','personal','maternity','unpaid'))
);

CREATE INDEX "idx_leave_balance_user_year" ON "leave_balance"("user_id","year");
