"""Render course explanations and the matching worked demonstrations on one audio clock."""
import argparse
from bisect import bisect_right
from concurrent.futures import ProcessPoolExecutor
from io import BytesIO
import math
from pathlib import Path
import subprocess
import tempfile
import wave
from PIL import Image

from lesson_art import LessonArt
from prepare import HERE, read
from render import FPS, stamp


def narration(film, work, wav_path):
    ends, scenes, captions = [], [], ["WEBVTT", ""]
    samples = 0
    rate = 24000
    with wave.open(str(wav_path),"wb") as track:
        track.setparams((1,2,rate,0,"NONE","not compressed"))
        for i, scene in enumerate(film["scenes"]):
            cues = []
            for j, line in enumerate(scene["lines"]):
                path = work/"voice"/f"{film['id']}-{i}-{j}.wav"
                with wave.open(str(path)) as voice:
                    if (voice.getnchannels(),voice.getsampwidth(),voice.getframerate()) != (1,2,rate):
                        raise ValueError(f"Unexpected voice format for {path}")
                    length = voice.getnframes()
                    if not length:
                        raise ValueError(f"Empty voice for {path}")
                    track.writeframesraw(voice.readframes(length))
                start, end = samples/rate, (samples+length)/rate
                captions.extend([f"{stamp(start)} --> {stamp(end)}",line,""])
                cues.append(round(start*FPS))
                samples += length
            scenes.append(cues)
            ends.append(round(samples*FPS/rate))
    duration = samples/rate
    # Allow the denser lessons a little more time for spoken questions and scene breaks.
    if not 180 <= duration <= 260:
        raise ValueError(f"{film['id']} has {duration:.2f} seconds of spoken teaching")
    return scenes, ends, "\n".join(captions), duration


def render_one(task):
    film, case, work, output = task
    with tempfile.TemporaryDirectory(prefix="topic-",dir=output) as folder:
        tmp = Path(folder)
        cues, ends, captions, duration = narration(film,work,tmp/"voice.wav")
        frames = math.ceil(duration*FPS)
        ends[-1] = frames
        cmd = ["ffmpeg","-loglevel","error","-y","-threads","1","-f","image2pipe",
               "-framerate",str(FPS),"-vcodec","mjpeg","-i","pipe:0","-i",str(tmp/"voice.wav"),
               "-map","0:v","-map","1:a","-pix_fmt","yuv420p",
               "-c:v","libx264","-threads","2","-preset","veryfast","-crf","21",
               "-c:a","aac","-b:a","96k","-movflags","+faststart"]
        if any(s.get("illustration") for s in film["scenes"]):
            cmd.extend(["-metadata","comment=Twemoji 12 artwork by Twitter, Inc. and other contributors, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Resized and composited. Source: https://github.com/twitter/twemoji/tree/v12.1.6/assets/svg"])
        cmd.append(str(tmp/"lesson.mp4"))
        with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
            try:
                previous = None
                for i, scene in enumerate(film["scenes"]):
                    art = LessonArt(film,case,scene)
                    first = cues[i][0]
                    last_key = None
                    for frame in range(first,ends[i]):
                        cue = bisect_right(cues[i],frame)-1
                        since = frame-cues[i][cue]
                        local = frame-first
                        key = local if scene["type"] == "example" else (cue,min(34,since))
                        if key != last_key:
                            image = art.frame(local,ends[i]-first,cue,since)
                            if previous is not None and local < 12:
                                mix = (local+1)/12
                                mix = mix*mix*(3-2*mix)
                                if scene["type"] == "workbench":
                                    edge = round(image.width*mix)
                                    mixed = previous.copy()
                                    mixed.paste(image.crop((0,0,edge,image.height)),(0,0))
                                    image = mixed
                                else:
                                    image = Image.blend(previous,image,mix)
                            buffer=BytesIO()
                            image.save(buffer,format="JPEG",quality=93,subsampling=0)
                            data=buffer.getvalue()
                            last_key=key
                        proc.stdin.write(data)
                    previous = image
            finally:
                proc.stdin.close()
            if proc.wait()!=0:
                raise RuntimeError(f"FFmpeg failed for {film['id']}")
        (tmp/"lesson.vtt").write_text(captions,encoding="utf-8")
        for suffix in ("mp4","vtt"):
            (tmp/f"lesson.{suffix}").replace(output/f"{film['id']}.{suffix}")
    print(f"{film['id']}  {duration:.2f}s",flush=True)


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("work",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--jobs",type=int,default=3)
    parser.add_argument("--topics",nargs="+")
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    cases={c["id"]:c for c in read(HERE/"storyboards.json")}
    films=read(args.work/"scripts.json")
    jobs=[(f,cases[f["id"]],args.work,args.output) for f in films if not args.topics or f["id"] in args.topics]
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        list(pool.map(render_one,jobs))
