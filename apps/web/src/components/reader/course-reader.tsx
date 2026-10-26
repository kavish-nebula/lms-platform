"use client";
import * as React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {BookOpen,Check,ChevronLeft,ChevronRight,FileText,Headphones,List,Maximize,NotebookPen,Pause,Play,Search,Sparkles,Star,Type,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetDescription,SheetTitle} from '@/components/ui/sheet';
import {askPip,openPipNotes,useCompanionStep} from '@/components/learning/course-companion';
import {useHydrated,useLocalString,writeLocal} from '@/lib/local-store';
import {parseReader,readerAudioSources,readerHref,readerMinutes,readingDetails,type ReaderModule} from '@/lib/course-reader';
import type {VideoSlide} from '@/data/types';
import {VideoSlideView} from '@/components/player/video/video-slide';
import '@/components/player/video/video.css';
import './reader.css';

type Props={courseId:string;title:string;modules:ReaderModule[];moduleId:string;chapterId:string;book:boolean;presentation:boolean};
export function CourseReader({courseId,title,modules,moduleId,chapterId,book,presentation}:Props){
  const router=useRouter();const hydrated=useHydrated();
  const storageKey=`lms-reader:v1:${courseId}`;const raw=useLocalString(storageKey);
  const state=React.useMemo(()=>parseReader(raw),[raw]);
  const [query,setQuery]=React.useState('');const [starOnly,setStarOnly]=React.useState(false);const [contents,setContents]=React.useState(false);
  const slideKey=`lms-reader-slide:v1:${courseId}:${chapterId}`;
  const savedSlide=Number(useLocalString(slideKey)??'0');
  const [selectedSection,setSection]=React.useState<number|null>(null);
  const section=selectedSection??(presentation&&Number.isInteger(savedSlide)&&savedSlide>=0?savedSlide:0);
  const [playing,setPlaying]=React.useState(false);const [audioError,setAudioError]=React.useState('');const [rate,setRate]=React.useState(1);const [notice,setNotice]=React.useState('');
  const audio=React.useRef<HTMLAudioElement>(null);const root=React.useRef<HTMLDivElement>(null);
  const currentModule=modules.find(m=>m.id===moduleId)!;
  const chapter=currentModule.chapters.find(v=>v.id===chapterId)!;
  const all=modules.flatMap(m=>m.chapters.map(v=>({moduleId:m.id,video:v})));
  const at=all.findIndex(v=>v.video.id===chapterId);const before=all[at-1];const after=all[at+1];
  const [page,setPage]=React.useState<number|null>(null);
  const spread=Math.min(Math.floor((page??state.pages[chapterId]??0)/2)*2,Math.floor(chapter.slides.length/2)*2);
  const idx=Math.min(chapter.slides.length-1,book&&!playing?Math.max(0,spread-1):section);
  // Reading is the authored reference edition, independent of learner revisions.
  const video=chapter;const slides=chapter.slides;
  const srcs=React.useMemo(()=>readerAudioSources(chapter),[chapter]);
  const slide=slides[idx]!;
  const read=state.read.includes(chapterId);const starred=state.starred.includes(chapterId);
  const completed=all.filter(c=>state.read.includes(c.video.id)).length;
  const setSaved=(patch:Partial<typeof state>)=>writeLocal(storageKey,JSON.stringify({...parseReader(raw),...patch}));
  useCompanionStep({phase:'explainer',title:chapter.title,videoId:chapterId,slideTitle:slide.title,guidance:slide.narration});
  React.useEffect(()=>{window.scrollTo({top:0});},[chapterId,book,presentation]);
  React.useEffect(()=>{document.documentElement.dataset.focus='';return()=>{delete document.documentElement.dataset.focus;};},[]);
  React.useEffect(()=>{if(!hydrated)return;writeLocal(storageKey,JSON.stringify({...parseReader(raw),pages:{...state.pages,[chapterId]:spread}}));
    // A page turn persists its own position; unrelated store writes must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[spread,chapterId,hydrated]);
  React.useEffect(()=>{if(hydrated&&presentation)writeLocal(slideKey,String(idx));},[hydrated,presentation,slideKey,idx]);
  React.useEffect(()=>{
    if(book||presentation)return;
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
      if(visible)setSection(Number((visible.target as HTMLElement).dataset.section));
    },{rootMargin:'-100px 0px -55% 0px'});
    root.current?.querySelectorAll('[data-section]').forEach(s=>observer.observe(s));return()=>observer.disconnect();
  },[book,presentation,slides.length]);
  React.useEffect(()=>{
    const a=audio.current;if(!a)return;
    a.playbackRate=rate;
    if(!playing){a.pause();return;}
    if(!srcs[idx])return;
    void a.play().catch(()=>{setPlaying(false);setAudioError('Audio could not start. Press Listen to retry.');});
    return()=>a.pause();
  },[playing,idx,srcs,rate]);
  React.useEffect(()=>{
    const pause=()=>setPlaying(false);window.addEventListener('pip:opened',pause);
    return()=>window.removeEventListener('pip:opened',pause);
  },[]);
  const turn=React.useCallback((direction:number)=>{setPlaying(false);setPage(p=>Math.max(0,Math.min(Math.floor(slides.length/2)*2,(p??spread)+direction*2)));},[slides.length,spread,setPage,setPlaying]);
  const previousDeck=before?readerHref(courseId,before.moduleId,before.video.id,false,true):'';
  const nextDeck=after?readerHref(courseId,after.moduleId,after.video.id,false,true):'';
  const previousKey=before?`lms-reader-slide:v1:${courseId}:${before.video.id}`:'';
  const nextKey=after?`lms-reader-slide:v1:${courseId}:${after.video.id}`:'';
  const previousLast=before?before.video.slides.length-1:0;
  function moveSlide(direction:number){
    setPlaying(false);const next=idx+direction;
    if(next>=0&&next<slides.length){setSection(next);return;}
    const target=direction>0?nextDeck:previousDeck;if(!target)return;
    writeLocal(direction>0?nextKey:previousKey,String(direction>0?0:previousLast));
    router.push(target);
  }
  const keyboardMove=React.useEffectEvent((direction:number)=>moveSlide(direction));
  React.useEffect(()=>{
    if(!book&&!presentation)return;const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[role=dialog],[contenteditable=true]'))return;
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(presentation)keyboardMove(e.key==='ArrowRight'?1:-1);else turn(e.key==='ArrowRight'?1:-1);}
      if(e.key==='Escape'){router.replace(readerHref(courseId,moduleId,chapterId));}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[book,presentation,turn,router,courseId,moduleId,chapterId]);
  function navigate(m:string,id:string){setPlaying(false);setContents(false);router.push(readerHref(courseId,m,id,book,presentation));}
  function jump(i:number){setPlaying(false);setSection(i);if(book)setPage(Math.floor((i+1)/2)*2);else document.getElementById(`reader-section-${i}`)?.scrollIntoView({behavior:'instant',block:'start'});}
  function ended(){if(idx>=slides.length-1){setPlaying(false);setNotice('Chapter narration finished. Reading does not complete the lesson checks.');return;}const next=idx+1;if(!srcs[next]){setPlaying(false);setAudioError('Audio is still being prepared for the next section. You can keep reading.');}setSection(next);if(book)setPage(Math.floor((next+1)/2)*2);else document.getElementById(`reader-section-${next}`)?.scrollIntoView({behavior:'instant',block:'start'});}
  function toggleNarration(){if(!srcs[idx]){setAudioError('Audio is still being prepared for this section. You can keep reading.');return;}setAudioError('');setSection(idx);setPlaying(!playing);}
  async function fullScreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current?.requestFullscreen();}catch{setNotice('Full screen is unavailable in this browser. Book mode still works.');}}
  const shownModules=modules.map(m=>({...m,chapters:m.chapters.filter(v=>(!starOnly||state.starred.includes(v.id))&&`${v.lesson} ${v.title} ${m.title}`.toLowerCase().includes(query.toLowerCase()))})).filter(m=>m.chapters.length);
  const catalogue=<div className="reader-catalogue"><Link href={`/learn/courses/${courseId}`} className="reader-back"><ChevronLeft size={16}/>Back to course</Link><h2>{title}</h2><div className="reader-progress-copy"><strong>{Math.round(completed/Math.max(1,all.length)*100)}%</strong><span>{completed}/{all.length} chapters read</span></div><progress max={Math.max(1,all.length)} value={completed} aria-label="Chapters marked as read"/><div className="reader-search"><Search size={16}/><input aria-label="Search chapters" placeholder="Search chapters…" value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" aria-label="Show starred chapters only" aria-pressed={starOnly} onClick={()=>setStarOnly(!starOnly)}><Star size={16}/></button></div><nav aria-label="Course chapters">{shownModules.map(m=><details key={m.id} open><summary><BookOpen size={17}/><span>{m.title}</span><small>{m.chapters.filter(v=>state.read.includes(v.id)).length}/{m.chapters.length}</small></summary>{m.chapters.map(v=><Link key={v.id} href={readerHref(courseId,m.id,v.id,book,presentation)} aria-current={v.id===chapterId?'page':undefined} onClick={()=>setContents(false)}>{state.read.includes(v.id)?<Check size={15}/>:<FileText size={15}/>}<span>{v.title}</span>{state.starred.includes(v.id)?<Star size={12}/>:null}</Link>)}</details>)}{!shownModules.length?<p className="reader-empty">No matching chapters. Try another search or turn off the star filter.</p>:null}</nav><p className="reader-small">Reading progress stays in this browser. Course checks and assessments keep their existing requirements.</p></div>;
  const pages=Array.from({length:2},(_,i)=>spread+i);
  return <div ref={root} className="course-reader" data-mode={presentation?'presentation':book?'book':'article'} style={{'--reader-size':`${state.font}px`} as React.CSSProperties}>
    <header className="reader-top"><Link href={`/learn/courses/${courseId}`} className="reader-brand" aria-label="Back to course"><BookOpen size={21}/><span>Nebula <b>Reader</b></span></Link><span className="reader-course-title">{title}</span><Button variant="ghost" size="sm" onClick={()=>setContents(true)}><List size={17}/>Contents</Button>{!presentation?<Button variant="outline" size="sm" onClick={()=>router.replace(readerHref(courseId,moduleId,chapterId,false,true))}>Slide view</Button>:<Button variant="ghost" size="sm" onClick={()=>router.replace(readerHref(courseId,moduleId,chapterId))}>Article</Button>}<Button variant="outline" size="sm" onClick={()=>{setPlaying(false);router.replace(readerHref(courseId,moduleId,chapterId,!book));}}>{book?<FileText size={16}/>:<BookOpen size={16}/>}<span>{book?'Exit book':'Book view'}</span></Button></header>
    <Sheet open={contents} onOpenChange={setContents}><SheetContent side="left" className="overflow-y-auto p-5"><SheetTitle>Course contents</SheetTitle><SheetDescription>Choose a chapter to read.</SheetDescription>{contents?catalogue:null}</SheetContent></Sheet>
    {!book?<aside className="reader-sidebar">{catalogue}</aside>:null}
    <main className="reader-main" id="reader-main">
      {presentation?<PresentationCanvas slide={slide} slides={slides} idx={idx} chapterTitle={chapter.title} moduleTitle={currentModule.title} total={all.reduce((n,c)=>n+c.video.slides.length,0)} absolute={all.slice(0,at).reduce((n,c)=>n+c.video.slides.length,0)+idx+1} first={at===0&&idx===0} last={at===all.length-1&&idx===slides.length-1} playing={playing} rate={rate} onRate={setRate} onPlay={toggleNarration} onMove={moveSlide} onSelect={jump} />:!book?<><div className="reader-chapter-heading"><p>{currentModule.title}</p><h1>{chapter.title}</h1><div className="reader-metadata"><span>{readerMinutes(video)} min read</span><span>{at+1} of {all.length} chapters</span><span>Course edition</span></div></div><div className="reader-listen"><Button variant="ghost" onClick={toggleNarration}>{playing?<Pause size={18}/>:<Play size={18}/>}<span>{playing?'Pause narration':'Listen to this chapter'}</span></Button><label><span className="sr-only">Narration speed</span><select aria-label="Narration speed" value={rate} onChange={e=>setRate(Number(e.target.value))}>{[.75,1,1.25,1.5].map(r=><option key={r} value={r}>{r}×</option>)}</select></label><span className="reader-small"><Headphones size={15}/>Section {idx+1} of {slides.length}</span></div><article className="reader-article"><div className="reader-intro" data-section={0}><p>{video.notes[0]||video.title}</p><p>Read the explanation, follow the examples, then return to the lesson to practise and complete its checks.</p></div>{slides.map((s,i)=><section key={i} id={`reader-section-${i}`} data-section={i} tabIndex={-1}><ReadingSection slide={s}/></section>)}<div className="reader-check"><h2>Put it into practice</h2><p>Ready to apply this chapter? Continue with its narrated lesson and checks.</p><Button asChild variant="brand"><Link href={`/learn/courses/${courseId}/${moduleId}/explainer?v=${chapterId}`}>Open lesson and checks<ChevronRight size={16}/></Link></Button></div></article></>:<>
        <div className="reader-book-heading"><span>{currentModule.title}</span><span>Chapter {at+1} of {all.length}</span></div><div className="reader-spread" aria-label="Book pages">{pages.map(p=><article key={p} className="reader-paper" aria-label={`Page ${p+1}`}><div className="reader-paper-body">{p===0?<><p className="reader-chapter-label">Chapter {at+1} · {currentModule.title}</p><h1>{chapter.title}</h1><div className="reader-rule"/><p className="reader-dropcap">{video.notes[0]||slides[0]?.narration}</p>{video.notes.length>1?<><h2>In this chapter</h2><ul>{video.notes.slice(1).map(n=><li key={n}>{n}</li>)}</ul></>:null}</>:slides[p-1]?<ReadingSection slide={slides[p-1]!}/>:<><h2>Keep the idea. Test your understanding.</h2><p>You have reached the end of this chapter. Mark it as read, continue to the next chapter, or open the lesson checks.</p><Link href={`/learn/courses/${courseId}/${moduleId}/explainer?v=${chapterId}`}>Open lesson and checks</Link></>}</div><footer><span>{p%2===0?chapter.title:currentModule.title}</span><span>{p+1}</span></footer></article>)}</div><div className="reader-page-turns"><Button aria-label="Previous book pages" variant="outline" size="icon" disabled={spread===0} onClick={()=>turn(-1)}><ChevronLeft/></Button><span>Pages {spread+1}–{spread+2} · {chapter.title}</span><Button aria-label="Next book pages" variant="outline" size="icon" disabled={spread+2>slides.length} onClick={()=>turn(1)}><ChevronRight/></Button></div>
      </>}
      <div className="reader-status" role="status">{audioError||notice}</div>
    </main>
    {!book&&!presentation?<aside className="reader-toc"><div className="reader-location"><span>Reading position</span><span>{idx+1}/{slides.length}</span></div><progress max={slides.length} value={idx+1} aria-label="Current reading section"/><h2>On this page</h2><nav aria-label="On this page">{slides.map((s,i)=><button type="button" key={i} aria-current={idx===i?'location':undefined} onClick={()=>jump(i)}>{s.title}</button>)}</nav></aside>:null}
    <footer className="reader-toolbar" aria-label="Reader tools"><div className="reader-chapter-nav"><Button size="sm" variant="ghost" disabled={!before} aria-label="Previous chapter" onClick={()=>before&&navigate(before.moduleId,before.video.id)}><ChevronLeft/><span>Previous</span></Button><Button size="sm" variant="ghost" disabled={!after} aria-label="Next chapter" onClick={()=>after&&navigate(after.moduleId,after.video.id)}><span>Next</span><ChevronRight/></Button></div><div className="reader-tools"><Button size="sm" variant="ghost" onClick={openPipNotes}><NotebookPen size={17}/><span>Notes</span></Button><Button size="sm" variant="ghost" aria-pressed={starred} onClick={()=>setSaved({starred:starred?state.starred.filter(id=>id!==chapterId):[...state.starred,chapterId]})}><Star size={17} fill={starred?'currentColor':'none'}/><span>Star</span></Button><Button size="sm" variant={read?'outline':'ghost'} aria-pressed={read} onClick={()=>{setSaved({read:read?state.read.filter(id=>id!==chapterId):[...state.read,chapterId]});setNotice(read?'Chapter marked unread.':'Chapter marked as read. Lesson checks remain separate.');}}><Check size={17}/><span>{read?'Read':'Mark as read'}</span></Button><Button size="sm" variant="ghost" onClick={()=>{setPlaying(false);askPip(`Explain the idea in this section: ${slide.title}`);}}><Sparkles size={17}/><span>Ask AI</span></Button></div><div className="reader-view-tools">{book?<Button variant="ghost" size="icon" aria-label={playing?'Pause narration':'Listen to chapter'} onClick={toggleNarration}>{playing?<Pause size={17}/>:<Headphones size={17}/>}</Button>:null}<Button size="sm" variant="ghost" aria-label="Change reading text size" onClick={()=>setSaved({font:state.font===16?18:state.font===18?20:16})}><Type size={18}/><span>{state.font}</span></Button><Button variant="ghost" size="icon" aria-label="Toggle full screen" onClick={fullScreen}><Maximize size={17}/></Button><Button asChild variant="ghost" size="sm"><Link href={`/learn/courses/${courseId}/${moduleId}/explainer?v=${chapterId}`}>{presentation?'Lesson & checks':'Slides'}</Link></Button></div></footer>
    <audio ref={audio} src={srcs[idx]||undefined} onEnded={ended} onError={()=>{setPlaying(false);setAudioError('This section’s audio is unavailable. You can keep reading or retry later.');}} preload="none"/>
    {book?<Button variant="ghost" size="icon" className="reader-book-close" aria-label="Exit book view" onClick={()=>router.replace(readerHref(courseId,moduleId,chapterId))}><X size={18}/></Button>:null}
  </div>;
}
function ReadingSection({slide}:{slide:VideoSlide}){
  const details=readingDetails(slide);
  return <><h2>{slide.title}</h2>{slide.narration.split(/\n\s*\n/).map((p,i)=><p key={i}>{p}</p>)}{details.length?<div className="reader-details">{details.map((d,i)=><div key={i}>{d.label?<strong>{d.label}</strong>:null}<p>{d.text}</p></div>)}</div>:null}</>;
}
function PresentationCanvas({slide,slides,idx,chapterTitle,moduleTitle,total,absolute,first,last,playing,rate,onRate,onPlay,onMove,onSelect}:{slide:VideoSlide;slides:VideoSlide[];idx:number;chapterTitle:string;moduleTitle:string;total:number;absolute:number;first:boolean;last:boolean;playing:boolean;rate:number;onRate:(n:number)=>void;onPlay:()=>void;onMove:(n:number)=>void;onSelect:(n:number)=>void}){
  return <section className="reader-presentation" aria-label="Course presentation">
    <header className="reader-deck-heading"><div><p>{moduleTitle}</p><h1>{chapterTitle}</h1></div><span>Course concepts · original edition</span></header>
    <div className="reader-slide-counter" aria-live="polite"><span>Slide {idx+1} of {slides.length} in this chapter</span><span>{absolute} / {total} course slides</span></div>
    <div className="vl-stage reader-slide-frame" aria-label={`Slide ${idx+1}: ${slide.title}`}><VideoSlideView key={`${idx}:${slide.title}`} slide={slide} shown={()=>true}/></div>
    <div className="reader-deck-controls"><Button variant="outline" size="sm" disabled={first} onClick={()=>onMove(-1)} aria-label="Previous slide"><ChevronLeft/>Previous slide</Button><Button variant="brand" size="sm" onClick={onPlay}>{playing?<Pause size={16}/>:<Play size={16}/>}<span>{playing?'Pause narration':'Play narration'}</span></Button><label><span className="sr-only">Narration speed</span><select aria-label="Narration speed" value={rate} onChange={e=>onRate(Number(e.target.value))}>{[.75,1,1.25,1.5].map(n=><option key={n} value={n}>{n}×</option>)}</select></label><Button variant="outline" size="sm" disabled={last} onClick={()=>onMove(1)} aria-label="Next slide">Next slide<ChevronRight/></Button></div>
    <nav className="reader-slide-strip" aria-label="Slides in this chapter">{slides.map((s,i)=><button key={i} type="button" aria-current={i===idx?'step':undefined} onClick={()=>onSelect(i)}><span>{i+1}</span><strong>{s.title}</strong></button>)}</nav>
    <details className="reader-speaker-notes"><summary>Narration / speaker notes</summary><p>{slide.narration}</p></details>
    <p className="reader-small">Use ← / → to move through the course. The next slide continues into the next chapter automatically. Lesson checks remain in the course player.</p>
  </section>;
}
