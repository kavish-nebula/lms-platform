import React from 'react';
import { interpolate } from 'remotion';
import type { Chapter } from './types';
import { T } from './theme';

export function reveal(chapter: Chapter, time: number, target: string) {
  const explicit = chapter.cues.find(c => c.target === target || c.withTargets?.includes(target));
  // An uncued structural layer belongs to the opening illustration. Hiding it
  // forever leaves disconnected arrows and empty model diagrams. Explicit cues
  // still control later reveals; optional conclusions are never introduced here.
  const cue = explicit ?? (['secondary', 'detail'].includes(target)
    ? chapter.cues.find(c => c.target === 'primary') : undefined);
  return cue ? interpolate(time, [cue.seconds, cue.seconds + 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
}
export function emphasis(chapter: Chapter, time: number, target: string) {
  const cue = chapter.cues.filter(c => c.target === target || c.withTargets?.includes(target)).at(-1);
  if (!cue || cue.action === 'reveal') return 0;
  return interpolate(time, [cue.seconds, cue.seconds + 1.2, cue.seconds + 3.5], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
export function Label({ x, y, children, color = T.text, size = 25 }: { x: number; y: number; children: React.ReactNode; color?: string; size?: number }) {
  const lines: string[] = [];
  for (const word of String(children ?? '').split(/\s+/)) {
    if (!lines.length || (lines.at(-1)!.length + word.length + 1) > 25) lines.push(word);
    else lines[lines.length-1] += ' ' + word;
  }
  return <text data-video-label="true" x={x} y={y} textAnchor="middle" fill={color} fontSize={size} fontFamily="Arial">{lines.map((line,i)=><tspan key={i} x={x} y={y+(i-(lines.length-1)/2)*size*1.2}>{line}</tspan>)}</text>;
}
export function Paper({ x, y, scale = 1, highlight = 0 }: { x: number; y: number; scale?: number; highlight?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><rect width="200" height="240" rx="12" fill={T.paper}/><path d="M25 36h105" stroke={T.ink} strokeWidth="9" strokeLinecap="round"/>{[75,110,145,180].map((p,i) => <path key={p} d={`M25 ${p}h${i % 2 ? 125 : 150}`} stroke={T.line} strokeWidth="5" opacity=".42" strokeLinecap="round"/>)}<rect x="16" y="94" width="168" height="30" rx="5" fill={T.amber} opacity={highlight * .55}/></g>;
}
export function PathFlow({ d, progress }: { d: string; progress: number }) {
  return <><path d={d} fill="none" stroke={T.line} strokeWidth="3"/><path d={d} pathLength="1" fill="none" stroke={T.mint} strokeWidth="5" strokeDasharray="1" strokeDashoffset={1-progress}/></>;
}
