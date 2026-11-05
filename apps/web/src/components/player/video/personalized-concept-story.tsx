'use client';
import { FileText, Search, BrainCircuit, MessageSquareText, Cloud, Laptop, ArrowRight, Braces, WandSparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { ConceptFactoryVisual } from '../hook/concept-factory-visual';
import type { ConceptScene } from '@/lib/personalized-concept';

/** Illustrations use the same source style as the concept recording and hook.
 * All teaching labels come from the learner's validated scene, not hardcoded claims. */
export function PersonalizedConceptStory({ scene, seconds, reducedMotion }: { scene: ConceptScene; seconds: number; reducedMotion: boolean }) {
  const generic = scene.visual === 'language' ? [MessageSquareText, BrainCircuit, Braces] : scene.visual === 'retrieval' ? [FileText, Search, MessageSquareText] : scene.visual === 'deployment' ? [Laptop, ArrowRight, Cloud] : [MessageSquareText, WandSparkles, FileText];
  const progress = reducedMotion ? 1 : Math.min(1, seconds / 2);
  return <div className="hook-film-scene personal-concept-scene">
    <header className="hook-film-heading"><span>Nebula KnowLab · Your concept lesson</span><h2>{scene.title}</h2></header>
    <div className="hook-film-composition personal-concept-composition">
      <div className="personal-concept-illustration">{scene.visual === 'automation' ? <ConceptFactoryVisual stopped={false} seconds={reducedMotion ? 0 : seconds} /> : <div className={`personal-concept-diagram personal-concept-diagram-${scene.visual}`}>{generic.map((Icon, i) => <motion.div key={i} initial={false} animate={{ opacity: reducedMotion || progress > i * .2 ? 1 : .35 }} className="personal-concept-node"><Icon aria-hidden />{i < generic.length - 1 && scene.visual !== 'deployment' && <span className="personal-concept-link" aria-hidden />}</motion.div>)}</div>}<span className="hook-film-illustration-note">Conceptual illustration</span></div>
      <div className="personal-concept-points">{scene.points.map((point, i) => <motion.p key={i} initial={false} animate={{ opacity: reducedMotion || seconds > i * 1.6 ? 1 : .45 }}><span aria-hidden>{i + 1}</span>{point}</motion.p>)}<p className="personal-concept-bridge"><strong>In your context</strong>{scene.bridge}</p></div>
    </div>
    <footer className="hook-film-source-note">Source-linked teaching · Personalised examples · {scene.phase === 'before' ? 'Before the knowledge check' : 'After the knowledge check'}</footer>
  </div>;
}
