/** Match the composition's 1.5-second transition, including its final frame. */
export function visualWindows(props,fps){
  return props.scenes.flatMap(scene=>scene.beats.map((beat,index)=>{
    const until=index===scene.beats.length-1?scene.from+scene.durationInFrames:beat.from+beat.durationInFrames;
    return {beat,start:beat.from,end:scene.motion ? beat.from+beat.durationInFrames : Math.min(beat.from+Math.ceil(fps*(props.style==='classic'||!props.style?1.5:2.4))+1,until),until};
  }));
}
/** Preserve every speech sample, padding only the frame-rounding gap and reading holds. */
export function alignedVisualWav(windows,buffers,fps){
  const parts=[];
  for(const w of windows){
    const key=w.beat.audio.replace(/^asset:/,''),wav=buffers.get(key);
    if(!wav||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Missing PCM narration');
    let pcm,format;
    for(let offset=12;offset+8<=wav.length;){const size=wav.readUInt32LE(offset+4),tag=wav.toString('ascii',offset,offset+4);if(offset+8+size>wav.length)throw Error('Incomplete PCM');if(tag==='fmt ')format=wav.subarray(offset+8,offset+8+size);if(tag==='data')pcm=wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
    if(!pcm||!format||format.length<16||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==24000||format.readUInt16LE(14)!==16)throw Error('Unsupported PCM');
    const length=(w.until-w.start)*24000/fps*2;
    if(!Number.isInteger(length)||pcm.length>length)throw Error('Speech does not fit the measured timeline');
    parts.push(pcm,Buffer.alloc(length-pcm.length));
  }
  const pcm=Buffer.concat(parts),header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
