import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root: workspace packages (@lms/ui, @lms/i18n, @lms/fixtures) live outside apps/web.
const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  // Keep verification builds isolated when the developer server is using .next.
  distDir: process.env.LMS_NEXT_DIST_DIR ?? ".next",
  // Worker/API visits should not evict the learner's recently compiled pages.
  onDemandEntries: { maxInactiveAge: 10 * 60_000, pagesBufferLength: 20 },
  async headers() {
    return [
      { source: "/pyodide/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
      { source: "/course-packages/:path*", headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Content-Security-Policy", value: "sandbox allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox" },
      ] },
    ];
  },
  outputFileTracingRoot: monorepoRoot,
  // PGlite (the built-in local Postgres) ships WASM; load it from node_modules
  // at runtime rather than through the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "ffmpeg-static"],
  // Keep the documented Webpack fallback equivalent to the Turbopack setup.
  webpack(config, { dev }) {
    config.resolve.alias["next-intl/config"] = path.join(__dirname, "src/i18n/request.ts");
    // Preprocess Tailwind while retaining Next's built-in CSS extraction rules.
    config.module.rules.unshift({ oneOf: [{ test: /\.css$/, enforce: "pre", use: ["@tailwindcss/turbopack"] }] });
    if (dev) {
      // Narration, imports and verification builds are runtime output, not code.
      // Keep Next's own ignores as well as Windows and POSIX path support.
      const runtimeOutput = /(?:^|[\\/])(?:\.data|\.next[^\\/]*)(?:[\\/]|$)/;
      const ignored = config.watchOptions?.ignored;
      config.watchOptions = { ...config.watchOptions, ignored: ignored instanceof RegExp
        ? new RegExp(`(?:${ignored.source})|(?:${runtimeOutput.source})`, ignored.flags)
        : [...(Array.isArray(ignored) ? ignored : ignored ? [ignored] : []), '**/.data/**', '**/.next*/**'] };
    }
    return config;
  },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      // What next-intl/plugin would add. The plugin itself is not used because it
      // loads @swc/core's native binary at config time, whose install script
      // npm blocks by default. Re-enable the plugin if message extraction is needed.
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Two root layouts ((app) and (marketing)) means no single layout
    // can compose a 404, so unmatched URLs use app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
