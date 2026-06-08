CREATE TABLE "shift" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       VARCHAR(255) NOT NULL,
  "start_time" TIME NOT NULL,
  "end_time"   TIME NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE TABLE "holiday" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date"       DATE NOT NULL UNIQUE,
  "name"       VARCHAR(255),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

ALTER TABLE "users" ADD COLUMN "shift_id" UUID REFERENCES "shift"("id");

CREATE INDEX "idx_users_shift" ON "users"("shift_id");
CREATE INDEX "idx_holiday_date" ON "holiday"("date");
