import type { ModuleContent } from '@/data/types';

export type VideoHook = NonNullable<ModuleContent['videoFirstActivities']>['problemHook'];
export type HookScene = { id: string; kind: 'case' | 'source' | 'question'; title: string; text: string; start: number; end: number };

/** The same exact words drive the visuals and speech; no answer is introduced. */
export function hookScenes(hook: VideoHook): HookScene[] {
  const chunks = hook.situation.split(/\n+/).map(s => s.trim()).filter(Boolean).flatMap(paragraph => {
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z“"'])/);
    const parts: string[] = [];
    for (const sentence of sentences) {
      const text = sentence.trim();
      if (parts.length && `${parts.at(-1)} ${text}`.split(/\s+/).length <= 55) parts[parts.length - 1] += ` ${text}`;
      else parts.push(text);
    }
    return parts;
  });
  const lines = [...chunks, hook.question];
  const total = lines.reduce((n, text) => n + text.split(/\s+/).length, 0);
  let words = 0;
  return lines.map((text, i) => {
    const start = words / total; words += text.split(/\s+/).length;
    const kind = i === lines.length - 1 ? 'question' : /^DOC[-\s]/i.test(text) ? 'source' : 'case';
    return { id: `scene-${i}`, kind, title: kind === 'question' ? 'Your decision' : kind === 'source' ? 'Inspect the source' : i === 0 ? 'The situation' : 'Look closer', text, start, end: words / total };
  });
}

export const hookNarration = (hook: VideoHook) => hookScenes(hook).map(s => s.text).join(' ');
/** Proportional scene timing uses actual clip duration, not invented word timestamps. */
export function hookSceneAt(scenes: HookScene[], fraction: number) {
  // Seeking a media element can round down slightly at a scene boundary.
  const index = scenes.findIndex(s => fraction + 0.000001 < s.end);
  return index === -1 ? Math.max(0, scenes.length - 1) : index;
}
