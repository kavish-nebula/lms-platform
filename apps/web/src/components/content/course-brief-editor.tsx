"use client";
import { formatIst } from "@/lib/display-time";
import { CourseDeliveryFlow } from './course-delivery-flow';
import { useRef, useState } from "react";
import { ProductionFormatSettings } from "./production-format-settings";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BLOOM_LEVELS, CourseBrief, EMPTY_BRIEF, briefReadiness, type CourseBriefData, type CreatorDraft } from "@/lib/content-creator";

const fields = [
  ["title", "Course title", "A clear, learner-facing title", 200],
  ["subject", "Subject / domain", "For example, AI agents for professional work", 300],
  ["audience", "Target audience", "Roles, prior knowledge and learning needs", 12000],
  ["prerequisites", "Prerequisites", "What should learners know before starting? Write None if appropriate.", 12000],
  ["outcomes", "Intended workplace outcomes", "What should learners be able to do after this course?", 12000],
  ["duration", "Estimated duration", "For example, 3 hours across six modules", 100],
  ["sourceText", "Raw source content", "Paste expert notes, explanations, procedures or case material. Stage 2 processes the saved input only when you request it.", 100000],
  ["references", "Source references", "One reference or URL per line. References are stored as text and are not fetched.", 12000],
  ["dependencies", "Topic sequence and dependencies", "List topics in order and note which depend on earlier topics.", 12000],
  ["contexts", "Authentic workplace contexts", "Describe realistic situations where learners would use this knowledge.", 12000],
  ["difficulties", "Known difficulty areas", "Where do learners struggle? Write None known if appropriate.", 12000],
] as const;

