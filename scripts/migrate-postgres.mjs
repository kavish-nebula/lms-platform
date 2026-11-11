/** Compile the TypeScript CLI without requiring a globally installed runner. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'apps/web/.data/db-migration-tool');
fs.mkdirSync(out, { recursive: true });
const entry = path.join(out, 'cli.mjs');
await build({ entryPoints: [path.join(root, 'scripts/migrate-postgres.ts')], outfile: entry,
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['@electric-sql/pglite', 'pg', 'drizzle-orm', 'drizzle-orm/*'], logLevel: 'warning' });
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Database migration process could not start.'); process.exitCode = 1; });
