import { CREATOR_ROADMAP, ILD_STAGES } from "@/lib/content-creator";

export function IldWorkflow() {
  return <section aria-labelledby="ild-heading" className="space-y-4">
    <div><h2 id="ild-heading" className="text-xl font-semibold">Your ILD production workflow</h2><p className="text-sm text-ink-muted">Save expert input, generate a blueprint, review modules, then use the Stage 4 scripts-first pilot for an approved module. Generate local audio after script approval; later release stages remain deferred.</p></div>
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{ILD_STAGES.map(([title, detail], i) => <li key={title} className="rounded-xl border border-line bg-panel p-4" aria-current={i === 0 ? "step" : undefined}>
      <p className="mb-2 text-xs font-medium text-brand-ink">Stage {i + 1} · {i < 3 ? "Available" : i === 3 ? "Scripts-first pilot" : "Planned"}</p>
      <h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-ink-muted">{detail}</p>
    </li>)}</ol>
  </section>;
}

export function CreatorRoadmap() {
  return <section aria-labelledby="roadmap-heading" className="space-y-4"><h2 id="roadmap-heading" className="text-xl font-semibold">What comes next</h2>
    <p className="text-sm text-ink-muted">Available now: course briefs, AI blueprints, SME module reviews and editable Stage 4 slides/narration scripts. The following features are planned.</p>
    <div className="grid gap-4 md:grid-cols-2">{CREATOR_ROADMAP.map(([title, detail]) => <article className="rounded-xl border border-line bg-panel p-5" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-ink-muted">{detail}</p></article>)}</div>
  </section>;
}
