import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getLearner } from "@/data";
import * as schema from "./schema";
import { lockLocalDatabase } from './local-lock';

/**
 * The learner database. Locally it is PGlite (Postgres compiled to WASM,
 * stored in apps/web/.data/pglite), so there is nothing to install; with
 * DATABASE_URL set it is a real Postgres server (Cloud SQL in production).
 * Both run the same Drizzle queries and the same SQL migrations (drizzle/).
 *
 * PGlite allows one connection, and Next's dev server re-evaluates modules,
 * so the instance lives on globalThis and every caller shares it.
 */

/** Both drivers expose the same query builder; typed as the PGlite one. */
export type DB = PgliteDatabase<typeof schema>;

const store = globalThis as unknown as { __lmsDb?: Promise<DB>; __lmsCloseDb?: () => Promise<void>; __lmsDbClosing?: boolean };

export function db(): Promise<DB> {
  if (store.__lmsDbClosing) return Promise.reject(new Error('The app database is shutting down.'));
  if (!store.__lmsDb) {
    // Retain startup failures until restart: repeatedly opening a broken data
    // directory leaves multiple aborted WASM clients instead of repairing it.
    store.__lmsDb = open();
  }
  return store.__lmsDb;
}

/** Called by the local launcher before it terminates the web process. */
export async function closeDb() {
  store.__lmsDbClosing = true;
  await store.__lmsDb?.catch(() => undefined);
  await store.__lmsCloseDb?.();
}

/** apps/web, whether the server was started from there or from the monorepo root. */
export function appRoot(): string {
  const cwd = process.cwd();
  for (const dir of [cwd, path.join(cwd, "apps", "web")]) {
    if (fs.existsSync(path.join(dir, "drizzle", "meta", "_journal.json"))) return dir;
  }
  return cwd;
}

export const dbKind = () => (process.env.DATABASE_URL ? "postgres" : "pglite");

async function open(): Promise<DB> {
  const migrationsFolder = path.join(appRoot(), "drizzle");
  let database: DB;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pg = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
    await migrate(pg, { migrationsFolder });
    database = pg as unknown as DB;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? path.join(appRoot(), ".data", "pglite");
    if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
    const release = dir === 'memory://' ? () => {} : lockLocalDatabase(dir);
    process.once('exit', release);
    const client = new PGlite(dir === "memory://" ? undefined : dir);
    store.__lmsCloseDb = async () => {
      await client.close();
      release();
    };
    try {
      await client.waitReady;
      database = drizzle(client, { schema });
      await migrate(database, { migrationsFolder });
    } catch (error) {
      try { await client.close(); } catch { /* Preserve the original startup failure. */ }
      release();
      throw new Error('Local database startup failed. Stop other app instances and preserve the data directory before recovery.', { cause: error });
    }
  }
  await seed(database);
  return database;
}

/** The demo learner, until a real identity provider signs people in. */
async function seed(database: DB) {
  const { user } = await getLearner();
  await database.insert(schema.users).values({ id: user.user_id, name: user.name, email: user.email }).onConflictDoNothing();
}
