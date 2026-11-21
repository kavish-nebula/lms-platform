"""Render independently scripted topic films with local WAV narration and FFmpeg."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import wave
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont
from demonstrations import DEMOS, EXTRA_SHOTS, Stage

HERE = Path(__file__).resolve().parent
W, H, FPS = 960, 540, 24
INK, MUTED, SHEET, LINE = "#f6eee9", "#c1b1b4", "#e9ded2", "#58414b"


@lru_cache
def font(size, family="sans"):
    name = {"sans": "arial.ttf", "bold": "arialbd.ttf", "serif": "georgia.ttf",
            "mono": "consola.ttf"}[family]
    return ImageFont.truetype(name, size)


def ease(x):
    return 1 - (1 - min(1, max(0, x))) ** 3


def text(draw, value, xy, width, size, color=INK, family="sans", height=None):
    face = font(size, family)
    line, lines = "", []
    for word in value.split():
        test = f"{line} {word}".strip()
        if face.getlength(test) > width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    if height and size > 13 and (len(lines)*(size+5)>height or any(face.getlength(s)>width for s in lines)):
        return text(draw, value, xy, width, size-1, color, family, height)
    for i, line in enumerate(lines):
        draw.text((xy[0], xy[1]+i*(size+5)), line, fill=color, font=face)


def item(raw):
    label, sep, value = raw.partition(" › ")
    return (label, value) if sep else ("", raw)


def focus_bounds(layout):
    return (
        min(x for x, _, _, _ in layout),
        min(y for _, y, _, _ in layout),
        max(x + w for x, _, w, _ in layout),
        max(y + h for _, y, _, h in layout),
    )


def paper(raw, width, height, accent, style):
    label, value = item(raw)
    layer = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(layer)
    light = style in {"paper", "receipt", "roll"}
    bg = SHEET if light else "#2b2330"
    fg = "#2a2228" if light else INK
    note = "#594746" if light else MUTED
    draw.rounded_rectangle((0, 0, width - 1, height - 1), 11, fill=bg, outline=LINE, width=1)
    draw.rectangle((1, 13, 4, height - 13), fill=accent)
    if label:
        text(draw, label, (18, 12), width - 36, 15, note, "mono")
    top = 36 if label else 20
    text(draw, value, (18, top), width - 36,
         25 if len(value) < 42 else 20, fg, "bold" if style != "terminal" else "mono", height-top-4)
    return layer


def message(raw, width, height, accent, speaker):
    label, value = item(raw)
    layer = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(layer)
    background = "#4b3044" if speaker % 2 == 0 else "#263630"
    draw.rounded_rectangle((0, 0, width - 1, height - 5), 15, fill=background)
    tail = width - 28 if speaker % 2 == 0 else 15
    draw.polygon([(tail, height-9),(tail+12,height-9),(tail,height-1)],fill=background)
    text(draw,label,(14,8),width-28,13,accent,"bold")
    text(draw,value,(14,28),width-28,19,height=height-34)
    return layer


def backdrop(accent, kind):
    im = Image.new("RGB", (W, H), "#141017")
    draw = ImageDraw.Draw(im)
    # Soft pools of color and a sparse grid give the props a physical space.
    rgb = tuple(bytes.fromhex(accent[1:]))
    cx, cy = (610, 225) if kind in {"phone", "split", "map"} else (455, 280)
    for radius in range(640, 6, -7):
        amount = .16 * (1 - radius / 660) ** 2
        color = tuple(round(base + (target - base) * amount) for base, target in zip((18, 15, 23), rgb))
        draw.ellipse((cx-radius, cy-radius//2, cx+radius, cy+radius//2), fill=color)
    for x in range(32, W, 34):
        for y in range(106, 474, 34):
            draw.point((x, y), fill="#69535f")
    return im


def layout(kind, count):
    n = max(1, count)
    if kind == "phone":
        return [(594 + (i%2)*26, 128 + i*96, 228, 82) for i in range(count)]
    if kind == "document":
        return [(391, 143+i*92, 421, 79) for i in range(count)]
    if kind in {"terminal", "inbox", "search", "receipt", "roll", "clock"}:
        return [(314, 128 + i*97, 533, 82) for i in range(count)]
    if kind in {"pinboard", "desk", "grid", "dashboard", "vault"}:
        return [(308+(i%2)*272, 148+(i//2)*129, 249, 103) for i in range(count)]
    if kind in {"fork", "tree", "gate"}:
        return [(295, 222, 185, 104)] + [(630, 146 + j*145, 247, 103) for j in range(count-1)]
    if kind in {"blueprint", "orbit"}:
        return [(x, y, 193, 116) for x,y in [(304,175), (543,111), (671,310)][:count]]
    if kind == "map":
        return [(304 + i*290, 302-i*160, 244, 92) for i in range(count)]
    if kind == "calculator":
        return [(468,125+i*87,332,66) for i in range(count)]
    width = 178 if n == 3 else 256
    return [(290+i*(width+22), 212+(i%2)*37, width, 115) for i in range(count)]


class Shot:
    def __init__(self, topic, shot, index):
        self.topic, self.shot, self.index = topic, shot, index
        self.kind, self.action = shot["kind"], shot["action"]
        self.accent = "#" + topic["color"]
        self.background = backdrop(self.accent, self.kind)
        self.base = self.background.copy()
        draw = ImageDraw.Draw(self.base)
        self.boxes = layout(self.kind, len(shot["props"]))
        self.decorate(draw)
        if topic["id"] == "m1-1" and index == 0:
            self.storefront(draw)
        style = {"document":"paper", "desk":"paper", "pinboard":"paper", "map":"paper",
                 "receipt":"receipt", "roll":"roll", "terminal":"terminal"}.get(self.kind, "")
        self.cards = [
            message(raw,w,h,self.accent,i) if self.kind=="phone" else paper(raw,w,h,self.accent,style)
            for i,(raw, (_,_,w,h)) in enumerate(zip(shot["props"], self.boxes))
        ]

    def decorate(self, draw):
        k = self.kind
        if k == "phone":
            draw.rounded_rectangle((571, 82, 877, 446), 26, fill="#14121a", outline="#72545e", width=2)
            draw.rounded_rectangle((669, 91, 780, 99), 4, fill=LINE)
            draw.line((689, 430, 760, 430), fill=LINE, width=3)
        elif k in {"terminal", "inbox", "search"}:
            draw.rounded_rectangle((291, 97, 873, 426), 14, fill="#191923", outline=LINE)
            for i, color in enumerate((self.accent, "#dfbb88", "#7fae9a")):
                draw.ellipse((310+i*16, 110, 318+i*16, 118), fill=color)
            draw.line((292, 123, 872, 123), fill=LINE)
        elif k == "document":
            draw.rounded_rectangle((371,110,832,426),8,fill="#e0d1c9",outline="#a99496")
            draw.rectangle((389,126,814,131),fill=self.accent)
            for x in (352,851):
                draw.line((x,121,x,412),fill="#977681",width=1)
        elif k in {"receipt", "roll", "desk", "pinboard"}:
            for i in range(3):
                draw.rounded_rectangle((290+i*9, 111+i*9, 867+i*7, 414+i*7), 7, fill="#382e36", outline="#6c5259")
            draw.line((305, 398, 860, 398), fill=LINE, width=2)
        elif k in {"blueprint","map","orbit","tree","fork","relay","flow","gate","timeline"}:
            draw.rounded_rectangle((281, 94, 898, 429), 12, outline=LINE)
            if k in {"map","blueprint"}:
                for i in range(11):
                    x = 301 + i*52
                    draw.line((x, 96, x, 422), fill="#352833")
                for i in range(7):
                    draw.line((286, 107+i*48, 892, 107+i*48), fill="#352833")
            if k == "gate":
                for x in range(503, 612, 12):
                    draw.line((x, 120, x+24, 395), fill=LINE, width=2)
            if k == "map":
                draw.line([(284,198),(403,159),(482,223),(672,261),(790,282),(895,359)],fill="#31505d",width=17,joint="curve")
                draw.line([(301,308),(490,308),(490,237),(713,237),(713,115)],fill="#604e44",width=9,joint="curve")
                for name,xy in [("Orbit dispatch",(307,276)),("Carrier network",(639,275))]:
                    text(draw,name,xy,185,16,MUTED,"mono")
        elif k in {"clock", "calculator", "dashboard", "grid", "vault", "tokens"}:
            draw.rounded_rectangle((284, 103, 894, 431), 14, fill="#201c28", outline=LINE)
            if k == "calculator":
                for i,key in enumerate("123456789×0="):
                    x,y=557+(i%3)*77,306+(i//3)*27
                    draw.rounded_rectangle((x,y,x+58,y+23),4,fill="#58414b")
                    text(draw,key,(x+22,y+2),30,15)
            if k == "vault":
                for i in range(3):
                    x=304+i*187
                    draw.rounded_rectangle((x,126,x+173,408),6,fill="#302936",outline=LINE)
                    draw.rounded_rectangle((x+55,350,x+116,365),7,fill="#725c6b")
            if k == "clock":
                draw.line((331,402,839,402),fill=LINE,width=3)
                for x in range(331, 840, 28):
                    draw.line((x,397,x,407),fill=MUTED,width=1)

    def storefront(self, draw):
        # Use the course's tent as a visual callback to the module's problem hook.
        draw.rounded_rectangle((306, 143, 555, 375), 10, fill="#4a344d", outline=LINE)
        draw.ellipse((471, 174, 516, 219), fill="#e2ab82")
        draw.polygon([(307,304),(374,224),(431,286),(491,227),(554,316),(554,362),(307,362)],fill="#292438")
        draw.polygon([(307,331),(379,284),(425,321),(508,278),(554,319),(554,375),(307,375)],fill="#191b2a")
        draw.polygon([(374,337),(423,267),(475,337)],fill="#68a895")
        draw.polygon([(423,267),(442,337),(409,337)],fill="#254d50")
        text(draw,"Trailhead 2P tent",(325,345),200,16,INK,"bold")

    def frame(self, t, duration):
        demonstration = (DEMOS.get(self.topic["id"]) if self.index == 1 else
                         EXTRA_SHOTS.get((self.topic["id"], self.index)))
        if demonstration:
            image = self.background.copy()
            stage = Stage(image, self.accent, font, t / duration)
            demonstration(stage)
            if t < .18:
                image = Image.blend(self.background, image, ease(t/.18))
            return image
        image = self.base.copy()
        draw = ImageDraw.Draw(image)
        p = t / duration
        count = len(self.cards)
        reveal_at = {
            ("m1-1", 0): [.02,.33,.72],
            ("m1-1", 1): [.04,.45,.73],
            ("m1-1", 2): [.07,.27],
            ("m4-3", 1): [.11,.26,.66],
            ("m6-2", 0): [.05,.28,.52],
        }.get((self.topic["id"],self.index), [.06 + i*.24 for i in range(count)])
        reveals = [ease((p-start)/.12) for start in reveal_at]
        if self.kind in {"blueprint","map","orbit","tree","fork","relay","flow","gate","timeline","split"}:
            for i in range(1,count):
                start = self.boxes[0 if self.kind in {"tree","fork","gate"} else i-1]
                end = self.boxes[i]
                points = [(start[0]+start[2]//2,start[1]+start[3]//2), (end[0]+end[2]//2,end[1]+end[3]//2)]
                draw.line(points, fill=LINE, width=3)
                f = ease((p - max(0,reveal_at[i]-.17)) / .17)
                if f > 0:
                    x, y = (a+(b-a)*f for a,b in zip(*points))
                    draw.line((points[0],(x,y)), fill=self.accent, width=3)
                    draw.ellipse((x-5,y-5,x+5,y+5), fill=self.accent)
        if self.kind == "clock":
            x=331+round(508*ease(p))
            draw.ellipse((x-9,393,x+9,411),fill=self.accent)
        if self.kind == "gate":
            # The request can reach the boundary while its permission is evaluated.
            x = 496 + 78 * ease((p-.22)/.24)
            draw.line((476,272,x,272),fill=self.accent,width=4)
            draw.ellipse((x-7,265,x+7,279),fill=self.accent)
        if self.kind == "dashboard":
            for i, raw in enumerate(self.shot["props"]):
                score = re.search(r"(\d+)\s*/\s*(\d+)", raw)
                if score:
                    cells = max(1, int(score[2]))
                    full = round(int(score[1])*reveals[i])
                    x,y,w,h = self.boxes[i]
                    for j in range(cells):
                        a,b=x+(j%30)*8,y+h+5+(j//30)*7
                        draw.rectangle((a,b,a+5,b+4),fill=self.accent if j<full else LINE)
        for i, (card, (x,y,w,h), appear) in enumerate(zip(self.cards,self.boxes,reveals)):
            if appear <= 0:
                continue
            if self.action in {"write","draw","scan","trim","inspect"}:
                visible = max(1, round(w * appear))
                clipped = card.crop((0,0,visible,h))
                image.paste(clipped,(x,y),clipped)
                if appear < 1 and self.action in {"write","scan","inspect"}:
                    draw.line((x+visible,y+5,x+visible,y+h-5),fill=self.accent,width=2)
            else:
                offset = round((1-appear)*64)
                dx, dy = (offset,0) if self.action in {"send","transfer","route","branch","return"} else (0,offset)
                image.paste(card,(x+dx,y+dy),card)
            if self.action in {"stop","stamp","lock","pin","pulse","replace"} and appear > .92 and i == count-1:
                draw.rounded_rectangle((x-4,y-4,x+w+4,y+h+4), 13, outline=self.accent, width=2)
            if self.kind == "document" and appear > .9:
                # Move from reading the page to seeing the evidence in context.
                edge = x+w
                length = round(27*ease((p-reveal_at[i]-.10)/.12))
                draw.line((edge,y+h//2,edge+length,y+h//2),fill=self.accent,width=2)
                draw.ellipse((edge+length-3,y+h//2-3,edge+length+3,y+h//2+3),fill=self.accent)
        # Evidence shots move towards the work surface, then hold through the
        # final narration clause. Other sets retain their establishing framing.
        inspect = self.action in {"inspect","scan"}
        zoom = 1 + (.055 if inspect else .040) * ease(p/(.51 if inspect else .84))
        crop_w, crop_h = round(W/zoom), round(H/zoom)
        if inspect:
            x0,y0,x1,y1 = focus_bounds(self.boxes)
            left = max(0,min(W-crop_w,round((x0+x1)/2-crop_w/2)))
            top = max(0,min(H-crop_h,round((y0+y1)/2-crop_h/2)))
        else:
            left, top = (W-crop_w)//2, (H-crop_h)//2
        image = image.crop((left,top,left+crop_w,top+crop_h)).resize((W,H), Image.Resampling.BILINEAR)
        shift = 180 if self.kind == "phone" else 112
        if self.topic["id"] == "m1-1" and self.index == 0:
            shift = 98
        stage = self.background.copy()
        stage.paste(image.crop((0,0,W,464)),(-shift,0))
        image = stage
        opacity = min(1,t/.25) if self.index else min(1,.45+t/.3)
        if opacity < 1:
            image = Image.blend(Image.new("RGB",(W,H),"#141017"),image,opacity)
        return image


def stamp(seconds):
    ms = round(seconds * 1000)
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02}.{ms:03}"


def run(topic, args):
    destination = args.output
    output = destination / (topic["id"] + ".mp4")
    captions = destination / (topic["id"] + ".vtt")
    with tempfile.TemporaryDirectory(prefix="nebula-film-") as folder:
        tmp = Path(folder)
        cue_lines = ["WEBVTT", ""]
        offset = 0
        parts = []
        timeline = []
        for i in range(len(topic["shots"])):
            audio = args.audio / f'{topic["id"]}-{i}.wav'
            with wave.open(str(audio)) as speech:
                seconds = speech.getnframes() / speech.getframerate()
            frames = math.ceil((seconds + .22)*FPS)
            timeline.append((audio, seconds, frames))
        for i, (scene, (audio, seconds, frames)) in enumerate(zip(topic["shots"], timeline)):
            path = tmp / f"{i}.mp4"
            parts.append(f"file '{path.as_posix()}'")
            shot = Shot(topic, scene, i)
            cmd = [args.ffmpeg, "-v","error","-y","-f","rawvideo","-pixel_format","rgb24",
                   "-video_size",f"{W}x{H}","-framerate",str(FPS),"-i","-","-i",str(audio),
                   "-af","apad=pad_dur=0.3","-shortest","-c:v","libx264","-threads","2",
                   "-preset","ultrafast","-crf","22","-pix_fmt","yuv420p","-c:a","aac",
                   "-ar","48000","-ac","2",str(path)]
            with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
                for frame in range(frames):
                    proc.stdin.write(shot.frame(frame/FPS,frames/FPS).tobytes())
                proc.stdin.close()
                if proc.wait() != 0:
                    raise RuntimeError(path)
            sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", scene["voice"])
            chars = sum(map(len, sentences))
            pos = offset
            for sentence in sentences:
                end = pos + seconds*len(sentence)/chars
                cue_lines += [f"{stamp(pos)} --> {stamp(end)}", sentence, ""]
                pos = end
            offset += frames/FPS
        playlist = tmp/"shots.txt"
        playlist.write_text("\n".join(parts)+"\n",encoding="utf-8")
        final = tmp/"finished.mp4"
        subprocess.run([args.ffmpeg,"-v","error","-y","-f","concat","-safe","0","-i",
                        str(playlist),"-c","copy","-movflags","+faststart",str(final)],check=True)
        shutil.copyfile(final,output)
        captions.write_text("\n".join(cue_lines),encoding="utf-8")
    print(topic["id"], f"{offset:.1f}s", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--ffmpeg",default="ffmpeg")
    parser.add_argument("--jobs",type=int,default=2)
    parser.add_argument("topics",nargs="*")
    args = parser.parse_args()
    topics = json.loads((HERE/"storyboards.json").read_text(encoding="utf-8"))
    selected = [topic for topic in topics if not args.topics or topic["id"] in args.topics]
    args.output.mkdir(parents=True,exist_ok=True)
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        list(pool.map(lambda topic: run(topic,args),selected))


if __name__ == "__main__":
    main()
