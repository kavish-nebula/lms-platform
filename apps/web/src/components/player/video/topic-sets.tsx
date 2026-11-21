import React, { type ReactNode } from "react";
import type { VideoSlide } from "@/data/types";
import { artwork } from "./topic-storyboard";

export const unit = (v: number) => Math.min(1, Math.max(0, v));
const phase = (p: number, start: number, end: number) => unit((p - start) / (end - start));

export type Clock = { cue: number; part: number; still: boolean };
const atCue = (clock: Clock, cue: number) => clock.cue < cue ? 0 : clock.still || clock.cue > cue ? 1 : clock.part;
function lastCue<T extends {cue: number}>(items: T[], cue: number) {
  return items.findLastIndex(item => item.cue <= cue);
}
export function take<T extends {cue: number}>(items: T[], clock: Clock) {
  const simultaneous = items.filter(item => item.cue === clock.cue);
  const slot = Math.min(simultaneous.length - 1, Math.floor(clock.part * simultaneous.length));
  const index = slot >= 0 ? items.indexOf(simultaneous[slot]!) : lastCue(items, clock.cue);
  return { index, progress: slot < 0 || clock.still ? 1 : unit(clock.part * simultaneous.length - slot) };
}
function typing(text: string, p: number) {
  return text.slice(0, Math.ceil(text.length * phase(p, 0, .58)));
}
function Glass({ label, children, theme = "" }: {label: string; children: ReactNode; theme?: string}) {
  return <div className={"set-window " + theme}><div className="set-chrome"><i/><i/><i/><b>{label}</b></div>{children}</div>;
}
export function Prop({ name, root }: { name: string; root: string }) {
  // Remotion Studio serves these same local SVGs without a Next image server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" className="set-prop" src={root + "/" + name + ".svg"} />;
}
function Annotation({ text }: {text?: string}) {
  return text ? <div className="set-annotation">{text}</div> : null;
}
type Of<K extends VideoSlide["kind"]> = Extract<VideoSlide, {kind: K}>;

export function Messages({ scene, clock }: {scene: Of<"chat">; clock: Clock}) {
  const {index:last, progress:time} = take(scene.messages, clock);
  const message = scene.messages[last];
  const records = scene.messages.slice(Math.max(0, last - 1), last + 1);
  // A tool call cuts away from the phone to the returned record.
  let fields: [string, unknown][] = [];
  if (message?.role === "tool") {
    try {
      const value: unknown = JSON.parse(message.text);
      if (value && typeof value === "object" && !Array.isArray(value)) fields = Object.entries(value);
    } catch { /* Text traces are shown verbatim. */ }
  }
  return <div className={"set-mailroom " + (message?.role === "tool" ? "is-tool" : "")}>
    {message?.role === "tool" ? <Glass label={message.label || "Tool result"}>
      <div className="set-record">{fields.length ? fields.map(([k,v], i) => <div key={k} style={{opacity: phase(time, i / fields.length * .45, i / fields.length * .45 + .15)}}><small>{k}</small><strong>{String(v)}</strong></div>) : <pre>{typing(message.text,time)}</pre>}</div>
    </Glass> : <div className="set-phone"><div className="set-notch"/><div className="set-contact">{scene.messages.find(m => m.role === "user")?.label || scene.title}</div>
      <div className="set-thread">{records.map((m, i) => <div key={last + i} className={"set-message " + m.role}><small>{m.label ?? m.role}</small>{m === message && time < .15 ? "•••" : m.text}</div>)}{!records.length && <div className="set-draft">{scene.messages[0]?.text}</div>}</div>
      <div className="set-phone-line"/></div>}
    <Annotation text={scene.aside && clock.cue >= scene.aside.cue ? scene.aside.text : undefined}/>
  </div>;
}
export function ConsoleShot({scene, clock}: {scene: Of<"code">; clock: Clock}) {
  const idx = lastCue(scene.rows,clock.cue);
  const row = scene.rows[idx];
  return <Glass label={scene.title} theme="set-console"><div className="set-buffer">
    {scene.rows.slice(Math.max(0,idx-2),idx+1).map((line,i) => <div className={"set-command " + (line===row ? "current" : "")} key={idx+i}>
      <span>›</span><code>{line === row ? typing(line.code, atCue(clock,line.cue)) : line.code}</code>
      <samp style={{opacity: line === row ? phase(atCue(clock,line.cue),.48,.68) : 1}}>↳ {line.out}</samp>
    </div>)}
    {idx < 0 && <p>{scene.lead}</p>}
  </div>{clock.cue >= scene.aside.cue && <Annotation text={scene.aside.text}/>}</Glass>;
}

