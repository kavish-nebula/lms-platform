"""Compose the edited sequence and its illustrated concept opening."""
from PIL import Image, ImageDraw

from graphics import CABINET, label
from render import Shot, FPS, INK, LINE, backdrop, ease
from source_art import SourceArt
from workbench import Workbench


class LessonArt:
    def __init__(self,film,case,scene):
        self.scene=scene
        self.accent="#"+film["color"]
        self.base=backdrop(self.accent,"document")
        kind=scene["type"]
        if kind=="example":
            i=scene["caseIndex"]
            self.shot=Shot(case,case["shots"][i],i)
        elif kind=="source":
            self.art=SourceArt(scene["visual"],self.accent)
        elif kind=="workbench":
            self.art=Workbench(scene,self.accent)
        elif kind=="concept":
            self.shots={i:Shot(case,case["shots"][i],i) for i in scene["opening"]["shots"]}

    def frame(self,frame,count,cue,since):
        kind=self.scene["type"]
        if kind=="example":
            image = self.shot.frame(frame/FPS,count/FPS)
            track = self.scene.get("inspection")
            if track:
                # Close in on the field being read, then follow the next piece of evidence.
                progress = frame/max(1,count-1)
                pos = progress*(len(track)-1)
                i = min(int(pos),len(track)-2)
                mix = pos-i
                mix = mix*mix*(3-2*mix)
                x,y = (a+(b-a)*mix for a,b in zip(track[i],track[i+1]))
                zoom = 1+.13*ease(progress/.30)
                w,h = image.size
                left,top = x*(1-1/zoom),y*(1-1/zoom)
                image=image.resize((w,h),Image.Resampling.BILINEAR,
                                   (left,top,left+w/zoom,top+h/zoom))
            return image
        image=self.base.copy()
        if kind!="concept":
            return self.art.paint(image,cue,since)
        return self.opening(image,cue,since)

    def opening(self,image,cue,since):
        cards=self.scene["cards"]
        i=max(j for j,card in enumerate(cards) if card["cue"]<=cue)
        end=cards[i+1]["cue"] if i+1<len(cards) else len(self.scene["lines"])
        openness=(cue-cards[i]["cue"]+ease(since/34))/(end-cards[i]["cue"])
        scene=self.scene["opening"]
        shot=self.shots[scene["shots"][i]]
        # Show a small piece of the real mechanism while the learner hears its
        # name. The worked example later reveals the complete operation.
        pose=.12+.76*openness
        artwork=shot.frame(pose*10,10)
        layout=scene["layout"]
        card=cards[i]
        if layout=="wide":
            box=(165,76,795,330)
            tx,ty,tw=106,345,744
        elif layout=="folio":
            box=(81,88,606,421)
            tx,ty,tw=633,145,272
        elif layout=="reverse":
            box=(64,108,557,400)
            tx,ty,tw=592,152,299
        else:
            box=(407,100,899,411)
            tx,ty,tw=70,146,306
        width,height=box[2]-box[0],box[3]-box[1]
        # Preserve aspect ratios and avoid chopping off either end of a diagram.
        region=artwork.crop((43,66,917,454))
        region.thumbnail((width-12,height-12),Image.Resampling.LANCZOS)
        panel=ImageDraw.Draw(image)
        panel.rounded_rectangle(box,15,fill=CABINET,outline=LINE,width=2)
        image.paste(region,(box[0]+(width-region.width)//2,box[1]+(height-region.height)//2))
        if layout=="wide":
            label(panel,(tx,ty),card["term"],tw,54,38,"bold",self.accent)
            label(panel,(tx,ty+54),card["meaning"],tw,54,27,"sans",INK)
        else:
            label(panel,(tx,ty),card["term"],tw,104,40,"bold",self.accent)
            label(panel,(tx,ty+118),card["meaning"],tw,132,28,"sans",INK)
        return image
