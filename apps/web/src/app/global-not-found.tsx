import type { Metadata } from "next";
import Link from "next/link";
import { fontClassName } from "@/app/fonts";
import "@/app/globals.css";
import { PrefsScript } from "@/app/prefs-script";
import { Providers } from "@/app/providers";
import { getMessages } from "next-intl/server";

export const metadata: Metadata = {
  title: "Page not found · Nebula KnowLab",
  description: "This page does not exist.",
};

/** 404 for unmatched URLs. Bypasses both root layouts, so it brings its own styles. */
export default async function GlobalNotFound() {
  const messages = await getMessages();
  return (
    <html lang="en" data-theme="aurora" className={`${fontClassName} h-full`} suppressHydrationWarning>
      <head><PrefsScript /></head>
      <body className="aura flex min-h-dvh items-center justify-center p-6 antialiased">
        <Providers locale="en" messages={messages}>
          <main className="max-w-md text-center">
            <p className="font-mono text-sm text-brand-ink">404</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page does not exist</h1>
            <p className="mt-3 text-ink-muted">
              The link may be old, or the page may have moved. Your progress is safe.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/learn"
                className="inline-flex h-10 items-center rounded-lg bg-brand-deep px-4 font-medium text-on-brand"
              >
                Go to your dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-lg border border-line bg-panel px-4 font-medium"
              >
                Home
              </Link>
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
