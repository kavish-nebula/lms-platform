"use client";
import * as React from "react";
import { api } from "./api";
import { useAdaptedModule } from "./adapted";
import type { ConceptVideo, VideoSlide } from "@/data/types";

type Revision = { id: string; requestId?: string; videoId: string; slide: number; trigger: string; status: string; content: VideoSlide | null; audio: string | null; updatedAt: string };
type Pending = { id?: string; slide: number; requestId: string; trigger: "simplify" | "example" | "wrong_answer" };

/** Initial revisions enter at slide boundaries. Requested revisions can replace the current slide. */
export function useLiveSlides(video: ConceptVideo, courseId: string, moduleId: string, enabled: boolean, idx: number, untouched: boolean, reading = false) {
  const capability = useAdaptedModule(courseId, moduleId, enabled);
  const active = !!capability?.live && enabled;
  const base = `/api/v1/enrollments/${courseId}/modules/${moduleId}`;
  const [available, setAvailable] = React.useState<Record<number, Revision>>({});
  const [accepted, setAccepted] = React.useState<Record<number, Revision>>({});
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [message, setMessage] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [position, setPosition] = React.useState(idx);
  const openedAt = React.useRef(0);
  const current = React.useRef({ idx, pending });
  React.useLayoutEffect(() => { current.current = { idx, pending }; });

  React.useEffect(() => {
    if (!active) return;
    openedAt.current ||= Date.now();
    const events = new EventSource(`${base}/adaptation-events`);
    const receive = (event: MessageEvent<string>) => {
      const r = JSON.parse(event.data) as Revision;
      if (r.videoId !== video.id) return;
      const p = current.current.pending;
      if (p && (p.id === r.id || p.requestId === r.requestId) && current.current.idx === p.slide) {
        if (r.status === "ready" && r.content && r.audio) {
          setAccepted((s) => ({ ...s, [r.slide]: r }));
          current.current.pending = null;
          setApplied(r.id); setPending(null); setMessage("Your revised explanation is ready.");
        } else if (r.status === "failed") { current.current.pending = null; setPending(null); setMessage("The explanation could not be prepared. You can resume or retry."); }
      }
      // A completed learner-requested revision survives reopening the lesson.
      // Responses completed after opening still require the matching live request.
      if ((r.trigger === "initial" || Date.parse(r.updatedAt) <= openedAt.current) && r.status === "ready" && r.content && r.audio)
        setAvailable((s) => !s[r.slide] || s[r.slide]!.updatedAt <= r.updatedAt ? { ...s, [r.slide]: r } : s);
    };
    events.addEventListener("revision", receive);
    return () => events.close();
  }, [active, base, video.id]);

  React.useEffect(() => {
    if (!active) return;
    // Automatically prioritise this slide, with the current prerequisite
    // evidence. Deduplication keeps revisiting a slide free of extra rewrites.
    void api(`${base}/adaptation-requests`, { method: "POST", body: {
      videoId: video.id, slide: idx, trigger: "initial", requestId: crypto.randomUUID(),
    } }).catch(() => {});
  }, [active, base, video.id, idx]);

  const ready = available[idx];
  const entering = position !== idx;
  if (entering) setPosition(idx);
  // Reading exposes several sections together. Adopt their text/audio pairs
  // together while paused; the slide player keeps its existing boundary rule.
  if (reading && untouched) {
    const fresh = Object.values(available).filter(r => !accepted[r.slide] || Date.parse(r.updatedAt) > Date.parse(accepted[r.slide]!.updatedAt));
    if (fresh.length) setAccepted({...accepted,...Object.fromEntries(fresh.map(r=>[r.slide,r]))});
  } else if (!reading && (untouched || entering) && ready && (!accepted[idx] || Date.parse(ready.updatedAt) > Date.parse(accepted[idx]!.updatedAt))) setAccepted({ ...accepted, [idx]: ready });
  if (pending && pending.slide !== idx) { setPending(null); setMessage(""); }

  React.useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => { current.current.pending = null; setPending(null); setMessage("Preparation is taking longer than expected. You can resume or retry."); }, 20_000);
    return () => clearTimeout(timer);
  }, [pending, idx]);

  const request = React.useCallback(async (trigger: Pending["trigger"]) => {
    if (!active) return;
    const requestId = crypto.randomUUID();
    const p: Pending = { slide: idx, requestId, trigger };
    current.current.pending = p;
    setPending(p); setMessage("Preparing your explanation and narration…");
    try {
      const { job } = await api<{ job: Revision }>(`${base}/adaptation-requests`, { method: "POST", body: { videoId: video.id, slide: idx, trigger, requestId, baseRevision: accepted[idx]?.id } });
      if (current.current.pending?.requestId !== requestId || current.current.idx !== idx) return;
      const next = { ...p, id: job.id };
      current.current.pending = next;
      setPending(next);
    } catch { if (current.current.pending?.requestId === requestId) { setPending(null); setMessage("The explanation could not be prepared. You can resume or retry."); } }
  }, [active, idx, base, video.id, accepted]);

  const slides = React.useMemo(() => video.slides.map((s, i) => accepted[i]?.content ?? s), [video.slides, accepted]);
  const srcs = React.useMemo(() => slides.map((_, i) => accepted[i]?.audio ?? (video.audio ? video.audio[i] ?? "" : `/audio/video-${video.id}-s${i}.mp3`)), [slides, accepted, video]);
  return { active, slides, srcs, pending: !!pending, message, request, applied, revision: accepted[idx]?.id };
}