export function ParallelRuns({scene, clock}: {scene: Of<"compare">; clock: Clock}) {
  if (clock.cue < Math.min(scene.left.cue,scene.right.cue)) return <div className="set-comparison-input"><p>{scene.sentences[clock.cue] || scene.title}</p><div><span>{scene.left.label}</span><span>{scene.right.label}</span></div></div>;
  return <div className="set-split">{[scene.left,scene.right].map((side,i) => {
    const following = i === 0 ? scene.right.cue : Math.max(scene.sentences.length, side.cue + 1);
    const age = clock.cue + clock.part - side.cue;
    const count = clock.cue < side.cue ? 0 : clock.still ? side.points.length : Math.min(side.points.length,1+Math.floor(unit(age/Math.max(1,following-side.cue)) * side.points.length));
    return <div className={"set-run " + side.tone} key={i}><div className="set-run-title">{side.label}</div>
      <div className="set-run-track">{count===0 && <div className="set-pending">Awaiting input</div>}{side.points.slice(0,count).map((point,j) => <div className="set-event" key={j}><i/>{point}</div>)}</div>
    </div>;
  })}</div>;
}

export function Ledger({scene, clock}: {scene: Of<"table">; clock: Clock}) {
  const idx = lastCue(scene.rows,clock.cue);
  const cost = scene.columns.at(-1) === "Cost";
  const scored = scene.columns.includes("Score");
  const history = scene.rows.slice(Math.max(0,idx-2),idx+1);
  const value = scene.rows[idx]?.cells[1]?.match(/^(\d+) of (\d+)$/);
  return <div className={"set-ledger " + (cost ? "receipt" : "")}>
    <header>{scene.title}</header>
    {scored && value && <div className="set-scores" aria-label={value[0]}>{Array.from({length:Number(value[2])},(_,i) => <i key={i} data-on={i < Math.round(Number(value[1])*phase(atCue(clock,scene.rows[idx]!.cue),0,.55))}/>)}</div>}
    <table><thead><tr>{scene.columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
    <tbody>{history.map((r,i)=><tr key={idx+i} data-current={r===scene.rows[idx]}>{r.cells.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>
    {idx < 0 && <div className="set-scan"/>}
    {clock.cue>=scene.note.cue && <Annotation text={scene.note.text}/>}
  </div>;
}

export function Transfer({scene, clock, root}: {scene: Of<"flow"|"cycle"|"hub">; clock: Clock; root: string}) {
  const items = scene.kind==="flow" ? scene.nodes : scene.kind==="cycle" ? scene.steps : scene.spokes;
  // Multiple operations may be narrated in a single sentence.
  const {index:idx, progress} = take(items,clock);
  const current = items[idx];
  const figure = scene.kind!=="flow";
  const center = {x:50,y:49};
  const pts = items.map((_,i)=>{
    if (figure) { const a=-Math.PI/2+i*2*Math.PI/items.length; return {x:50+33*Math.cos(a),y:49+33*Math.sin(a)}; }
    return {x:10+80*i/Math.max(1,items.length-1), y:i%2 ? 61 : 32};
  });
  const route = (i:number) => scene.kind==="hub" ? center : pts[i-1] ?? (scene.kind==="cycle"?pts.at(-1)!:pts[i]!);
  return <div className="set-transfer"><div className="set-map">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{pts.map((p,i)=>{
      const a=route(i);
      return <g key={i}><line x1={a.x} y1={a.y} x2={p.x} y2={p.y} className="set-path"/>
        {i<=idx && <line x1={a.x} y1={a.y} x2={p.x} y2={p.y} className="set-path done" pathLength="1" strokeDasharray="1" strokeDashoffset={i===idx?1-progress:0}/>}</g>;
    })}</svg>
    {figure && <b className="set-map-center">{scene.center.label}</b>}
    {items.map((n,i)=><div key={i} className="set-stop" data-active={idx===i} style={{left:pts[i]!.x+"%",top:pts[i]!.y+"%"}}>
      <Prop name={artwork(n.icon+" "+n.label,"tool")} root={root}/><b>{n.label}</b></div>)}
    {idx>=0 && !clock.still && <i className="set-packet" style={{left:(route(idx).x+(pts[idx]!.x-route(idx).x)*progress)+"%",top:(route(idx).y+(pts[idx]!.y-route(idx).y)*progress)+"%"}}/>}
  </div><Annotation text={scene.note && clock.cue>=scene.note.cue ? scene.note.text : current?.sub ?? (figure ? scene.center.sub : undefined)}/></div>;
}
