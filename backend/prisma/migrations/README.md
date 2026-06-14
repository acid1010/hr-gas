# Database Migrations

This project uses **hand-written SQL migrations**. We do **not** use
`prisma migrate dev` — it generates noise, requires shadow DBs, and we want
full control over destructive changes (especially data fixes).

## Layout

```
prisma/
  schema.prisma                       <- declarative model (source of truth for the Prisma client)
  migrations/
    20260604_baseline/migration.sql   <- one folder per migration, sortable by date prefix
    20260605_add_attendance/migration.sql
    ...
```

One folder per migration. Folder name = `YYYYMMDD_snake_case_description`. The
date prefix sorts naturally and matches the rough order changes were applied.
The single file inside is always called `migration.sql` (Prisma-compatible
layout — lets us switch on `prisma migrate resolve` later if we ever want to).

## Workflow when changing the schema

1. Edit `prisma/schema.prisma` to reflect the new shape.
2. Hand-write the SQL migration in a new dated folder.
3. Apply it locally: `psql "$DATABASE_URL" -f prisma/migrations/<folder>/migration.sql`
4. Regenerate the Prisma client: `npx prisma generate`
5. Run tests: `npm test` (the `verify-schema` test will fail if the DB doesn't
   actually have what `schema.prisma` claims).
6. Commit schema + migration + any code that depends on the new shape together.

## Rules

- **Never edit a migration after it's been merged.** Ship a new one.
- **Idempotency is encouraged.** Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN
  IF NOT EXISTS`, `DROP ... IF EXISTS`. Cheap insurance for re-runs.
- **Data migrations need a `RUN-ONCE` header.** See
  `20260609_fix_attendance_timezone/migration.sql` for the pattern. Comment
  the destructive statement out after it has been applied to production.
- **No `prisma migrate dev`, no `prisma db push`.** They will create a
  `_prisma_migrations` table and try to manage state we manage ourselves.
- **Bootstrapping a fresh DB:** apply migrations in order, skipping any
  RUN-ONCE data migrations (they have headers calling this out).
- **Container first-boot init (`init.sql` at repo root):** keeps the admin
  seed user. The CREATE TABLE blocks there overlap with the baseline migration
  on purpose — both are idempotent so the order doesn't matter on a fresh
  Postgres container.

## Verifying drift

The test `tests/verify-schema.test.js` connects to `DATABASE_URL` and asserts
every table + every important column the app code relies on actually exists.
If you forgot to apply a migration, that test will tell you before the
runtime route does.
