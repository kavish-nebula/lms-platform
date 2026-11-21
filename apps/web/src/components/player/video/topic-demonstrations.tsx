import React from "react";
import type { VideoSlide } from "@/data/types";
import { Prop, take, unit, type Clock } from "./topic-sets";
import { TentLandscape } from "../hook/tent-landscape";

type OpeningProps = { clock: Clock; root: string };
// The same storefront as the problem hook. Here the customer's question has
// a different outcome because Scout can take the order number to a tool.
export function OrbitOpening({clock, root}: OpeningProps) {
  const {cue,part}=clock;
  if (cue === 0) return <div className="set-store"><div className="store-landscape"><TentLandscape/></div>
    <div className="store-mast">Orbit Outdoor</div><div className="store-product">Trailhead 2P tent</div></div>;
  if (cue === 1) {
    const tickets = ["Where is my order?", "Order ORB-10482, any update?", "Where is my tent?", "Has my order shipped?"];
    const count = 1 + Math.floor(part * 3.99);
    return <div className="set-inbox"><header>Orbit helpdesk <b>{count}</b></header>{tickets.slice(0,count).map(text=><div key={text}><i/>{text}<small>Open</small></div>)}</div>;
  }
  if (cue === 2) return <div className="set-dispatch"><div className="set-ticket"><small>Ana · Order enquiry</small><b>Where is my tent?</b><code>ORB-10482</code></div>
    <div className="set-stamp" style={{opacity:unit(part*3),transform:`rotate(-5deg) scale(${1+(1-unit(part*3))*.3})`}}>get_order</div>
    {part>.4 && <div className="set-shipping"><Prop name="parcel" root={root}/><div><small>ParcelPath</small><strong>Shipped</strong><code>PP-88213</code></div></div>}</div>;
  return <div className="set-phone"><div className="set-notch"/><div className="set-contact">Orbit help</div><div className="set-thread"><div className="set-message user"><small>Ana</small>Where is my tent?</div><div className="set-message agent"><small>Scout</small>{part<.18 ? "•••" : "Your tent has shipped with ParcelPath. Your tracking number is PP-88213."}</div></div><div className="set-phone-line"/></div>;
}

export function TokenPress({scene,clock}:{scene: Extract<VideoSlide,{kind:"flow"}>;clock: Clock}) {
  const tokens=(scene.nodes[1]?.sub??"").split(/\s*·\s*/);
  const index=scene.nodes.findLastIndex(n=>n.cue<=clock.cue);
  return <div className="set-tokenpress"><header>{scene.nodes[0]?.sub}</header>
    <div className="set-tokens">{tokens.map((word,i)=><b key={i} style={{translate:`0 ${(1-unit(clock.part*2-i*.08))* (index===1?-18:0)}px`,opacity:index>=1?1:.45}}>{word}</b>)}</div>
    {index>=2 && <div className="set-model-pass"><i/><span>{scene.nodes[2]?.sub}</span><i/></div>}
    {index>=3 && <div className="set-output-token">{scene.nodes[3]?.label}<span>+</span></div>}</div>;
}

export function SameQuestion({scene,clock,root}:{scene: Extract<VideoSlide,{kind:"compare"}>;clock: Clock;root:string}) {
  const {cue,part}=clock;
  if (cue===4) return <OrbitOpening clock={{...clock,cue:2}} root={root}/>;
  const scout=cue>=3;
  const question="Where is my order?";
  const reply=scout ? "Your tent shipped with ParcelPath. Tracking: PP-88213." : "Sorry, I can’t check your order.";
  return <div className="set-help"><div className="help-brand"><TentLandscape/><strong>Orbit Outdoor</strong></div>
    <div className="help-chat"><header>{scout ? scene.right.label : scene.left.label}</header><div className="set-thread">
      {cue>0 && <div className="set-message user"><small>Ana</small>{question}</div>}
      {(cue===2 || cue>=5) && <div className="set-message agent"><small>{scout ? "Scout" : "Orbit help"}</small>{cue===2 || cue===5 ? reply.slice(0,Math.ceil(reply.length*unit(part*2))) : reply}</div>}
    </div><div className="help-compose">{cue===0 ? question.slice(0,Math.ceil(question.length*unit(part*2))) : "Message…"}</div></div></div>;
}

