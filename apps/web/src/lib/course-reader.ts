import type {ConceptVideo, ModuleContent, VideoSlide} from '@/data/types';

export type ReadingVideo = Omit<ConceptVideo,'midQuiz'|'endQuiz'|'quizAfter'>;
export type ReaderModule = {id:string;title:string;chapters:ReadingVideo[]};
/** The reader transports teaching material only. Assessment items never enter its payload. */
export function readerModule(mod:ModuleContent):ReaderModule {
  const block=mod.blocks.find(b=>b.stage==='explainer');
  return {id:mod.module_id,title:mod.title,chapters:block?.stage==='explainer'?(block.videos??[]).map(v=>({id:v.id,module:v.module,lesson:v.lesson,title:v.title,notes:v.notes,slides:v.slides,...(v.audio?{audio:v.audio}:{})})):[]};
}
/** Pair authored slides only with authored clips; never use learner revision audio. */
export function readerAudioSources(video:ReadingVideo):string[]{
  return video.slides.map((_,i)=>video.audio?video.audio[i]??'':`/audio/video-${video.id}-s${i}.mp3`);
}
export function readerHref(courseId:string,moduleId:string,chapter:string,book=false,presentation=false){return `/learn/courses/${courseId}/${moduleId}/reader?chapter=${encodeURIComponent(chapter)}${book?'&book=1':presentation?'':'&view=article'}`;}
export function readerMinutes(video:ReadingVideo){return Math.max(1,Math.ceil(video.slides.reduce((n,s)=>n+s.narration.split(/\s+/).length,0)/200));}
export type ReadingDetail={label?:string;text:string};
export function readingDetails(s:VideoSlide):ReadingDetail[]{
  switch(s.kind){
    case 'title':return [{label:s.kicker,text:s.sub}];
    case 'define':return [{label:s.term,text:s.definition},...s.parts.map(p=>({text:p.text})),{label:s.analogy.label,text:s.analogy.text}];
    case 'compare':return [s.left,s.right].map(x=>({label:x.label,text:x.points.join(' · ')}));
    case 'flow':return [...s.nodes.map(x=>({label:x.label,text:x.sub})),{text:s.note.text}];
    case 'bullets':return [...s.bullets.map(x=>({text:x.text})),{label:s.aside.label,text:s.aside.text}];
    case 'example':return [{text:s.scenario},...s.steps.map(x=>({label:x.time,text:x.text})),{label:'Outcome',text:s.result.text}];
    case 'cards':return s.cards.map(x=>({label:x.title,text:x.flow.join(' → ')}));
    case 'table':return s.rows.map(x=>({text:x.cells.map((v,i)=>`${s.columns[i]}: ${v}`).join(' · ')}));
    case 'code':return s.rows.map(x=>({label:x.code,text:x.out}));
    case 'recap':return s.points.map(x=>({text:x.text}));
    case 'hub':return s.spokes.map(x=>({label:x.label,text:x.sub}));
    case 'cycle':return s.steps.map(x=>({label:x.label,text:x.sub}));
    case 'chat':return s.messages.map(x=>({label:x.label||x.role,text:x.text}));
  }
}
export type ReaderState={version:1;read:string[];starred:string[];pages:Record<string,number>;font:16|18|20};
export const EMPTY_READER:ReaderState={version:1,read:[],starred:[],pages:{},font:18};
/** Unknown versions and malformed browser data cannot leak into course progress. */
export function parseReader(raw:string|null):ReaderState{
  try{const v=JSON.parse(raw??'null');if(v?.version!==1)return EMPTY_READER;
    const ids=(x:unknown)=>Array.isArray(x)?[...new Set(x.filter((s):s is string=>typeof s==='string'))]:[];
    const pages=Object.fromEntries(Object.entries(v.pages&&typeof v.pages==='object'?v.pages:{}).filter(([k,n])=>k!=='__proto__'&&typeof n==='number'&&Number.isInteger(n)&&n>=0));
    return {version:1,read:ids(v.read),starred:ids(v.starred),pages:pages as Record<string,number>,font:[16,18,20].includes(v.font)?v.font:18};
  }catch{return EMPTY_READER;}
}
