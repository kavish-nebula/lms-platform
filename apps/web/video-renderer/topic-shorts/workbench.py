"""Animate the physical comparison or instrument specified in a topic's edit."""
from functools import lru_cache
from io import BytesIO
from math import cos, sin, pi
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

from graphics import CABINET, WELL, MINT, PAPER_INK, label, panel
from render import LINE, MUTED, SHEET, INK, ease

ASSETS = Path(__file__).resolve().parents[2] / "public/topic-film"


@lru_cache(maxsize=16)
def illustration(name):
    # The repository already ships these licensed Twemoji SVGs and sharp.
    svg = ASSETS / (name + ".svg")
    js = "require('sharp')(process.argv[1]).resize(72,72).png().toBuffer().then(b=>process.stdout.write(b))"
    data=subprocess.check_output(["node","-e",js,str(svg)],cwd=ASSETS.parents[3])
    return Image.open(BytesIO(data)).convert("RGBA")


def plate(d,x,y,w,h,color):
    panel(d,(x,y,x+w,y+h),color,LINE,7)


def disk(d,x,y,r,fill,outline=None,width=2):
    d.ellipse((x-r,y-r,x+r,y+r),fill=fill,outline=outline,width=width)


def travel(d,points,p,color):
    spans=[((x-u)**2+(y-v)**2)**.5 for (x,y),(u,v) in zip(points,points[1:])]
    distance=min(1,max(0,p))*sum(spans)
    d.line(points,fill=LINE,width=5,joint="curve")
    for a,b,length in zip(points,points[1:],spans):
        f=min(1,distance/length)
        tip=(round(a[0]+(b[0]-a[0])*f),round(a[1]+(b[1]-a[1])*f))
        d.line([a,tip],fill=color,width=4)
        if distance<=length: break
        distance-=length
    disk(d,*tip,8,color)


