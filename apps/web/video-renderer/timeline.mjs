// Render only motion windows; extend the final still frame through narrated
// holds. This preserves frame-based timing without capturing identical frames.
export function motionWindows(chapter, start, end, fps) {
  const ranges=chapter.cues.map(c=>({start:Math.max(start,Math.floor(c.seconds*fps)),end:Math.min(end,Math.ceil((c.seconds+(c.action==='reveal'?1.8:3.6))*fps))})).filter(r=>r.start<r.end);
  if(!ranges.length)return [{start,end:Math.min(end,start+1),holdUntil:end}];
  ranges[0].start=start;
  const merged=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});}
  return merged.map((r,i)=>({...r,holdUntil:merged[i+1]?.start??end}));
}
