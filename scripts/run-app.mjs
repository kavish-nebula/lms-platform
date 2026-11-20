import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const envFile = path.join(web, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.ADAPTIVE_WEB_PORT ??= '3000';
// Build output must not replace a developer server's compilation cache.
process.env.LMS_NEXT_DIST_DIR ??= '.next-app';
const adaptive = process.env.ADAPTIVE_PYTHON_ENABLED === 'true';
const ports = [process.env.ADAPTIVE_WEB_PORT, ...(adaptive ? [process.env.ADAPTIVE_API_PORT || '8001'] : [])];

for (const port of ports) {
  try {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(Number(port), '127.0.0.1', () => probe.close(resolve));
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    console.error(`Port ${port} is already in use. Stop the existing app with Ctrl+C before running npm run app. No build or additional services were started.`);
    process.exit(1);
  }
}

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
console.log('Preparing the production app. This build runs once at startup; browsing will not compile routes.');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [next, 'build'], { cwd: web, env: process.env, stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Production build did not complete (${signal || code}). No app services were started.`)));
});

if (adaptive) {
  process.argv.push('--production');
  await import('./adaptive-dev.mjs');
} else {
  const child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', process.env.ADAPTIVE_WEB_PORT], { cwd: web, env: process.env, stdio: 'inherit', windowsHide: true });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
