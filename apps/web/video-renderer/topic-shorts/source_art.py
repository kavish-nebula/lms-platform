"""Cue-driven illustrations of the course's authored teaching artifacts."""
from math import cos, sin, pi
from PIL import ImageDraw
from graphics import CABINET, WELL, PAPER_INK, PAPER_MUTED, MINT, label, panel
from render import INK, MUTED, SHEET, LINE, ease


def entries(slide):
    kind = slide["kind"]
    if kind == "compare":
        return [(r["cue"], r["label"], "  •  ".join(r["points"])) for r in (slide["left"], slide["right"])]
    if kind == "code":
        return [(r["cue"], r["code"], r["out"]) for r in slide["rows"]]
    if kind == "chat":
        return [(r["cue"],r["label"],r["text"]) for r in slide["messages"]]
    if kind == "table":
        return [(r["cue"],r["cells"][0],"  ·  ".join(r["cells"][1:])) for r in slide["rows"]]
    if kind == "cards":
        return [(r["cue"],r["title"],"  •  ".join(r["flow"])) for r in slide["cards"]]
    if kind == "example":
        return [(r["cue"],r["time"],r["text"]) for r in slide["steps"]]
    if kind in {"cycle","flow","hub"}:
        group={"cycle":"steps","flow":"nodes","hub":"spokes"}[kind]
        return [(r["cue"],r["label"],r.get("sub","")) for r in slide[group]]
    group={"define":"parts","bullets":"bullets"}[kind]
    rows=[]
    for i,r in enumerate(slide[group]):
        name,sep,value=r["text"].partition(": ")
        rows.append((r["cue"],name if sep else "",value if sep else name))
    return rows


