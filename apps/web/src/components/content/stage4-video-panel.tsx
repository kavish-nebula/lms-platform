'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Stage4VideoPanel({courseId,moduleId,targets}:{courseId:string;moduleId:string;targets:{videoId:string;title:string;kind:'hook'|'concept'}[]}) {
  const [notice,setNotice]=useState('');
  const prompt=`Use reference-style-course-video and lesson-generation. Read get_visual_module for course ${courseId}, module ${moduleId}. Read the visual-lesson schema. For its problem hook and every concept, read get_visual_lesson, create a concise source-linked reference-cinema storyboard with diverse document/workspace/journey visuals, then save_visual_lesson using the current versions. Prepare matching narration with prepare_visual_media. Keep scripts editable, original recordings separate, and leave publication for human review. Do not change the SME brief or quizzes.`;
  async function handoff() {
    try {
      const response=await fetch(`/api/v1/content/courses/${courseId}/visual-module?moduleId=${encodeURIComponent(moduleId)}`),data=await response.json();
      if(!response.ok)throw Error(data.error?.message??'Could not read current approved sources.');
      const url=URL.createObjectURL(new Blob([JSON.stringify({prompt,...data},null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`${moduleId}-codex-video-handoff.json`;link.click();URL.revokeObjectURL(url);setNotice('Downloaded the current approved SME context and visual contract.');
    }catch(error){setNotice(error instanceof Error?error.message:'Could not prepare the handoff.');}
  }
  return <section aria-label="Remotion video production" className="space-y-4 rounded-xl border border-line bg-panel p-5">
    <div className="space-y-2"><p className="text-sm text-brand-ink">Stage 4 · Approved SME draft → Remotion</p><h2 className="text-xl font-semibold">Create the problem hook and concept videos</h2><p className="text-sm text-ink-muted">Use the saved module sources to create editable scripts, animated document and workflow demonstrations, and synchronized narration. Each topic has its own video. The reference style uses a dark rose background, varied compositions and deliberate reading pauses.</p></div>
    {targets.length?<div className="grid gap-3 md:grid-cols-2">{targets.map(t=><article key={t.videoId} className="space-y-2 rounded-lg border border-line p-4"><p className="text-xs text-brand-ink">{t.kind==='hook'?'Problem hook':'Concept video'}</p><h3 className="font-medium">{t.title}</h3><Button asChild variant="outline"><Link href={`/content/courses/${courseId}/visual-lessons?videoId=${encodeURIComponent(t.videoId)}`}>Open script and video</Link></Button></article>)}</div>:<p className="text-sm">Add module hook text and topic teaching sources, then approve the current blueprint in Stage 3.</p>}
    <details className="space-y-3 rounded-lg border border-line p-4"><summary className="cursor-pointer font-medium">Create with Codex through MCP</summary><p className="text-sm text-ink-muted">Connect Codex to the existing course-authoring MCP, then use this prompt. The app provides approved sources and validates saved storyboards; it does not silently launch or sign in to a Codex session.</p><pre className="whitespace-pre-wrap rounded-lg bg-panel-2 p-3 text-xs">{prompt}</pre><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={()=>void navigator.clipboard.writeText(prompt).then(()=>setNotice('Codex prompt copied.')).catch(()=>setNotice('Select and copy the prompt above.'))}>Copy Codex prompt</Button><Button variant="outline" onClick={()=>void handoff()}>Download SME handoff</Button><Button variant="outline" asChild><Link href="/content/mcp">Connect Codex</Link></Button></div></details>
    <p role="status" className="text-sm text-brand-ink">{notice}</p>
  </section>;
}
