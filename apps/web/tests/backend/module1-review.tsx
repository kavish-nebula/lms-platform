import React from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import {VideoSlideView} from '../../src/components/player/video/video-slide';
import type {VideoSlide} from '../../src/data/types';

type CheckedSlide={videoId:string;slide:number;lesson:string;authored:VideoSlide;content:VideoSlide;audioFile:string;issues:string[]};
type Revision={content:VideoSlide;audioHash:string};
type Review={total:number;passed:number;field:string;results:CheckedSlide[]};
type Loop={before:Revision;after:Revision;originalRecordsUnchanged:boolean};
function Slide({slide}:{slide:VideoSlide}) {
  return <div className="vl-stage"><VideoSlideView slide={slide} shown={()=>true}/></div>;
}
function Recording({src,label}:{src:string;label:string}) {
  return <audio controls preload="none" src={src} aria-label={label}/>;
}
function App({report,loop}:{report:Review;loop:Loop}) {
  const lessons=[...new Set(report.results.map(s=>s.videoId))];
  return <MotionConfig reducedMotion="always"><main>
    <header><p className="eyebrow">Real service verification · Mechanical engineering</p><h1>Your learning loop, tested</h1><p className="intro">Every Module 1 slide uses your saved profile. Compare the Module 2 lesson before and after the simulated Module 1 results, then inspect and listen to all 40 slides.</p><div className="stats"><b>{report.passed}/{report.total} slides checked</b><b>40 real narration recordings</b><b>Actual progress unchanged</b></div></header>
    <nav aria-label="Review sections"><a href="#performance">Module 1 → Module 2</a>{lessons.map(id=><a key={id} href={'#'+id}>Lesson {id.slice(3)}</a>)}</nav>
    <section id="performance"><p className="eyebrow">Controlled demonstration · isolated learner</p><h2>Struggling with agent basics adds a reminder to Module 2</h2><p>Two <strong>simulated incorrect answers</strong> in lesson 1.1 were graded by the server in a separate database. The learner’s actual answers and progress were not edited. The same Module 2 slide gained a visible and spoken prerequisite reminder; its main teaching stayed in place.</p><div className="comparison">
      <article><h3>Before Module 1 evidence</h3><Slide slide={loop.before.content}/><p className="transcript">{loop.before.content.narration}</p><Recording src="/loop/before.wav" label="Module 2 before performance evidence"/></article>
      <article><h3>After two simulated misses</h3><Slide slide={loop.after.content}/><p className="transcript">{loop.after.content.narration}</p><Recording src="/loop/after.wav" label="Module 2 after performance evidence"/></article>
    </div><p className="hint">Listen for “Quick reminder”. The two WAV files have different hashes and were verified to match their respective narration. Repeated AI generation can vary; the added prerequisite bridge is the controlled adaptation checked here.</p></section>
    <section><p className="eyebrow">Main app · your current profile</p><h2>All five Module 1 lessons</h2><p>Profile: <strong>{report.field}</strong>. Each preview below uses the app’s actual slide component and CSS, with every narration cue revealed. Play any recording. The authored version is available beneath each preview.</p>
    {lessons.map(id=><section key={id} id={id} className="lesson"><h3>{report.results.find(s=>s.videoId===id)!.lesson}</h3>{report.results.filter(s=>s.videoId===id).map(s=><article className="slide-card" key={s.videoId+':'+s.slide} data-slide={s.videoId+':'+s.slide}><div><p className="eyebrow">{s.videoId} · Slide {s.slide+1} · {s.issues.length?'Needs review':'Verified'}</p><Slide slide={s.content}/><details><summary>Compare original authored slide</summary><Slide slide={s.authored}/><p>{s.authored.narration}</p></details></div><div className="spoken"><h4>Narration</h4><p>{s.content.narration}</p><Recording src={'/audio/'+s.audioFile} label={`${s.videoId} slide ${s.slide+1} narration`}/><p className="hint">Checked: structure, protected fields, layout limits, sentence alignment and a complete real WAV. Three slides received fresh example revisions during this review.</p></div></article>)}</section>)}
    </section><footer>This is a local review of recorded real Gemini and Kokoro outputs, not a simulated audio player. No assessment answers are exposed. Automated checks and this review do not constitute formal subject-matter approval.</footer>
  </main></MotionConfig>;
}
Promise.all([fetch('/report.json').then(r=>r.json()),fetch('/loop/report.json').then(r=>r.json())]).then(([report,loop])=>createRoot(document.getElementById('root')!).render(<App report={report} loop={loop}/>));
