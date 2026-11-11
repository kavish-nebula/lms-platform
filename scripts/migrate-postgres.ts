import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { lockLocalDatabase } from '../apps/web/src/server/db/local-lock';
import { copyDatabase, quoteIdentifier, inventory, schemaSemantics, tableSignature } from './lib/database-transfer.mjs';

const root = process.cwd();
const web = path.join(root, 'apps/web');
const envPath = path.join(web, '.env.local');
process.loadEnvFile(envPath);
const args = process.argv.slice(2);
const apply = args.includes('--migrate');
const resumeEmpty = args.includes('--resume-empty');
const option = (flag: string, fallback: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const databaseName = option('--database', 'nebula_knowlab');
const roleName = `${databaseName}_app`;
const sourceDirectory = path.resolve(process.env.PGLITE_DIR || path.join(web, '.data/pglite'));
const adminUrl = process.env.POSTGRES_MIGRATION_URL;
let admin: Client | undefined;
let target: Client | undefined;
let source: PGlite | undefined;
let release: (() => void) | undefined;
let backupDirectory: string | undefined;
let phase = 'configuration';

try {
  if (!/^[a-z][a-z0-9_]{0,45}$/.test(databaseName)) throw new Error('Choose a lowercase database name containing letters, numbers and underscores.');
  if (!adminUrl) throw new Error('Set POSTGRES_MIGRATION_URL in apps/web/.env.local. Do not put credentials in command-line arguments.');
  const parsed = new URL(adminUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) throw new Error('This migration command accepts a local PostgreSQL server only.');
  phase = 'PostgreSQL login';
  admin = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 });
  await admin.connect();
  const server = (await admin.query('SELECT current_database() AS database, current_user AS username, version() AS version')).rows[0];
  console.log(`Connected to local ${server.version.split(' on ')[0]}; login ${server.username}.`);
  const existing = await admin.query('SELECT datname FROM pg_database WHERE datname = $1', [databaseName]);
  const existingRole = await admin.query('SELECT rolname FROM pg_roles WHERE rolname = $1', [roleName]);
  if ((existing.rowCount || existingRole.rowCount) && !resumeEmpty) throw new Error('The target database or role already exists. Select another new database with --database NAME; no existing database will be overwritten.');
  if (resumeEmpty && (!existing.rowCount || !existingRole.rowCount)) throw new Error('The target database and role must both exist when resuming an empty staging database.');
  await fs.access(path.join(sourceDirectory, 'PG_VERSION'));
  console.log(`Plan: copy local PGlite into new database ${databaseName} using dedicated role ${roleName}.`);
  if (apply) {
    phase = 'exclusive PGlite ownership';
    release = lockLocalDatabase(sourceDirectory);
    backupDirectory = path.join(web, '.data/backups', `postgres-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(backupDirectory, { recursive: true });
    await fs.copyFile(envPath, path.join(backupDirectory, '.env.local.before'));
    phase = 'physical PGlite backup';
    const backupData = path.join(backupDirectory, 'pglite');
    await fs.cp(sourceDirectory, backupData, { recursive: true, errorOnExist: true, force: false });
    // Work on the backed-up copy. The original PGlite database is never opened or modified.
    source = new PGlite(backupData);
    await source.waitReady;
    console.log('Physical PGlite and environment backups created; original database retained.');
    phase = 'new PostgreSQL database';
    const password = randomBytes(32).toString('base64url');
    // Generated password contains only base64url characters; identifiers are separately quoted.
    if (resumeEmpty) {
      const stagingUrl = new URL(adminUrl); stagingUrl.pathname = `/${databaseName}`;
      const staging = new Client({ connectionString: stagingUrl.toString() });
      await staging.connect();
      try {
        const role = (await staging.query(`SELECT r.rolname, r.rolsuper, r.rolcreatedb, r.rolcreaterole
          FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = current_database()`)).rows[0];
        if (role.rolname !== roleName || role.rolsuper || role.rolcreatedb || role.rolcreaterole) throw new Error('The target is not an isolated LMS staging database owned by the expected restricted role.');
        if (JSON.stringify(await schemaSemantics(source)) !== JSON.stringify(await schemaSemantics(staging))) throw new Error('Source and target schemas differ. Cannot resume staging database.');
        for (const table of await inventory(staging)) {
          if ((await tableSignature(staging, table.name)).count !== '0') throw new Error(`Target table ${table.name} is not empty. Staging database will not be changed.`);
        }
      } finally { await staging.end(); }
      await admin.query(`ALTER ROLE ${quoteIdentifier(roleName)} PASSWORD '${password}'`);
    } else {
      await admin.query(`CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
      await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(roleName)}`);
    }
    const appUrl = new URL(adminUrl);
    appUrl.username = roleName; appUrl.password = password; appUrl.pathname = `/${databaseName}`;
    target = new Client({ connectionString: appUrl.toString(), connectionTimeoutMillis: 5000 });
    await target.connect();
    phase = 'schema migrations';
    await migrate(drizzle(target), { migrationsFolder: path.join(web, 'drizzle') });
    const historySql = 'SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at';
    const sourceHistory = (await source.query(historySql)).rows;
    const targetHistory = (await target.query(historySql)).rows;
    if (JSON.stringify(sourceHistory.map(r => r.created_at)) !== JSON.stringify(targetHistory.map(r => r.created_at))) {
      throw new Error('PGlite and PostgreSQL migration versions differ. The app connection has not changed.');
    }
    if (JSON.stringify(await schemaSemantics(source)) !== JSON.stringify(await schemaSemantics(target))) throw new Error('Source and target schemas differ. The app connection has not changed.');
    const historyDifferences = sourceHistory.filter((r, i) => r.hash !== targetHistory[i].hash);
    if (historyDifferences.length) console.log(`Historical hash differences in ${historyDifferences.length} migrations; actual columns, constraints, indexes, triggers and views match. History differences will be retained in the verification report.`);
    phase = 'transactional data copy';
    const logicalBackup = path.join(backupDirectory, 'rows.ndjson');
    const tables = await copyDatabase(source, target, {
      onTable: (name: string, count: string) => console.log(`Verified ${name}: ${count} rows`),
      writeBackup: async (table: string, json: string) => { await fs.appendFile(logicalBackup, JSON.stringify({ table }) + '\t' + json + '\n'); },
    });
    phase = 'connection configuration';
    const before = await fs.readFile(envPath, 'utf8');
    const newline = before.includes('\r\n') ? '\r\n' : '\n';
    const line = `DATABASE_URL=${appUrl.toString()}`;
    let updated = /^\s*DATABASE_URL\s*=.*$/m.test(before) ? before.replace(/^\s*DATABASE_URL\s*=.*$/gm, line) : `${before.trimEnd()}${newline}${newline}# Local PostgreSQL; migrated and verified from PGlite${newline}${line}${newline}`;
    // The privileged setup credential is no longer needed after the one-time migration.
    updated = updated.replace(/^\s*POSTGRES_MIGRATION_URL\s*=.*\r?\n?/gm, '');
    await fs.writeFile(envPath, updated, { mode: 0o600 });
    await fs.writeFile(path.join(backupDirectory, 'verification.json'), JSON.stringify({ status: 'passed', at: new Date().toISOString(), database: databaseName, role: roleName, source: sourceDirectory, sourceMigrationHistory: sourceHistory, targetMigrationHistory: targetHistory, historyDifferences, tables, media: 'Existing media directories retained at their original locations.' }, null, 2));
    console.log(`PASS: migrated ${tables.length} tables; row counts and content hashes match. DATABASE_URL now selects PostgreSQL.`);
    console.log(`Backup: ${backupDirectory}`);
    console.log('Restart the app. Keep the original PGlite folder and media files for rollback.');
  } else console.log('Check only: no data, database roles or app configuration changed. Stop the app, then run with --migrate.');
} catch (error) {
  // Avoid printing driver errors, connection strings or row contents that might contain secrets.
  const code = (error as { code?: string }).code;
  const known = error instanceof Error && (/^(Set |Choose |This |The target|PGlite and|Source and|Foreign-key|Target table|Row count|Local database|Could not acquire)/.test(error.message));
  console.error(`STOPPED during ${phase}: ${known ? (error as Error).message : `operation failed${code ? ` (${code})` : ''}; credentials and data omitted.`}`);
  if (backupDirectory) console.error(`Backup retained: ${backupDirectory}. Existing database and environment backup remain available.`);
  process.exitCode = 1;
} finally {
  await source?.close().catch(() => {});
  await target?.end().catch(() => {});
  await admin?.end().catch(() => {});
  release?.();
}
