CREATE TABLE IF NOT EXISTS "attendance" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID,
    "device_uid" VARCHAR(50),
    "punch_time" TIMESTAMP(6) NOT NULL,
    "punch_type" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attendance_device_uid_punch_time_key" UNIQUE ("device_uid", "punch_time")
);

ALTER TABLE "attendance"
    ADD CONSTRAINT "attendance_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
