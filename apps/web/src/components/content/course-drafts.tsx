"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreatorDraft } from "@/lib/content-creator";

const savedTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function CourseDrafts({ drafts, searchable = false }: { drafts: CreatorDraft[]; searchable?: boolean }) {
  const [query, setQuery] = useState("");
  const visible = drafts.filter(d => (d.brief.title || "Untitled course").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="space-y-4" aria-labelledby="drafts-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="drafts-heading" className="text-xl font-semibold">Course drafts <span className="text-ink-muted">({drafts.length})</span></h2><Button asChild><Link href="/content/courses/new"><Plus aria-hidden />Create course</Link></Button></div>
    {searchable && <div className="max-w-md"><label htmlFor="draft-search" className="mb-2 flex items-center gap-2 text-sm"><Search size={16} aria-hidden />Search by course title</label><Input id="draft-search" type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>}
    {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(d => {
      return <Link key={d.id} href={`/content/courses/${d.id}`} className="block min-w-0 break-words rounded-xl border border-line bg-panel p-5 outline-none hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring">
        <p className="mb-3 text-xs font-medium text-brand-ink">Authoring draft · Revision {d.revision}</p><h3 className="text-lg font-semibold">{d.brief.title || "Untitled course"}</h3>
        <p className="mt-3 text-xs text-ink-muted">Last saved <time dateTime={d.updatedAt}>{savedTime.format(new Date(d.updatedAt))} IST</time></p><span className="mt-4 flex items-center gap-2 text-sm font-medium">Continue brief<ArrowRight size={16} aria-hidden /></span>
      </Link>;
    })}</div> : <div className="rounded-xl border border-dashed border-line bg-panel p-8"><h3 className="font-semibold">{drafts.length ? "No matching course drafts" : "Start your first course brief"}</h3><p className="mt-2 text-sm text-ink-muted">{drafts.length ? "Try another title or clear your search." : "Capture what learners should achieve, then add objectives and source material. You can save before everything is complete."}</p></div>}
  </section>;
}
