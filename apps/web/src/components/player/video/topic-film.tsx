import React, { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import type { VideoSlide } from "@/data/types";
import { artwork, illustrations, sentenceStarts } from "./topic-storyboard";
import { selectCut } from "./topic-edit";
import { ConsoleShot, Ledger, Messages, ParallelRuns, Prop, Transfer, unit, type Clock } from "./topic-sets";
import { ApprovalGate, Backoff, OrbitOpening, ParcelJourney, PolicySearch, SameQuestion, SessionFiles, TokenPress } from "./topic-demonstrations";
import "./topic-film.css";

const prefersStill = () => document.documentElement.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
function watchMotion(callback: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(callback);
  media.addEventListener("change", callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => { media.removeEventListener("change", callback); observer.disconnect(); };
}
function sceneClock(starts: number[], fraction: number, still: boolean): Clock {
  const cue = Math.max(0, starts.findLastIndex(t=>t<=fraction));
  const begin = starts[cue] ?? 0;
  return { cue, part: still ? 1 : unit((fraction-begin)/Math.max(.0001,(starts[cue+1]??1)-begin)), still };
}

function Shot({ s, clock, root }: { s: VideoSlide; clock: Clock; root: string }) {
  const {cue,part} = clock;
  switch(s.kind) {
    case "chat": return <Messages scene={s} clock={clock}/>;
    case "code": return s.title === "Retrying with backoff" && s.rows.some(r=>r.code.includes("2 ** attempt"))
      ? <Backoff scene={s} clock={clock}/> : <ConsoleShot scene={s} clock={clock}/>;
    case "table":
      if (s.columns[0]==="Session id") return <SessionFiles scene={s} clock={clock}/>;
      if (s.columns[2]==="Scout's rule") return <ApprovalGate scene={s} clock={clock}/>;
      return <Ledger scene={s} clock={clock}/>;
    case "compare": return s.left.label==="Orbit's FAQ chatbot" && s.right.label==="Scout, an agent"
      ? <SameQuestion scene={s} clock={clock} root={root}/> : <ParallelRuns scene={s} clock={clock}/>;
    case "flow":
      if (s.title === "One job: predict the next token" && s.nodes[1]?.sub.includes("·")) return <TokenPress scene={s} clock={clock}/>;
      if (s.nodes.some(n=>n.sub.includes("ParcelPath")) && s.nodes.some(n=>n.label==="track_parcel")) return <ParcelJourney scene={s} clock={clock} root={root}/>;
      if (s.title === "RAG, step by step" && s.nodes[0]?.sub.includes("Orbit")) return <PolicySearch scene={s} clock={clock}/>;
      return <Transfer scene={s} clock={clock} root={root}/>;
    case "cycle": case "hub": return <Transfer scene={s} clock={clock} root={root}/>;
    case "example": {
      const idx=s.steps.findLastIndex(step=>step.cue<=cue);
      return <div className="set-log"><header>{idx<0?"Case opened":s.steps[idx]!.time}</header>
        {idx<0 ? <p>{s.scenario}</p> : s.steps.slice(Math.max(0,idx-2),idx+1).map(step=><div key={step.time+step.text}><time>{step.time}</time><b>{step.text}</b></div>)}
        {cue>=s.result.cue && <aside>{s.result.text}</aside>}</div>;
    }
    case "cards": {
      const card=s.cards.filter(c=>c.cue<=cue).at(-1) ?? s.cards[0];
      if (!card) return <p>{s.title}</p>;
      const next=s.cards[s.cards.indexOf(card)+1]?.cue ?? s.sentences.length;
      const age=unit((cue+part-card.cue)/Math.max(1,next-card.cue));
      return <div className="set-workorder"><header><Prop name={artwork(card.icon,"tool")} root={root}/>{card.title}</header>
        {card.flow.map((line,i)=><div key={i} data-lit={cue>=card.cue && (clock.still || i<=Math.floor(age*card.flow.length))}><small>{s.tags?.[i] ?? String(i+1).padStart(2,"0")}</small><b>{line}</b></div>)}</div>;
    }
    case "bullets": {
      const idx=s.bullets.findLastIndex(b=>b.cue<=cue);
      return <div className="set-controls"><header>{s.lead}</header>
        {s.bullets.slice(Math.max(0,idx-2),Math.max(1,idx+1)).map((b,i)=><div key={b.text}><label data-on={b.cue<=cue}><i/></label><b>{b.text}</b><span>{String(Math.max(0,idx-2)+i+1).padStart(2,"0")}</span></div>)}
        {cue>=s.aside.cue && <aside>{s.aside.text}</aside>}</div>;
    }
    case "define": return <article className="set-paper"><small>{s.term}</small><h3>{s.definition}</h3>
      <div className="set-clippings">{s.parts.filter(p=>p.cue<=cue).map(p=><mark key={p.text}>{p.text}</mark>)}</div>
      {cue>(s.parts.at(-1)?.cue??0) && <aside><b>{s.analogy.label}</b> {s.analogy.text}</aside>}</article>;
    case "recap": case "title": return <article className="set-paper"><h3>{s.title}</h3><p>{s.sentences[cue] ?? s.narration}</p></article>;
  }
}

export function TopicFilm({ slide, chapters, topic, position, count, fraction, duration, starts, imageRoot = "/topic-film" }: {
  slide: VideoSlide; chapters: VideoSlide[]; topic: string; position: number; count: number; fraction: number; duration: number; starts: number[]; imageRoot?: string;
}) {
  const still=useSyncExternalStore(watchMotion,prefersStill,()=>false);
  const clock=sceneClock(starts,fraction,still);
  const orbit=slide.kind==="title" && topic==="What is an AI agent?" && slide.sentences[0]?.includes("Orbit Outdoor");
  const cut=useMemo(()=>orbit ? undefined : selectCut(slide,chapters,topic,clock.cue),[orbit,slide,chapters,topic,clock.cue]);
  const cutStarts=useMemo(()=>cut ? sentenceStarts(cut.sentences.length ? cut.sentences : [cut.narration]) : [],[cut]);
  const scene=cut ?? slide;
  // Openings and recaps are edited excerpts. The main demonstrations use their own
  // narration clock. Seeking directly to a frame reconstructs the same scene.
  const shotClock=cut ? sceneClock(cutStarts, .12 + .75*clock.part, still) : clock;
  const cutAge=(fraction-(cut || orbit ? starts[clock.cue]??0 : 0))*duration;
  const entry=still?1:unit(cutAge/.32);
  const scale=still?1:1+Math.min(.023,cutAge*.0018);
  return <section className={"topic-film cine-"+scene.kind} aria-label={slide.title} style={{"--cine-enter":.70+.30*entry,"--cine-zoom":scale} as CSSProperties}>
    <header className="cine-slate"><span><i/>{orbit ? ["Orbit Outdoor","Orbit helpdesk","Order lookup","Orbit help"][Math.min(clock.cue,3)] : scene.title}</span><small>{position+1} / {count}</small></header>
    <div className="cine-camera">{orbit ? <OrbitOpening clock={clock} root={imageRoot}/> : <Shot s={scene} clock={shotClock} root={imageRoot}/>}</div>
    <div className="cine-playhead" aria-hidden="true"><i style={{scale:`${fraction} 1`}}/></div>
  </section>;
}

export function FilmCredits() {
  return <details className="film-credits"><summary>Illustration credits</summary>
    <p>Twemoji artwork © Twitter, Inc. and other contributors. Used under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. The lesson animates the original illustrations.</p>
    <ul>{Object.entries(illustrations).map(([name, code]) => <li key={name}><a href={`https://commons.wikimedia.org/wiki/File:Twemoji12_${code}.svg`}>{name}</a></li>)}</ul>
  </details>;
}
