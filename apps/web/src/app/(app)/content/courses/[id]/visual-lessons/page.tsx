import { notFound } from 'next/navigation';
import { getSessionUser } from '@/server/auth';
import { visualLessonState } from '@/server/visual-lessons';
import { VisualLessonWorkspace } from '@/components/content/visual-lesson-workspace';
import { ApiError } from '@/server/http';
export default async function VisualLessonPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{sourceId?:string;videoId?:string}>}){
  const {id}=await params,query=await searchParams;
  let initial;
  try{initial=await visualLessonState((await getSessionUser()).id,id,query.videoId,query.sourceId);}
  catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}
  return <VisualLessonWorkspace initial={initial}/>;
}