export function ParcelJourney({scene,clock,root}:{scene: Extract<VideoSlide,{kind:"flow"}>; clock: Clock; root: string}) {
  const i=scene.nodes.findLastIndex(n=>n.cue<=clock.cue);
  const node=scene.nodes[i];
  const p=i<2 ? 0 : i>2 ? 1 : clock.part;
  // The map shows the information travelling to the carrier, not a claim
  // about the parcel's physical location.
  return <div className="set-waybill"><header>ParcelPath <span>Tracking enquiry</span></header>
    <svg viewBox="0 0 540 185" aria-hidden="true"><defs><pattern id="waybill-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 32 32 0 M-8 8 8 -8" stroke="#bdc7bb" fill="none"/></pattern></defs><rect width="540" height="185" fill="url(#waybill-grid)"/><path d="M0 150 Q120 75 260 110 T540 20" stroke="#a0cad2" strokeWidth="19" fill="none"/>
    <path d="M72 132 L206 132 L206 61 L452 61" stroke="#824620" strokeWidth="4" strokeDasharray="6 5" fill="none"/><circle cx="72" cy="132" r="9" fill="#293740"/><circle cx="452" cy="61" r="9" fill="#293740"/>
    <image href={root+"/parcel.svg"} x={(p<.3?72+134*p/.3:p<.48?206:206+246*(p-.48)/.52)-16} y={(p<.3?132:p<.48?132-71*(p-.3)/.18:61)-30} width="32" height="32"/></svg>
    <footer><b>{node?.label ?? "Order enquiry"}</b><span>{node?.sub ?? scene.nodes[0]?.sub}</span></footer></div>;
}

export function PolicySearch({scene,clock}:{scene: Extract<VideoSlide,{kind:"flow"}>;clock: Clock}) {
  const i=scene.nodes.findLastIndex(n=>n.cue<=clock.cue);
  const chunks=["Returns","Return shipping","Other policies"];
  return <div className="set-search"><div className="set-policy-file"><small>policy.md</small><strong>Orbit policies</strong>
    {chunks.map((label,k)=><div key={label} className={i>=2&&k<2?"match":""} style={{translate:`${i>=1 ? (k+1)*4 : 0}px 0`}}>{label}<i/><i/></div>)}</div>
    {i>=2 && <div className="set-evidence"><small>{i===2?"Search results":"Model context"}</small><p>Return shipping</p><p>Returns</p>{i>=4 && <b>Answer with the retrieved policy</b>}</div>}</div>;
}

export function ApprovalGate({scene,clock}:{scene: Extract<VideoSlide,{kind:"table"}>;clock: Clock}) {
  const {index,progress}=take(scene.rows,clock);
  const row=scene.rows[index];
  const blocked=row?.tone==="bad";
  return <div className="set-gate"><header>Action permissions</header>
    <div className="gate-lane"><div className="gate-pass" style={{left:(row ? (blocked ? 8+26*progress : 8+61*progress) : 8)+"%"}}>{row?.cells[0] ?? scene.columns[0]}</div>
      <div className="gate-bar" style={{rotate: row && !blocked ? (-80*progress)+"deg" : "0deg"}}/></div>
    {row && <footer><strong>{row.cells[2]}</strong><span>{row.cells[1]}</span></footer>}
    {clock.cue>=scene.note.cue && <p>{scene.note.text}</p>}</div>;
}

export function SessionFiles({scene,clock}:{scene: Extract<VideoSlide,{kind:"table"}>;clock: Clock}) {
  const {index,progress}=take(scene.rows,clock);
  return <div className="set-files"><header>Session storage</header><div className="file-drawers">
    {scene.rows.map(({cells},i)=><div key={cells[0]} data-open={index===i}><small>{cells[0]}</small><strong>{cells[1]}</strong>
      {index===i && <p style={{opacity:unit(progress*4)}}>{cells[2]}</p>}</div>)}</div>
    {clock.cue>=scene.note.cue && <p>{scene.note.text}</p>}</div>;
}

export function Backoff({scene,clock}:{scene: Extract<VideoSlide,{kind:"code"}>;clock: Clock}) {
  const {index,progress}=take(scene.rows,clock);
  const row=scene.rows[index];
  return <div className="set-retries"><header>ParcelPath · request history</header>
    <div className="retry-line">{["1","2","3"].map((n,i)=><React.Fragment key={n}>{i>0 && <span style={{flexGrow:i}}>Wait {i}s</span>}
      <b data-on={index>=3 || (index===2 && progress>=(i===0?0:i===1?.3:.8)) || (i===0 && index>=0)}>{n}</b></React.Fragment>)}</div>
    <pre>{row?.code ?? scene.lead}</pre>{row && <p>{row.out}</p>}</div>;
}
