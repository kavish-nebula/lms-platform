import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'apps/web/.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// A Python-enabled web server needs its worker; starting only Next leaves
// personalized openings queued forever. Keep the ordinary dev URL on 3000.
if (process.env.ADAPTIVE_PYTHON_ENABLED === 'true') {
  process.env.ADAPTIVE_WEB_PORT ??= '3000';
  await import('./adaptive-dev.mjs');
} else {
  const require = createRequire(import.meta.url);
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev'], {
    cwd: path.join(root, 'apps/web'), stdio: 'inherit', windowsHide: true,
  });
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}
