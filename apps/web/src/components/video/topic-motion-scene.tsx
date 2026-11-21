import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import type {VisualTimedScene} from '../../lib/visual-lesson';

type ObjectTrack = NonNullable<VisualTimedScene['motion']>[number];
const colors = { paper:'#fcf5f5', rose:'#eda3b7', mint:'#80d9bf', amber:'#f1cc8d', muted:'#beacb4' };

function poseAt(track: ObjectTrack, scene: VisualTimedScene, frame: number) {
  function time(key: ObjectTrack['keys'][number]) {
    const beat = scene.beats[key.beat];
    return beat.from + key.at * Math.max(0, beat.durationInFrames - 1);
  }
  const next = track.keys.findIndex(key => time(key) > frame);
  if (next === 0) return null;
  if (next === -1) return track.keys[track.keys.length - 1];
  const a = track.keys[next - 1], b = track.keys[next];
  const t = (frame - time(a)) / (time(b) - time(a));
  const smooth = t * t * (3 - 2 * t);
  const mix = (start: number, end: number) => start + (end - start) * smooth;
  return {x:mix(a.x,b.x), y:mix(a.y,b.y), scale:mix(a.scale,b.scale),
    angle:mix(a.angle,b.angle), opacity:mix(a.opacity,b.opacity)};
}

export function TopicMotionScene({scene, captions, reducedMotion}: {
  scene: VisualTimedScene; captions: boolean; reducedMotion: boolean;
}) {
  const frame = scene.from + useCurrentFrame();
  const beat = scene.beats.find(b => frame < b.from + b.durationInFrames) ?? scene.beats[scene.beats.length - 1];
  const poseFrame = reducedMotion ? beat.from + beat.durationInFrames - 1 : frame;
  return <AbsoluteFill style={{background:'#110d12', color:colors.paper, fontFamily:'Arial, sans-serif'}}>
    <Img src={staticFile('video-style/reference-ambient.jpg')} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',opacity:.4}}/>
    <svg viewBox="0 0 1000 360" role="img" aria-label={scene.title}
      style={{position:'absolute',left:72,top:72,width:1136,height:444,overflow:'hidden'}}>
      {scene.motion?.map((track, index) => {
        const p = poseAt(track, scene, poseFrame);
        if (!p) return null;
        const ink = colors[track.tone];
        return <g key={index} opacity={p.opacity} transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.scale})`}>
          {track.path && <path d={track.path} stroke={ink} strokeWidth={3} fill={track.filled ? ink : 'none'} strokeLinejoin="round" strokeLinecap="round"/>}
          {track.label && <text textAnchor="middle" dominantBaseline="central" y={track.path ? 32 : 0}
            fill={ink} stroke="#181319" strokeWidth={3} paintOrder="stroke" fontSize={23}>{track.label}</text>}
        </g>;
      })}
    </svg>
    {captions && <div data-caption={beat.id} style={{position:'absolute',left:80,right:80,bottom:35,
      padding:'12px 20px',borderRadius:12,textAlign:'center',fontSize:24,lineHeight:1.38,background:'#0b080bd9'}}>{beat.narration}</div>}
  </AbsoluteFill>;
}
