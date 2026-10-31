// Bundles backend-test.ts with the app's tsconfig paths and runs it against an in-memory
// database, with a stand-in for the GLM API (no API calls). Run from apps/web: node tests/backend/run.mjs
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const suites = { "local-db": "local-db-test.ts", "guided-project": "guided-project-test.ts", "project-sandbox": "project-sandbox-test.ts", "authored-assessment": "authored-assessment-test.ts", "course-skills": "course-skills-test.ts", "authored-publication": "authored-publication-test.ts", "enrollment-start": "enrollment-start-test.ts", workplace: "workplace-test.ts", "adaptive-loop": "adaptive-loop-test.ts", live: "live-test.ts", engagement: "engagement-test.ts", workflow: "workflow-test.ts", companion: "companion-test.ts", profiling: "profiling-test.ts", "profiling-api": "profiling-api-test.ts", interview: "interview-test.ts", adapt: "adapt-test.ts" };
const suite = process.argv[2] === "longform" ? "longform-test.ts" : process.argv[2] === "production-audio" ? "production-audio-test.ts" : process.argv[2] === "module-production" ? "module-production-test.ts" : process.argv[2] === "sme-review" ? "sme-review-test.ts" : process.argv[2] === "creator-blueprints" ? "creator-blueprints-test.ts" : process.argv[2] === "content-creator" ? "content-creator-test.ts" : process.argv[2] === "authored-course" ? "authored-course-test.ts" : suites[process.argv[2]] || "backend-test.ts";
// generated files go to the gitignored .data folder
const out = path.join(here, "..", "..", ".data", "tests");
mkdirSync(out, { recursive: true });
const empty = path.join(out, "empty.js");
writeFileSync(empty, "export {};\n");
const nextServer = path.join(out, "next-server.js");
writeFileSync(nextServer, "export const NextResponse = { json: (d, init) => new Response(JSON.stringify(d), init) };\nexport const after = (fn) => void fn();\n");

await build({
  entryPoints: [path.join(here, suite)],
  outfile: path.join(out, "out.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: path.join(here, "..", "..", "tsconfig.json"),
  alias: { "server-only": empty, "next/server": nextServer },
  external: ["@electric-sql/pglite", "pg", "drizzle-orm", "zod", "react", "react-dom"],
  logLevel: "warning",
});
execFileSync(process.execPath, [path.join(out, "out.mjs")], { stdio: "inherit", env: { ...process.env, PGLITE_DIR: "memory://", GLM_API_KEY: "", LLM_API_KEY: "", AUDIO: "off", AUDIO_API_KEY: "", KOKORO: "off", PLATFORM_ENGAGEMENT_ENABLED: suite === "engagement-test.ts" ? "true" : "false" } });