export function CourseBriefEditor({ draft, lastModule }: { draft: CreatorDraft | null; lastModule?: string }) {
  const router = useRouter();
  const [brief, setBrief] = useState<CourseBriefData>(draft?.brief ?? EMPTY_BRIEF);
  const [saved, setSaved] = useState(JSON.stringify(draft?.brief ?? EMPTY_BRIEF));
  const [record, setRecord] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const dirty = JSON.stringify(brief) !== saved;
  useUnsavedGuard(dirty);
  const set = <K extends keyof CourseBriefData>(key: K, value: CourseBriefData[K]) => { setBrief(b => ({ ...b, [key]: value })); setMessage(""); };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const parsed = CourseBrief.safeParse(brief);
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join(" ")); return; }
    busyRef.current = true; setBusy(true); setError(""); setMessage(""); setConflict(false);
    try {
      const response = await fetch(record ? `/api/v1/content/courses/${record.id}` : "/api/v1/content/courses", {
        method: record ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: parsed.data, ...(record ? { revision: record.revision } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) { setConflict(response.status === 409); throw new Error(result.error?.message ?? "Could not save your draft."); }
      const next = result.course as CreatorDraft;
      setRecord(next); setSaved(JSON.stringify(next.brief)); setMessage("Draft saved. Expert review is still pending.");
      if (!record) router.replace(`/content/courses/${next.id}`);
      router.refresh();
    } catch (e) { setError(e instanceof TypeError ? "Could not reach the server. Your text is still here; please retry when it is available." : e instanceof Error ? e.message : "Could not save. Your text is still here; please retry."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const checks = briefReadiness(brief);
  return <div className="space-y-6">
    <div><Link href="/content/courses" className="text-sm text-brand-ink underline">← All course drafts</Link><h1 className="mt-3 text-3xl font-semibold">{record ? "Edit course brief" : "Create a course brief"}</h1><p className="mt-2 text-ink-muted">Stage 1 · SME Input. Incomplete drafts are welcome. Your work does not change published courses.</p><div className="mt-4 flex flex-wrap gap-2">{record && !dirty ? <><Button asChild variant="outline"><Link href={`/content/courses/${record.id}/blueprint`}>Stage 2: AI instructional blueprint</Link></Button><Button asChild><Link href={`/content/courses/${record.id}/authoring`}>Codex course authoring</Link></Button></> : <p className="text-sm text-ink-muted">Save your SME input to continue to course authoring.</p>}</div></div>
    {record && <><CourseDeliveryFlow structure={record?.deliveryStructure} lastModule={lastModule} /><ProductionFormatSettings courseId={record.id} initialFormat={record.productionFormat ?? 'pilot'} /></>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={save} className="min-w-0 space-y-6">
        <fieldset disabled={busy} className="min-w-0 space-y-5 rounded-xl border border-line bg-panel p-5 md:p-7"><legend className="px-2 text-lg font-semibold">Course information and source material</legend>
          {fields.map(([key, label, hint, max]) => <div className="space-y-2" key={key}><label htmlFor={`brief-${key}`} className="block text-sm font-medium">{label}</label><p id={`hint-${key}`} className="text-xs text-ink-muted">{hint}</p>
            {key === "title" || key === "subject" || key === "duration" ? <Input id={`brief-${key}`} aria-describedby={`hint-${key}`} maxLength={max} value={brief[key]} onChange={e => set(key, e.target.value)} /> : <Textarea id={`brief-${key}`} aria-describedby={`hint-${key}`} maxLength={max} rows={key === "sourceText" ? 10 : 3} value={brief[key]} onChange={e => set(key, e.target.value)} />}
          </div>)}
          <div className="space-y-2"><label htmlFor="brief-delivery" className="block text-sm font-medium">Delivery context</label><select id="brief-delivery" className="min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={brief.delivery} onChange={e => set("delivery", e.target.value as CourseBriefData["delivery"])}><option value="">Not specified</option>{["Self-paced", "Instructor-led", "Blended", "Cohort-based"].map(v => <option key={v}>{v}</option>)}</select></div>
        </fieldset>
        <fieldset disabled={busy} className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-5 md:p-7"><legend className="px-2 text-lg font-semibold">Learning objectives</legend><p className="text-sm text-ink-muted">Use an observable action and outcome, such as “Design an agent brief with testable success criteria.” Bloom’s labels are supplied by you; they are not verified automatically.</p>
          {brief.objectives.map((o, i) => <div key={i} className="space-y-2 rounded-lg border border-line p-3"><label className="block text-sm font-medium" htmlFor={`objective-${i}`}>Objective {i + 1}</label><Textarea id={`objective-${i}`} maxLength={1000} value={o.text} onChange={e => set("objectives", brief.objectives.map((item, n) => n === i ? { ...item, text: e.target.value } : item))} /><div className="flex flex-wrap items-center gap-3"><label htmlFor={`bloom-${i}`} className="text-sm">Bloom’s level</label><select id={`bloom-${i}`} value={o.bloom} className="min-h-11 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" onChange={e => set("objectives", brief.objectives.map((item, n) => n === i ? { ...item, bloom: e.target.value as typeof o.bloom } : item))}>{BLOOM_LEVELS.map(level => <option key={level}>{level}</option>)}</select><Button type="button" variant="outline" aria-label={`Remove objective ${i + 1}`} onClick={() => set("objectives", brief.objectives.filter((_, n) => n !== i))}><Trash2 aria-hidden />Remove</Button></div></div>)}
          <Button type="button" variant="outline" disabled={brief.objectives.length >= 60} onClick={() => set("objectives", [...brief.objectives, { text: "", bloom: "Apply" }])}><Plus aria-hidden />Add objective</Button>
        </fieldset>
        <fieldset disabled={busy} className="space-y-4 rounded-xl border border-line bg-panel p-5 md:p-7"><legend className="px-2 text-lg font-semibold">Physical skills</legend><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={brief.physicalSkills} onChange={e => set("physicalSkills", e.target.checked)} />This course includes physical or psychomotor skills.</label>{brief.physicalSkills && <div className="space-y-2"><label htmlFor="physical-notes" className="block text-sm font-medium">Physical practice requirements</label><p className="text-xs text-ink-muted">Describe supervised practice, equipment and any activities that cannot be assessed online.</p><Textarea id="physical-notes" maxLength={12000} value={brief.physicalNotes} onChange={e => set("physicalNotes", e.target.value)} /></div>}</fieldset>
        <div className="sticky bottom-3 rounded-xl border border-line bg-panel p-4 shadow-sm"><div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={busy}><Save aria-hidden />{busy ? "Saving…" : "Save draft"}</Button><span className="text-xs text-ink-muted">{dirty ? "Unsaved changes" : record ? `Saved · Revision ${record.revision} · ${formatIst(record.updatedAt)}` : "Not saved yet"}</span></div>
          <p role="status" className="mt-2 text-sm text-brand-ink">{message}</p>{error && <div role="alert" className="mt-2 text-sm text-destructive"><p>{error}</p>{conflict && record && <a className="mt-2 inline-block underline" href={`/content/courses/${record.id}`}>Open latest saved version (unsaved text will be lost)</a>}</div>}
        </div>
      </form>
      <aside className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-labelledby="readiness-heading"><h2 id="readiness-heading" className="text-lg font-semibold">Gate 0 preparation</h2><p className="text-sm text-ink-muted">Automated input completeness only. This does not verify facts, objective measurability or provide expert approval.</p><p className="text-sm font-medium" role="status">{checks.filter(c => c.ready).length} of {checks.length} input checks complete</p><ul className="space-y-3 text-sm">{checks.map(check => <li key={check.label} className="flex gap-2"><span aria-hidden className={check.ready ? "text-brand-ink" : "text-ink-muted"}>{check.ready ? "✓" : "○"}</span><span><span className="sr-only">{check.ready ? "Complete: " : "Missing: "}</span>{check.label}</span></li>)}</ul><p className="border-t border-line pt-4 text-xs text-ink-muted">Current view: SME Input. Stage 2 AI processing is available for complete saved input. Module SME review is available in Stage 3; final release and publishing are planned.</p></aside>
    </div>
  </div>;
}
