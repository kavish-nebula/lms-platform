/** Presentation-only opt-in: other courses keep their existing scene player. */
export const continuousConceptEnabled = (courseId: string) => courseId === 'affcb1b6-5539-431c-9a95-cce2bdb26b51';
export type ContinuousPlayback = { kind: 'continuous'; audio: string; durationSeconds: number; checkpointSeconds: number | null; segments: { sceneId: string; startSeconds: number; endSeconds: number }[] };
export type PlayedRange = [number, number];
export type ContinuousResume = { version: 2; seconds: number; checkpointDone: boolean; ranges: PlayedRange[]; endCheckDone: boolean };
export const conceptClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function continuousSection(playback: ContinuousPlayback, time: number) {
  const index = playback.segments.findIndex(s => time < s.endSeconds);
  return index < 0 ? playback.segments.length - 1 : index;
}
export function allowedConceptTime(playback: ContinuousPlayback, time: number, checkpointDone: boolean) {
  return Math.max(0, Math.min(Number.isFinite(time) ? time : 0, !checkpointDone && playback.checkpointSeconds !== null ? playback.checkpointSeconds : playback.durationSeconds));
}
export function addPlayedRange(ranges: PlayedRange[], start: number, end: number): PlayedRange[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return ranges;
  const sorted = [...ranges, [Math.max(0, start), end] as PlayedRange].sort((a,b) => a[0]-b[0]);
  const merged: PlayedRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1] + .05) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}
export function allConceptSectionsPlayed(playback: ContinuousPlayback, ranges: PlayedRange[]) {
  return playback.segments.every(s => {
    const covered = ranges.reduce((sum,r) => sum + Math.max(0, Math.min(r[1],s.endSeconds)-Math.max(r[0],s.startSeconds)),0);
    return covered >= s.endSeconds-s.startSeconds-Math.min(.45,(s.endSeconds-s.startSeconds)*.03);
  });
}
export function restoreContinuousResume(saved: unknown, legacy: unknown, playback: ContinuousPlayback, hasCheckpoint: boolean): ContinuousResume {
  const value = saved as Partial<ContinuousResume> | null;
  if (value?.version === 2) {
    const checkpointDone = !hasCheckpoint || value.checkpointDone === true;
    let ranges: PlayedRange[] = [];
    for (const range of Array.isArray(value.ranges) ? value.ranges : []) if (Array.isArray(range) && range.length === 2 && range.every(Number.isFinite)) ranges = addPlayedRange(ranges, allowedConceptTime(playback,range[0],checkpointDone), allowedConceptTime(playback,range[1],checkpointDone));
    return { version:2, seconds:allowedConceptTime(playback,Number(value.seconds),checkpointDone),checkpointDone,ranges,endCheckDone:value.endCheckDone === true && checkpointDone && allConceptSectionsPlayed(playback,ranges) };
  }
  const old = legacy as { version?: number; scene?: number; checkpointDone?: boolean; seen?: number[] } | null;
  const checkpointDone = !hasCheckpoint || old?.version === 1 && old.checkpointDone === true;
  const seconds = old?.version === 1 ? playback.segments[old.scene ?? -1]?.startSeconds ?? 0 : 0;
  let ranges: PlayedRange[] = [];
  for (const index of old?.version === 1 && Array.isArray(old.seen) ? old.seen : []) {
    const segment = Number.isInteger(index) ? playback.segments[index] : undefined;
    if (segment && (checkpointDone || playback.checkpointSeconds === null || segment.endSeconds <= playback.checkpointSeconds)) ranges = addPlayedRange(ranges,segment.startSeconds,segment.endSeconds);
  }
  return {version:2,seconds:allowedConceptTime(playback,seconds,checkpointDone),checkpointDone,ranges,endCheckDone:false};
}
