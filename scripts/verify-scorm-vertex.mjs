/** Live paid-provider check. Uses synthetic profiles and an in-memory learner DB. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, 'apps/web/.env.local'));
const out = path.join(root, 'apps/web/.data/scorm-vertex-verification');
await fs.mkdir(out, { recursive: true });
const empty = path.join(out, 'empty.mjs'); await fs.writeFile(empty, 'export {};\n');
const nextServer = path.join(out, 'next-server.mjs'); await fs.writeFile(nextServer, 'export const NextResponse = { json: (data, init) => Response.json(data, init) };\n');
const entry = path.join(out, 'verify.mjs');
await build({ entryPoints: [path.join(root, 'apps/web/tests/backend/scorm-vertex-live.ts')], outfile: entry, bundle: true, platform: 'node', format: 'esm', target: 'node22', tsconfig: path.join(root, 'apps/web/tsconfig.json'), alias: { 'server-only': empty, 'next/server': nextServer }, external: ['@electric-sql/pglite', 'pg', 'drizzle-orm', 'zod', 'google-auth-library'], logLevel: 'warning' });
const child = spawn(process.execPath, [entry], { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, DATABASE_URL: '', PGLITE_DIR: 'memory://', LLM_PROVIDER: 'vertex', AUDIO_PROVIDER: 'vertex', AUDIO: 'on', SCORM_VERIFY_OUTPUT: out } });
child.on('exit', code => { process.exitCode = code ?? 1; });