class SourceArt:
    def __init__(self, slide, accent):
        self.slide, self.a = slide, accent
        self.kind = slide["kind"]
        self.rows = entries(slide)

    def paint(self,image,cue,since):
        d=ImageDraw.Draw(image)
        active=max((i for i,r in enumerate(self.rows) if r[0]<=cue), default=0)
        row=self.rows[active]
        f=ease(since/22) if row[0]==cue else 1
        if self.kind in {"flow","cycle","hub"}:
            self.diagram(d,active,f)
        elif self.kind=="compare":
            for i,(_,name,detail) in enumerate(self.rows):
                x=66+i*430
                lit=(i==active)
                y=135+round((1-f)*16) if lit else 135
                paper=SHEET if lit else CABINET
                panel(d,(x,y,x+403,y+242),paper,self.a if lit else LINE)
                label(d,(x+24,y+23),name,354,61,32,"bold",PAPER_INK if lit else INK)
                points=self.slide["left" if i==0 else "right"]["points"]
                focus=min(len(points)-1,max(0,cue-self.rows[i][0]))
                for j,point in enumerate(points):
                    py=y+86+j*(148//len(points))
                    if lit and j==focus:
                        d.rounded_rectangle((x+14,py-2,x+20,py+24),3,fill=PAPER_INK)
                    label(d,(x+30,py),point,353,148//len(points),21,
                          "bold" if lit and j==focus else "sans",PAPER_INK if lit else MUTED)
        elif self.kind=="code":
            panel(d,(76,96,884,409),WELL)
            for i,color in enumerate((self.a,"#e1b77d",MINT)):
                d.ellipse((99+i*20,114,109+i*20,124),fill=color)
            start=max(0,active-1)
            for i in range(start,min(start+3,len(self.rows))):
                _,code,out=self.rows[i]
                y=155+(i-start)*64
                if i==active:
                    panel(d,(93,y-4,864,y+51),CABINET,self.a,5)
                label(d,(106,y+4),str(i+1).rjust(2,"0"),46,40,19,"mono",MUTED)
                label(d,(167,y+3),code,676,48,22,"mono",INK if i==active else MUTED)
            label(d,(104,353),row[2],738,48,22,"sans",MINT)
        elif self.kind=="chat":
            start=max(0,active-2)
            for i in range(start,active+1):
                _,name,detail=self.rows[i]
                user=self.slide["messages"][i].get("role")=="user"
                x=108 if user else 325
                y=95+113*(i-start)+round((1-f)*22) if i==active else 95+113*(i-start)
                panel(d,(x,y,x+526,y+98),SHEET if user else CABINET,self.a if i==active else LINE,18)
                label(d,(x+18,y+7),name,490,29,17,"mono",PAPER_MUTED if user else self.a)
                label(d,(x+18,y+37),detail,490,57,21,"sans",PAPER_INK if user else INK)
        elif self.kind=="table" and self.slide["columns"][0]=="Session id":
            # One conversation per drawer. On the shared cue both customer
            # drawers are present so their records can be compared directly.
            for j,(_,identifier,record) in enumerate(self.rows):
                x=72+278*j
                panel(d,(x,145,x+258,347),WELL)
                opened=cue>=self.rows[j][0]
                lift=ease(since/27) if cue==self.rows[j][0] else 1
                y=round(239-82*lift) if opened else 239
                if opened:
                    panel(d,(x+12,y,x+246,326),SHEET)
                    label(d,(x+25,y+14),record,207,104,23,"sans",PAPER_INK)
                panel(d,(x+6,274,x+252,337),CABINET,self.a if opened else LINE)
                label(d,(x+24,292),identifier,214,33,20,"mono")
            if cue>=4:
                label(d,(109,380),"Keep each conversation in persistent storage.",747,61,26,"sans",MINT)
        elif self.kind=="table":
            start=max(0,min(active-1,len(self.rows)-3))
            col=self.slide["columns"]
            label(d,(108,100),col[0],270,42,23,"bold",self.a)
            label(d,(413,100),"  ·  ".join(col[1:]),434,42,22,"bold",self.a)
            for i in range(start,min(start+3,len(self.rows))):
                _,name,detail=self.rows[i]
                y=155+(i-start)*82
                panel(d,(88,y,873,y+73),SHEET if i==active else CABINET)
                color=PAPER_INK if i==active else MUTED
                label(d,(105,y+10),name,281,58,23,"bold",color)
                label(d,(413,y+10),detail,441,58,22,"sans",color)
        elif self.kind=="example":
            start=max(0,active-2)
            for i in range(start,active+1):
                _,name,detail=self.rows[i]
                y=121+(i-start)*103
                d.ellipse((111,y+14,130,y+33),fill=self.a if i==active else LINE)
                if i<active: d.line((120,y+33,120,y+118),fill=LINE,width=3)
                label(d,(150,y),name,170,66,24,"mono",self.a)
                label(d,(342,y),detail,490,83,26)
        else:
            # A folder brings the current policy clause or definition to the front.
            for j in range(2):
                panel(d,(114+j*11,126-j*9,839+j*11,400-j*9),CABINET,LINE)
            x=103+round((1-f)*37)
            panel(d,(x,139,x+724,402),SHEET,LINE)
            if row[1]:
                label(d,(x+39,169),row[1],647,76,34,"bold",PAPER_INK)
            label(d,(x+39,256 if row[1] else 183),row[2],647,135,30,"serif",PAPER_INK)
        return image

    def diagram(self,d,active,f):
        n=len(self.rows)
        if self.kind=="flow":
            points=[(127+round(699*i/max(1,n-1)),203+(-1)**i*42) for i in range(n)]
        else:
            points=[(round(478+315*cos(-pi/2+i*2*pi/n)),round(230+103*sin(-pi/2+i*2*pi/n))) for i in range(n)]
        for i,(x,y) in enumerate(points):
            j=(i-1)%n
            if self.kind=="hub": a,b=480,231
            elif i or self.kind=="cycle": a,b=points[j]
            else: continue
            d.line([(a,b),(x,y)],fill=LINE,width=4)
            if i==active:
                end=(round(a+(x-a)*f),round(b+(y-b)*f))
                d.line([(a,b),end],fill=self.a,width=4)
        if self.kind=="hub": d.ellipse((465,216,495,246),fill=self.a)
        for i,(x,y) in enumerate(points):
            size=13 if i==active else 8
            d.ellipse((x-size,y-size,x+size,y+size),fill=self.a if i<=active else CABINET,outline=LINE)
            label(d,(x-80,y+17),self.rows[i][1],162,51,18,"bold",INK if i==active else MUTED)
        _,name,detail=self.rows[active]
        panel(d,(92,385,870,450),CABINET)
        label(d,(111,396),detail or name,741,48,24,"sans",INK)
