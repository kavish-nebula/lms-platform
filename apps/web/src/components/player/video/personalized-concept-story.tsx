'use client';
import { useMemo } from 'react';
import { FileText, Search, BrainCircuit, MessageSquareText, Cloud, Laptop, Braces, WandSparkles, Workflow, ClipboardCheck, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';
import type { ConceptScene } from '@/lib/personalized-concept';
import { conceptSlides, conceptSlideAt, conceptSlideDuration } from '@/lib/concept-slides';

/** One audio clip drives several readable slides of verbatim validated teaching. */
export function PersonalizedConceptStory({ scene, seconds, duration = 0, reducedMotion, purpose = 'concept' }: { scene: ConceptScene; seconds: number; duration?: number; reducedMotion: boolean; purpose?: 'concept' | 'hook' }) {
  const slides = useMemo(() => conceptSlides(scene), [scene]);
  const index = conceptSlideAt(slides, seconds, conceptSlideDuration(scene, duration));
  const slide = slides[index];
  const icons = scene.visual === 'healthcare' ? [HeartPulse, Workflow, ClipboardCheck] : scene.visual === 'automation' ? [Workflow, Braces, ClipboardCheck] : scene.visual === 'retrieval' ? [FileText, Search, MessageSquareText] : scene.visual === 'deployment' ? [Laptop, Cloud, ClipboardCheck] : [MessageSquareText, BrainCircuit, WandSparkles];
  const Icon = icons[index % icons.length];
  const point = scene.points[Math.min(scene.points.length - 1, Math.floor(index / Math.max(1, slides.length - 1) * scene.points.length))];
  return <div className="hook-film-scene personal-concept-scene personal-teaching-deck" data-scene={scene.id} data-slide={index + 1}>
    <header className="hook-film-heading"><span>{purpose === 'hook' ? 'Your case study' : 'Your concept lesson'}</span><h2>{scene.title}</h2></header>
    <motion.div key={`${scene.id}-${index}`} initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .35 }} className={`personal-teaching-frame personal-teaching-layout-${slide?.context ? 'context' : index % 2}`}>
      <div className="personal-teaching-symbol" aria-hidden><Icon /></div>
      <div className="personal-teaching-copy">
        <span className="personal-teaching-label">{slide?.context ? 'In your context' : 'Follow the explanation'}</span>
        <p className="personal-teaching-explanation">{slide?.text}</p>
      </div>
      {!slide?.context && point && <aside className="personal-teaching-takeaway"><span>Key idea</span><p>{point}</p></aside>}
    </motion.div>
    <div className="personal-teaching-track" aria-label={`Teaching slide ${index + 1} of ${slides.length}`}>
      {slides.map((_, i) => <span key={i} data-current={i === index} data-past={i < index} />)}
    </div>
    <footer className="hook-film-source-note">{purpose === 'hook' ? 'Fictional learning case · Inspect the evidence before deciding' : `Source-linked teaching · ${scene.phase === 'before' ? 'Before the knowledge check' : 'After the knowledge check'}`}</footer>
  </div>;
}
