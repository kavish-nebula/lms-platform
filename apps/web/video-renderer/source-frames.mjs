import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// Only timed captions from the local speech aligner schedule source cutaways.
// A missing alignment leaves the underlying personalized animation visible.
export function sourceFrameWindows(scenes, segments, captions) {
  const windows = [];
  for (const scene of scenes) {
    const segment = segments.find(s => s.sceneId === scene.id);
    if (!segment) continue;
    for (const visual of scene.selectedVisuals ?? []) {
      const caption = captions.find(c => c.start >= segment.startSeconds && c.start < segment.endSeconds && c.caption === visual.sentence);
      if (!caption) continue;
      const end = Math.min(caption.end, segment.endSeconds);
      if (end - caption.start >= 1) windows.push({visual, start:caption.start, end});
    }
  }
  return windows;
}

export async function sourceFrameInputs(directory, windows) {
  if (!windows.length) return {inputs:[], filters:[], stream:'0:v:0'};
  const inputs = [], filters = [];
  let previous = '0:v';
  for (const [i, {visual,start,end}] of windows.entries()) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(visual.image);
    if (!match || match[1].length > 350000) throw Error('Invalid reviewed source frame.');
    const file = path.join(directory, `source-frame-${i}.jpg`);
    await fs.writeFile(file,Buffer.from(match[1],'base64'));
    inputs.push('-i',file);
    // Inputs 0 and 1 are always the silent animation and personalized audio.
    filters.push(`[${i+2}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[still${i}]`);
    filters.push(`[${previous}][still${i}]overlay=enable='gte(t,${start})*lt(t,${end})'[cut${i}]`);
    previous = 'cut' + i;
  }
  return {inputs, filters:['-filter_complex',filters.join(';')], stream:`[${previous}]`};
}

export async function muxTopicVideo({ffmpeg, silent, audio, windows, duration, directory, output}) {
  const frames = await sourceFrameInputs(directory,windows);
  await exec(ffmpeg,['-v','error','-i',silent,'-i',audio,...frames.inputs,...frames.filters,'-map',frames.stream,'-map','1:a:0',
    ...(windows.length?['-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p']:['-c:v','copy']),
    '-c:a','aac','-b:a','128k','-t',String(duration),'-movflags','+faststart','-y',output],{windowsHide:true,timeout:windows.length?600000:120000});
}
