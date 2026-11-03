'use client';
import { FileText, Sparkles, ArrowRight, ScanText, CircleHelp } from 'lucide-react';
import { motion } from 'motion/react';
import { hookExcerpt, hookVisualKind, type HookScene } from '@/lib/video-first-hook';
import { ConceptFactoryVisual } from './concept-factory-visual';

const excerpt = (text: string) => hookExcerpt(text).split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
const headings = { incident: 'One incident. Two versions.', document: 'Start with the source.', draft: 'The draft sounds certain.', comparison: 'What does the evidence say?', decision: 'Your turn to decide.' };

export function HookStoryboard({ scenes, index, seconds, reducedMotion }: { scenes: HookScene[]; index: number; seconds: number; reducedMotion: boolean }) {
  const scene = scenes[index];
  const kind = hookVisualKind(scene, index);
  const firstSource = scenes.find(s => /DOC[-\w]+/i.test(s.text)) ?? scenes[0];
  const draft = scenes.find(s => /\b(?:AI|LLM)\s+draft\b|draft\s+(?:says|claims)/i.test(s.text));
  const production = /\b(?:CNC|production|shift|machine|PACK)\b/i.test(firstSource.text);
  const pause = firstSource.text.match(/paused\s+for\s+(\d+)\s+minutes/i)?.[1];
  const record = (text: string, isDraft = false) => <div className={`hook-film-document ${isDraft ? 'hook-film-draft' : ''}`}>
    <div className="hook-film-document-bar">{isDraft ? <Sparkles aria-hidden /> : <FileText aria-hidden />}<span>{isDraft ? 'AI-generated draft' : 'Original source record'}</span><span className="hook-film-document-dot" /></div>
    <blockquote>{excerpt(text)}</blockquote>
    <div className="hook-film-document-footer">{isDraft ? 'Ready for your review' : 'Supplied course evidence'}</div>
  </div>;
  return <div className={`hook-film-scene hook-film-scene-${kind}`}>
    <header className="hook-film-heading"><span>Nebula KnowLab · Case study</span><h2>{headings[kind]}</h2></header>
    <motion.div key={kind + index} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : .25 }} className="hook-film-composition">
      {kind === 'incident' && <div className="hook-film-incident"><div>{production ? <ConceptFactoryVisual stopped={seconds > 1.8 || reducedMotion} seconds={seconds} /> : <div className="hook-film-paper-stack"><FileText aria-hidden /><span>A report needs your review</span></div>}<p className="hook-film-illustration-note">Conceptual illustration</p></div><aside className="hook-film-incident-note"><span className="hook-film-status">Case file</span>{pause && <div className="hook-film-metric"><strong>{pause}</strong><span>minutes paused</span></div>}<p>{excerpt(firstSource.text)}</p></aside></div>}
      {kind === 'document' && <div className="hook-film-document-scene"><div className="hook-film-document-mark"><ScanText aria-hidden /><span>Read the record</span></div>{record(scene.text)}</div>}
      {kind === 'draft' && <div className="hook-film-draft-scene"><div className="hook-film-draft-path"><FileText aria-hidden /><ArrowRight aria-hidden /><Sparkles aria-hidden /></div>{record(scene.text, true)}</div>}
      {kind === 'comparison' && <div className="hook-film-comparison">{record(firstSource.text)}<div className="hook-film-compare-symbol" aria-hidden><ScanText /></div>{draft ? record(draft.text, true) : record(scene.text)}</div>}
      {kind === 'decision' && <div className="hook-film-decision"><div className="hook-film-decision-path"><FileText aria-hidden /><span /><Sparkles aria-hidden /><span /><CircleHelp aria-hidden /></div><p>{scene.text}</p><span className="hook-film-decision-tag">Pause here. Make your prediction.</span></div>}
    </motion.div>
    <footer className="hook-film-source-note">Fictional learning case · No real production action is requested</footer>
  </div>;
}
