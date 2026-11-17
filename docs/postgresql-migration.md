# Move the local LMS from PGlite to PostgreSQL

The current Next.js application already selects the node-postgres driver when
`DATABASE_URL` is configured. Drizzle uses the same SQL migrations for both drivers.
Python continues to claim jobs through authenticated Next.js endpoints; it does
not connect to the database directly. Browser playback drafts stay in the browser.

## Preserve existing courses and learner data

1. Confirm local PostgreSQL is running. Add a one-time administrative connection
   to the ignored `apps/web/.env.local` file:
   `POSTGRES_MIGRATION_URL=postgresql://postgres:URL_ENCODED_PASSWORD@127.0.0.1:5432/postgres`.
   Percent-encode special characters in the password. Do not commit this value or
   put it on the command line.
2. From the repository root, run `node scripts/migrate-postgres.mjs --check`.
   This checks authentication and the availability of a new target name without
   changing the database or application configuration.
3. Stop the web app and adaptive worker with Ctrl+C. Run
   `node scripts/migrate-postgres.mjs --migrate`. Optionally select another new
   target using `--database NAME`; the default is `nebula_knowlab`.
4. The tool requires exclusive PGlite ownership, backs up the physical data and
   environment under `apps/web/.data/backups/postgres-migration-TIMESTAMP`, and
   opens only the backed-up PGlite copy. The original database remains untouched.
5. It creates a new database and dedicated login without superuser, database-create
   or role-create permissions; runs the existing migrations; and checks migration
   history and column compatibility before copying public tables in foreign-key
   order. Migration versions must match. Historical SQL hash differences (such as
   line endings or constraint renames) are recorded and accepted only when actual
   column types, defaults, nullability, constraints, indexes, triggers and views
   match. PostgreSQL 18's explicit NOT NULL constraint rows are normalized against
   PostgreSQL 17's column nullability. Numeric precision is retained using
   database-generated JSON text.
6. Copying occurs in one transaction. Every table must match its source row count
   and content hash before commit. Existing target data is never overwritten.
   A logical row backup and verification report are retained locally.
7. Only after validation does the tool set `DATABASE_URL` in `.env.local` and
   remove the one-time administrative URL. Restart using `npm run dev` and check
   the course catalog, enrollment/progress, assessment history and narration.

Keep uploaded video, connected-media, imported-package and narration directories
at their existing locations. PostgreSQL stores their identifiers and references,
not the media bytes. A database migration or code push does not move those files.

## Failure and rollback

Failures before configuration leave the app's original database selection intact.
Failed copies roll back table inserts; a newly created empty database/role may
remain for inspection. No existing database or role is dropped automatically.
Choose a fresh target name for a retry, or use `--resume-empty` for a staging
database created by an earlier attempt. Resuming verifies restricted-role ownership,
schema equivalence and empty tables before rotating that dedicated role's password.
It never accepts a staging database containing application rows.
If configuration fails after data commit,
the verified target remains available but the app must not be assumed switched.

Before rollback, stop every app process. Remove `DATABASE_URL` to return to the
untouched PGlite directory, or restore the backed-up environment after checking
for unrelated later configuration changes. New PostgreSQL activity is not merged
back into the older PGlite snapshot automatically.

Both database drivers close their connections during the launcher's graceful
shutdown. Isolated backend and Vertex verification commands explicitly clear
`DATABASE_URL` so test resets cannot operate on the application's PostgreSQL data.

## Checks

`node --test scripts/tests/database-transfer.test.mjs` covers lossless values,
foreign keys, sequence continuation, existing-target refusal, incompatible schemas,
cycles and rollback on verification failure. These use disposable PGlite instances;
they do not replace live PostgreSQL migration and browser verification.

The logical transfer uses PostgreSQL's documented
[JSON record conversion](https://www.postgresql.org/docs/17/functions-json.html).
