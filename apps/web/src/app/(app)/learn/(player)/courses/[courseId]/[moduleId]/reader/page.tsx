import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getCourse,getModule} from '@/data';
import {readerModule} from '@/lib/course-reader';
import {CourseReader} from '@/components/reader/course-reader';
import {ModuleLock} from '@/components/player/module-lock';
type Params={courseId:string;moduleId:string};
export const metadata:Metadata={title:'Course reader'};
export default async function ReaderPage({params,searchParams}:{params:Promise<Params>;searchParams:Promise<{chapter?:string;book?:string;view?:string}>}){
  const [{courseId,moduleId},query]=await Promise.all([params,searchParams]);
  if(courseId!=='ai-agent')notFound();
  const course=await getCourse(courseId);if(!course)notFound();
  const modules=(await Promise.all(course.modules.map(m=>getModule(courseId,m.module_id)))).filter(m=>m!==null&&m!==undefined).map(readerModule).filter(m=>m.chapters.length);
  const current=modules.find(m=>m.id===moduleId);if(!current)notFound();
  const chapter=query.chapter??current.chapters[0]!.id;if(!current.chapters.some(v=>v.id===chapter))notFound();
  const index=course.modules.findIndex(m=>m.module_id===moduleId);const previous=course.modules[index-1];
  return <ModuleLock courseId={courseId} moduleTitle={current.title} previous={previous?{moduleId:previous.module_id,title:previous.title}:undefined}>
    <CourseReader key={`${moduleId}:${chapter}`} courseId={courseId} title={course.title} modules={modules} moduleId={moduleId} chapterId={chapter} book={query.book!==undefined} presentation={query.book===undefined&&query.view!=='article'}/>
  </ModuleLock>;
}
