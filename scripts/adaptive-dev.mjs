import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localEnv = path.join(root, "apps/web/.env.local");
if (existsSync(localEnv)) process.loadEnvFile(localEnv);
const python = process.env.ADAPTIVE_PYTHON_BIN || path.join(root, "apps/adaptive-api/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) throw new Error("Create apps/adaptive-api/.venv and install requirements.txt first; see docs/adaptive-teaching.md.");
const port = process.env.ADAPTIVE_WEB_PORT || "3002";
const aiPort = process.env.ADAPTIVE_API_PORT || "8001";
// Next dev can silently choose another port. The worker must use exactly the
// same address, so fail before spawning anything when a requested port is busy.
for (const requested of [port, aiPort]) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code !== "EADDRINUSE") { reject(error); return; }
      console.error(`Port ${requested} is already in use.\nIf this app is running in another terminal, press Ctrl+C there before restarting.\nIf the existing app is the one you want, open http://127.0.0.1:${port}/learn instead.\nNo additional services were started.`);
      process.exit(1);
    });
    probe.listen(Number(requested), "127.0.0.1", () => probe.close(resolve));
  });
}
const production = process.argv.includes("--production");
const env = { ...process.env, ADAPTIVE_PYTHON_ENABLED: "true", ADAPTIVE_INTERNAL_TOKEN: process.env.ADAPTIVE_INTERNAL_TOKEN || randomBytes(32).toString("hex"), ADAPTIVE_LMS_URL: `http://127.0.0.1:${port}`, ADAPTIVE_API_URL: `http://127.0.0.1:${aiPort}` };
const children = [];
let stopping = false;
function terminate(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try { execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true }); } catch {}
  } else child.kill("SIGTERM");
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  // Stop writers first, then flush/close PGlite before terminating Next.
  for (const child of children.slice(1)) terminate(child);
  try {
    const response = await fetch(`${env.ADAPTIVE_LMS_URL}/api/internal/adaptation/shutdown`, {
      method: 'POST', headers: { authorization: `Bearer ${env.ADAPTIVE_INTERNAL_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) console.warn('Database shutdown did not complete; retain the data directory for recovery if needed.');
  } catch {
    console.warn('Web server unavailable for database shutdown.');
  }
  terminate(children[0]);
  process.exitCode = code;
}
function start(command, args, cwd) {
  // On Windows isolate children from the terminal's Ctrl+C so the launcher
  // can close the database before shutting down the web process.
  const child = spawn(command, args, { cwd, env, stdio: "inherit", windowsHide: true, detached: process.platform === 'win32' });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 0); });
}
const require = createRequire(import.meta.url);
start(process.execPath, [require.resolve("next/dist/bin/next"), production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", port], path.join(root, "apps/web"));
start(python, ["-m", "uvicorn", "adaptive_api.api:app", "--host", "127.0.0.1", "--port", aiPort], path.join(root, "apps/adaptive-api"));
start(python, ["-m", "adaptive_api.worker"], path.join(root, "apps/adaptive-api"));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.log(`Adaptive pilot: http://127.0.0.1:${port}/learn — Python readiness: http://127.0.0.1:${aiPort}/ready`);
