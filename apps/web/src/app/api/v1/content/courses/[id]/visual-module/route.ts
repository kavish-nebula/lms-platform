import { z } from 'zod/v4';
import { VisualLesson } from '@/lib/visual-lesson';
import { REFERENCE_VIDEO_DIRECTION } from '@/lib/visual-authoring';
import { stage4VisualTargets } from '@/server/stage4-visual-source';
import { getSessionUser } from '@/server/auth';
import { handle, ok } from '@/server/http';

export const GET=handle(async(request:Request,{params}:{params:Promise<{id:string}>})=>ok({
  targets:await stage4VisualTargets((await getSessionUser()).id,(await params).id,new URL(request.url).searchParams.get('moduleId')??undefined),
  styleDirection:REFERENCE_VIDEO_DIRECTION,
  schema:z.toJSONSchema(VisualLesson),
  workflow:'get_visual_module → get_visual_lesson → save_visual_lesson → prepare_visual_media(audio) → creator review → optional MP4 export. No automatic publication.',
}));
