import { z } from 'zod/v4';

export const UploadedConceptVideo = z.object({ assetId: z.uuid(), transcriptId: z.uuid(), durationSeconds: z.number().positive().max(420), checkpointSeconds: z.number().positive().max(419.9) }).strict();
export const TranscriptCue = z.object({ start: z.number().nonnegative(), end: z.number().positive(), text: z.string().trim().min(1).max(3000) }).strict();
export type TranscriptCueData = z.infer<typeof TranscriptCue>;
const stamp = (seconds: number) => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
export function transcriptVtt(cues: TranscriptCueData[]) {
  return `WEBVTT\n\n${cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text.replaceAll('-->', '→')}\n`).join('\n')}`;
}
export function parseTranscriptVtt(value: string, duration: number) {
  const time = (s: string) => s.replace(',', '.').split(':').reduce((n, part) => n * 60 + Number(part), 0);
  const cues: TranscriptCueData[] = [];
  for (const block of value.replace(/^\uFEFF/, '').replaceAll('\r', '').trim().split(/\n\s*\n/)) {
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(block.trim())) continue;
    const lines = block.split('\n'); const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0) throw new Error('Use WebVTT cues with start --> end timestamps.');
    const match = lines[index].match(/^(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})\s+-->\s+(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})(?:\s+.*)?$/);
    if (!match) throw new Error('Use timestamps such as 00:00:00.000 --> 00:00:10.000.');
    const cue = TranscriptCue.parse({ start: time(match[1]), end: time(match[2]), text: lines.slice(index + 1).join(' ').trim() });
    if (cue.end <= cue.start || cue.end > duration + 0.25 || cue.start < (cues.at(-1)?.end ?? 0)) throw new Error('Transcript cues must be ordered, non-overlapping and within the video duration.');
    cues.push(cue);
  }
  if (cues.length < 2 || cues.length > 500 || cues.map(c => c.text).join(' ').length > 100000) throw new Error('Supply 2–500 timestamped transcript cues, up to 100,000 characters.');
  const boundaries = cues.map(c => c.end).filter(end => end >= duration * 0.3 && end <= duration * 0.7);
  if (!boundaries.length) throw new Error('Add a cue boundary between 30% and 70% of the video for its midpoint questions.');
  const checkpointSeconds = boundaries.sort((a, b) => Math.abs(a - duration / 2) - Math.abs(b - duration / 2))[0];
  if (!cues.some(c => c.end > checkpointSeconds)) throw new Error('Include transcript cues before and after the midpoint.');
  return { cues, checkpointSeconds, text: cues.map(c => c.text).join('\n\n') };
}