class Workbench:
    def __init__(self,scene,accent):
        self.scene,self.a=scene,accent
        self.picture=illustration(scene["illustration"]) if scene.get("illustration") else None

    def paint(self,image,cue,since):
        d=ImageDraw.Draw(image)
        beats=self.scene["beats"]
        i=max(j for j,b in enumerate(beats) if b["cue"]<=cue)
        stop=beats[i+1]["cue"] if i+1<len(beats) else len(self.scene["lines"])
        reveal=ease(since/32)
        within=(cue-beats[i]["cue"]+reveal)/(stop-beats[i]["cue"])
        motion=(i+within)/len(beats)
        name=self.scene["stage"]
        getattr(self,name)(d,i,within,motion)
        # Keep the evidence legible when the learner pauses at any point.
        x=550+round((1-reveal)*13) if cue==beats[i]["cue"] else 550
        if self.picture:
            image.paste(self.picture,(x,110),self.picture)
        y=195 if self.picture else 165
        label(d,(x,y),beats[i]["label"],338,76,31,"bold",self.a)
        label(d,(x,y+85),beats[i]["detail"],342,115,31,"serif",INK)
        return image

    def stations(self,d,ys=(389,389)):
        left,right=self.scene["stations"]
        label(d,(77,ys[0]),left,196,61,19,"bold",MUTED)
        label(d,(298,ys[1]),right,201,61,19,"bold",MUTED)

    def mark(self,d,xy,i,width,height=39,color=INK):
        label(d,xy,self.scene["marks"][i],width,height,20,"bold",color)

    def lens(self,d,i,f,p):
        for x in (91,301):
            panel(d,(x,152,x+154,330),SHEET)
            self.mark(d,(x+12,175),0 if x==91 else 1,134,49,PAPER_INK)
            for j in range(3):
                d.line((x+17,244+j*24,x+124-(j%2)*30,244+j*24),fill="#9d8994",width=3)
        if i==2:
            self.mark(d,(310,285),2,138,38,PAPER_INK)
        x=round(150+201*p)
        y=round(203+30*sin(p*pi))
        disk(d,x,y,49,None,self.a,7)
        d.line((x+34,y+36,x+73,y+77),fill=self.a,width=12)
        self.stations(d)

    def switch(self,d,i,f,p):
        stops=[(470,150),(470,241),(470,332)]
        for j,end in enumerate(stops):
            d.line([(92,241),(225,241),end],fill=LINE,width=4)
            disk(d,*end,10,self.a if i==j else WELL,LINE)
            self.mark(d,(288,end[1]-44),j,175,38,self.a if i==j else MUTED)
        travel(d,[(92,241),(225,241),stops[i]],.24+.76*f,self.a)
        self.stations(d)

    def sieve(self,d,i,f,p):
        for j in range(11):
            x=110+(j%6)*56
            y=128+int(j/6)*42+round(f*26)
            if i==0 or j in (1,4,7):
                disk(d,x,y,10,self.a if j in (1,4,7) else LINE)
        d.line([(92,204),(202,291),(276,291),(429,204)],fill=MINT,width=5)
        for j in range(3):
            if i or f>.65:
                disk(d,215+j*23,round(311+f*40),8,self.a)
        self.mark(d,(300,271),i,178,58,self.a)
        self.stations(d)

    def relay(self,d,i,f,p):
        for j,x in enumerate((94,342)):
            panel(d,(x,162,x+121,293),SHEET if j==0 else CABINET)
            if j==0 or i>0:
                self.mark(d,(x+8,184),0 if j==0 else i,106,54,PAPER_INK if j==0 else INK)
            d.line((x+15,258,x+103,258),fill=LINE,width=3)
        travel(d,[(172,308),(172,339),(277,339),(277,221),(341,221)],min(1,p*1.5),self.a)
        self.stations(d)

    def terminal(self,d,i,f,p):
        panel(d,(65,126,486,356),WELL)
        for n,c in enumerate((self.a,MINT,LINE)):disk(d,86+n*19,145,5,c)
        for j in range(i+1):
            y=179+50*j
            d.text((84,y),">",fill=MINT)
            s=self.scene["beats"][j]["detail"]
            visible=s if j<i else s[:max(1,round(len(s)*min(1,f*2)))]
            label(d,(108,y),visible,356,45,20,"mono")
        self.stations(d)

    def press(self,d,i,f,p):
        for j in range(3):
            x=86+123*j
            panel(d,(x,242,x+105,320),SHEET if j<=i else CABINET)
            if j<=i:
                self.mark(d,(x+7,263),j,92,44,PAPER_INK)
        x=138+i*123
        y=154+round(54*sin(f*pi))
        plate(d,x-37,y,74,37,self.a)
        d.line((x,114,x,y),fill=MUTED,width=8)
        self.stations(d)

    def balance(self,d,i,f,p):
        angle=(8 if i==0 else -7 if i==1 else 0)*pi/180
        rise=round(119*sin(angle)*(0.45+.55*f))
        d.polygon([(244,338),(275,235),(306,338)],fill=LINE)
        d.line((122,221-rise,422,221+rise),fill=self.a,width=7)
        for x,y in [(136,221-rise),(408,221+rise)]:
            d.line([(x-50,y+68),(x,y),(x+50,y+68)],fill=MUTED,width=2)
            d.pieslice((x-52,y+45,x+52,y+90),0,180,fill=SHEET)
        self.mark(d,(88,154),0,145,50,MUTED)
        self.mark(d,(339,154),min(2,i),146,50,self.a)
        self.stations(d)

    def proof(self,d,i,f,p):
        panel(d,(111,122,434,352),SHEET)
        for n in range(6):
            x1,y=145,158+28*n
            d.line((x1,y,395-(n%3)*23,y),fill="#9e8995",width=4)
        y=158+i*56
        d.rectangle((135,y-8,406,y+25),fill=SHEET)
        self.mark(d,(145,y-8),i,246,35,PAPER_INK)
        d.line((143,y+22,143+round(217*f),y+22),fill="#af4e50",width=4)
        self.stations(d)

    def gate(self,d,i,f,p):
        panel(d,(82,216,470,294),WELL)
        x=round(105+min(1,(i+f)/1.8)*170)
        plate(d,x-26,234,107,43,self.a)
        self.mark(d,(x-22,240),i,99,32,PAPER_INK)
        for j in range(4):
            x=346+j*12
            d.line((x,183,x,320),fill="#d28e87",width=5)
        self.stations(d)

    def timer(self,d,i,f,p):
        for j,(x,r) in enumerate(((178,77),(381,58))):
            disk(d,x,242,r,WELL,self.a if i==j else LINE,4)
            for n in range(12):
                a=n*pi/6
                disk(d,x+(r-12)*cos(a),242+(r-12)*sin(a),2,MUTED)
            a=-pi/2+2*pi*min(1,p*(1.5 if j==0 else .85))
            d.line((x,242,x+round((r-20)*cos(a)),242+round((r-20)*sin(a))),fill=MINT,width=5)
            disk(d,x,242,5,SHEET)
        self.mark(d,(154,330),i,242,42,self.a)
        self.stations(d)

    def archive(self,d,i,f,p):
        for j,x in enumerate((87,307)):
            d.rounded_rectangle((x+5,188,x+87,232),8,fill=self.a if j==i%2 else LINE)
            plate(d,x,211,159,108,CABINET)
        x=round(101+214*p)
        y=177-round(42*sin(p*pi))
        plate(d,x,y,114,74,SHEET)
        self.mark(d,(x+7,y+11),i,100,53,PAPER_INK)
        self.stations(d)

    def fork(self,d,i,f,p):
        paths=[[(98,241),(213,241),(297,163),(445,163)],[(98,241),(213,241),(297,323),(445,323)]]
        for j,path in enumerate(paths):
            travel(d,path, f if i==j else 1 if i>j else 0,self.a if j==0 else MINT)
            self.mark(d,(299,path[-1][1]-46),j,168,42,INK if i>=j else MUTED)
        if i==2:
            travel(d,[(445,163),(472,163),(472,325),(446,325)],f,self.a)
            self.mark(d,(280,232),2,177,42,self.a)
        self.stations(d)

    def wheel(self,d,i,f,p):
        box=(143,119,413,353)
        d.ellipse(box,outline=LINE,width=5)
        d.arc(box,-90,-90+round(360*p),fill=self.a,width=6)
        for j in range(3):
            a=-pi/2+j*2*pi/3
            disk(d,278+135*cos(a),236+117*sin(a),15,MINT if j<=i else CABINET,LINE)
        self.mark(d,(207,212),i,149,59,self.a)
        self.stations(d)
