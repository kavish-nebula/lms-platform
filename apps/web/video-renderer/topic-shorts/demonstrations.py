"""Frame-seekable cutaways. Coordinates are on the reference film's 960×540 stage."""
import math
from PIL import ImageDraw


INK, SOFT, SHEET, DARK = "#f6eee9", "#c1b1b4", "#eaded1", "#29232e"
EDGE, MINT, RED = "#705b68", "#96c8b5", "#eca09a"


class Stage:
    def __init__(self, image, accent, font, progress):
        self.d = ImageDraw.Draw(image)
        self.a, self.font, self.p = accent, font, progress

    def at(self, start, end):
        v = max(0, min(1, (self.p - start) / (end - start)))
        return v * v * (3 - 2 * v)

    def label(self, x, y, value, size=21, color=INK, family="sans"):
        self.d.text((round(x), round(y)), value, font=self.font(size, family), fill=color)

    def box(self, x, y, w, h, fill=DARK, outline=EDGE, r=12):
        self.d.rounded_rectangle((x, y, x+w, y+h), r, fill=fill, outline=outline, width=2)

    def line(self, points, color=EDGE, width=3):
        self.d.line(points, fill=color, width=width, joint="curve")

    def dot(self, x, y, r, color):
        self.d.ellipse((x-r, y-r, x+r, y+r), fill=color)

    def travel(self, points, start, end, color=None):
        """Draw a cable, then trace it at constant distance along its elbows."""
        color = color or self.a
        self.line(points)
        if self.p < start:
            return
        spans = [math.dist(a, b) for a, b in zip(points, points[1:])]
        remaining = self.at(start, end) * sum(spans)
        for (x, y), (u, v), length in zip(points, points[1:], spans):
            fraction = min(1, remaining / length)
            tip = (x+(u-x)*fraction, y+(v-y)*fraction)
            self.line([(x, y), tip], color, 4)
            if remaining <= length:
                break
            remaining -= length
        self.dot(*tip, 6, color)

    def paper(self, x, y, w, h, heading, body="", light=True):
        bg, fg = (SHEET, DARK) if light else (DARK, INK)
        self.box(x,y,w,h,bg)
        self.label(x+16,y+12,heading,15,"#604e58" if light else SOFT,"mono")
        self.label(x+16,y+38,body,23,fg,"bold")

    def stamp(self, x, y, words, start, color=MINT):
        if self.p < start:
            return
        pop = self.at(start,start+.08)
        y += round((1-pop)*14)
        width = self.font(18,"bold").getlength(words)+34
        self.box(x,y,width,39,DARK,color,7)
        self.label(x+17,y+8,words,18,color,"bold")

    def typed(self,x,y,words,start,end,size=25,color=INK):
        if self.p >= start:
            n = round(len(words)*self.at(start,end))
            self.label(x,y,words[:n]+("▏" if n<len(words) else ""),size,color,"mono")

    def tent(self, x, y, size, color):
        self.d.polygon([(x-size,y),(x,y-size),(x+size,y)],fill=color)
        self.d.polygon([(x-4,y),(x,y-size+9),(x+size/2,y)],fill=DARK)


def conveyor(s):
    for i, word in enumerate(["Submit", "Validate fields", "Returns queue"]):
        x=145+i*258
        s.label(x,301,word,23,family="bold")
        s.dot(x+60,282,7,s.a)
    s.box(119,238,722,38,"#332b38")
    for x in range(136,829,33):
        s.dot(x,257,7,EDGE)
    x=158+255*s.at(.14,.45)+255*s.at(.61,.84)
    s.paper(x,139,135,95,"RETURN","Form")
    s.stamp(171,354,"No order number? Return the form.",.39)
    s.stamp(579,354,"Complete? Queue it.",.72)


def shop_question(s):
    s.box(76,218,279,140,SHEET)
    s.label(95,235,"ORBIT RETURN POLICY",15,DARK,"mono")
    s.label(95,274,"Free return shipping",20,DARK,"bold")
    s.label(95,304,"on orders over $75.",21,DARK)
    s.box(449,89,393,319)
    s.label(476,110,"Orbit support",23,INK,"bold")
    s.line([(472,154),(818,154)])
    if s.p>.06:
        y=180+21*(1-s.at(.06,.19))
        s.paper(487,y,312,77,"OWEN","Is return shipping free?",False)
    if s.p>.43:
        y=280+22*(1-s.at(.43,.58))
        s.box(476,y,323,92,"#253a35")
        s.label(492,y+10,"CHATBOT",15,MINT,"mono")
        s.typed(492,y+39,"Free on orders over $75.",.45,.72,20)


def swap_decision(s):
    s.paper(116,185,229,87,"ORDER","Find Owen’s item")
    s.travel([(345,229),(437,229)],.18,.34)
    if s.p>.27:
        s.paper(438,185,232,87,"INVENTORY","Check new size",False)
    if s.p>.45:
        s.travel([(554,272),(554,317),(322,317),(322,350)],.45,.66,MINT)
        s.travel([(554,272),(554,317),(727,317),(727,350)],.51,.74)
    s.stamp(211,352,"In stock · Offer swap",.63)
    s.stamp(590,352,"Sold out · Offer options",.70,s.a)


def order_filter(s):
    for i,(word,color) in enumerate([("Green tent",MINT),("Foam mat",SOFT),("Green tent",MINT),("Boots",SOFT)]):
        x=137+i*179
        y=195+int(54*s.at(.22,.42))*(i%2)
        if i%2 and s.p>.49:
            continue
        s.box(x,y,152,107)
        if i%2==0:
            s.tent(x+74,y+61,35,MINT)
        else:
            s.box(x+42,y+30,67,29,EDGE)
        s.label(x+20,y+73,word,18,color)
        if i%2==0:
            s.stamp(x,y+127,"Draft ready",.57+i*.075)


def size_check(s):
    for i,size in enumerate(["S","M","L","XL"]):
        x=147+i*169
        s.box(x,202,141,100,SHEET)
        s.label(x+43,221,size,39,DARK,"bold")
    x=148+169*s.at(.14,.48)
    s.line([(x,316),(x+138,316)],s.a,5)
    s.stamp(314,344,"Stock checked",.54)


def credential(s):
    s.paper(128,169,246,93,"ENVIRONMENT","API key  ••••")
    s.paper(623,169,190,93,"PROCESS","SDK",False)
    s.travel([(374,217),(623,217)],.34,.71)
    s.label(415,172,"reads at startup",16,SOFT)
    s.box(244,329,465,65)
    s.typed(265,348,"source.py    no embedded secret",.14,.44,21)


def token_choice(s):
    for i,(word,n) in enumerate([("free",.69),("returns",.46),("90",.32)]):
        y=192+i*52
        s.label(151,y,word,21,SOFT,"mono")
        s.box(272,y+5,219,18)
        span=int(210*n*s.at(.13+i*.045,.35+i*.045))
        if span: s.box(275,y+8,span,12,s.a,None,4)
    s.travel([(500,205),(553,205),(553,265),(609,265)],.44,.65)
    s.paper(610,222,209,90,"PREFIX","We offer")
    s.typed(627,330,"+ free",.63,.78,26,MINT)


def request_packet(s):
    s.box(186,141,590,246)
    s.label(215,158,"POST  /messages",26,s.a,"mono")
    for i,(key,val) in enumerate([("model","chosen identifier"),("messages","question + instructions"),("max_tokens","output limit")]):
        y=216+i*51
        s.label(219,y,key,19,SOFT,"mono")
        s.typed(395,y,val,.1+i*.23,.27+i*.23,21)


def prompt_edit(s):
    s.box(125,150,713,218,SHEET)
    s.label(153,171,"Handle this.",29,DARK,"serif")
    s.line([(153,194),(153+145*s.at(.07,.19),194)],"#95505b",3)
    for i,words in enumerate(["Draft a reply to the customer.","Use the 30-day return policy.","Keep it short. Flag missing facts."]):
        s.typed(154,231+i*39,words,.20+i*.18,.39+i*.18,22,DARK)


def refund(s):
    s.paper(134,155,255,93,"OWEN ASKS","Refund $310")
    s.paper(574,155,254,93,"APPROVAL RULE","Over $200")
    s.travel([(258,250),(258,292),(698,292),(698,250)],.19,.52)
    s.stamp(367,329,"Send for approval",.59,RED)


def schema(s):
    for i,(key,typ,val) in enumerate([("order_id","string or null","null"),("urgent","boolean","false"),("summary","text","Late order")]):
        y=183+i*69
        s.line([(145,y+50),(813,y+50)])
        s.label(153,y,key,22,INK,"mono")
        s.label(362,y,typ,21,SOFT)
        s.typed(646,y,val,.17+i*.22,.33+i*.22,22,MINT)


def tool_roundtrip(s):
    s.paper(115,175,189,91,"MODEL","get_order",False)
    s.paper(652,175,199,91,"APPLICATION","Run lookup")
    s.travel([(305,203),(652,203)],.07,.35)
    s.label(379,162,"ORB-10482",22,SOFT,"mono")
    s.travel([(750,272),(750,339),(212,339),(212,272)],.45,.80,MINT)
    s.stamp(359,351,"Shipped · PP-88213",.70)


def registry(s):
    s.paper(109,203,200,90,"TOOL CALL","get_order")
    for i,name in enumerate(["inventory","get_order","search_policy"]):
        y=139+i*82
        s.box(585,y,249,63,DARK,s.a if i==1 and s.p>.40 else EDGE)
        s.label(605,y+16,name,21,INK,"mono")
    s.travel([(309,247),(439,247),(439,252),(585,252)],.22,.55)
    s.stamp(176,348,"Run matching function",.66)


def calculator(s):
    s.box(284,106,390,312)
    s.box(313,131,332,74,SHEET)
    expression="24 × 7" if s.p<.62 else "168"
    s.label(340,144,expression[:round(len(expression)*s.at(.09,.47))],40,DARK,"mono")
    for i,key in enumerate(["2","4","×","7","="]):
        x=320+(i%3)*104
        y=233+(i//3)*73
        lit=.08+i*.12 <= s.p < .18+i*.12
        s.box(x,y,91,56,s.a if lit else DARK)
        s.label(x+31,y+8,key,30,DARK if lit else INK,"mono")


def carrier(s):
    route=[(174,331),(295,331),(366,257),(531,257),(608,174),(775,174)]
    s.line([(129,188),(272,224),(384,185),(513,209),(659,328),(830,356)],"#314652",16)
    s.travel(route,.12,.70)
    s.label(139,351,"Orbit dispatch",19,SOFT)
    s.label(651,130,"ParcelPath",24,family="bold")
    s.stamp(491,354,"In transit · Due Thursday",.65)


def retry(s):
    s.travel([(172,278),(794,278)],.09,.76)
    for x,title,sub in [(172,"Attempt 1","Timeout"),(477,"Wait","1 second"),(794,"Attempt 2","Retry")]:
        s.dot(x,278,8,s.a)
        s.label(x-52,220,title,21)
        s.label(x-47,307,sub,18,SOFT)
    s.stamp(367,366,"Enforce attempt limit",.75)


def context(s):
    s.paper(126,163,269,94,"PRIOR MESSAGE","ORB-10533")
    s.box(515,137,310,245)
    s.label(538,154,"Next request",26,INK,"serif")
    s.label(540,297,"Is the mat in this parcel?",21)
    f=s.at(.33,.67)
    if f:
        s.paper(147+389*f,229-28*f,263,78,"RECENT TURN","ORB-10533")


def compress(s):
    for i in range(12):
        x=144+i*52
        collapse=s.at(.25,.58) if i<9 else 0
        x+=(144+i*4-x)*collapse
        s.box(x,209,39,86,SHEET if i<9 else s.a,None,4)
    s.stamp(140,323,"Earlier turns → summary",.56)
    s.stamp(574,323,"Recent turns intact",.65)


def passages(s):
    for i,(title,selected) in enumerate([("Returns",True),("Warranty",False),("Return shipping",True)]):
        y=126+i*85
        s.paper(141,y,279,71,"POLICY",title)
        if selected:
            when=.19 if i==0 else .48
            target=190 if i==0 else 297
            s.travel([(421,y+33),(493,y+33),(493,target),(565,target)],when,when+.20)
            if s.p>=when+.13:
                s.paper(567,target-34,234,70,"CONTEXT",title,False)


def no_stock(s):
    for i in range(3):
        x=146+i*87
        s.box(x,193,72,85)
        s.line([(x+12,259),(x+60,207)],EDGE,2)
    s.paper(496,168,298,91,"INVENTORY RESULT","0 available")
    s.label(156,323,"Offer the larger tent",29,family="serif")
    s.line([(149,345),(149+263*s.at(.42,.66),345)],RED,4)
    s.stamp(498,325,"Revise plan",.70)


def trace(s):
    for i,(tag,word) in enumerate([("01  REQUEST","Need status"),("02  RESULT","Order shipped"),("03  DECISION","Answer customer")]):
        y=137+i*90
        s.dot(188,y+28,8,s.a)
        if i<2: s.line([(188,y+37),(188,y+111)])
        s.label(230,y,tag,17,SOFT,"mono")
        s.typed(411,y-4,word,.08+i*.23,.24+i*.23,27)
    s.travel([(188,165),(188,345)],.12,.66)


def blueprint(s):
    nodes=[(176,245),(391,166),(635,166),(772,307),(394,348)]
    for i,(a,b) in enumerate(zip(nodes,nodes[1:]+nodes[:1])):
        s.travel([a,b],.07+i*.14,.24+i*.14)
    for (x,y),name in zip(nodes,["Customer","Model","Tool","Result","Reply"]):
        s.box(x-62,y-23,124,46)
        s.label(x-49,y-13,name,20)


def installation(s):
    s.paper(124,159,241,96,"KNOWN INPUT","ORB-10482")
    s.box(582,142,226,136)
    s.label(600,162,"REGISTERED TOOL",16,SOFT,"mono")
    s.typed(600,204,"get_order",.07,.28,26)
    s.travel([(365,211),(582,211)],.29,.53)
    s.travel([(692,279),(692,328),(399,328)],.54,.72)
    s.stamp(154,308,"Expected status matched",.71)


def fixture(s):
    for i,(title,body) in enumerate([("TEST ORDER","ORB-10482"),("EXPECTED","Shipped"),("ACTUAL","Shipped")]):
        x=131+i*238
        if s.p>=i*.21:
            s.paper(x,180+int(19*(1-s.at(i*.21,i*.21+.12))),219,98,title,body,i!=2)
    s.travel([(479,291),(479,327),(721,327),(721,291)],.50,.72)
    s.stamp(419,350,"Match",.73)


def bad_argument(s):
    s.paper(147,195,278,94,"EXPECTED ARGUMENT","Order ID")
    s.paper(533,195,279,94,"RECEIVED ARGUMENT","Email address")
    s.travel([(425,243),(533,243)],.15,.44,RED)
    s.line([(550,277),(550+186*s.at(.39,.56),277)],RED,4)
    s.stamp(532,328,"Lookup failed",.57,RED)


def scorecard(s):
    for i,(name,n,c) in enumerate([("Baseline",38,SOFT),("After fix",53,MINT),("Shorter prompt",50,s.a)]):
        y=147+i*82
        s.label(127,y+9,name,20)
        s.box(316,y,432,47)
        value=n*s.at(.07+i*.23,.27+i*.23)
        if value>0: s.box(319,y+4,max(1,7*value),39,c,None,6)
        s.label(766,y+10,f"{round(value)} / 60",19,INK,"mono")


def approval(s):
    s.box(183,215,582,65)
    x=197+263*s.at(.08,.40)
    s.box(x,226,72,40,SHEET)
    s.label(x+11,233,"$310",19,DARK,"bold")
    for i in range(4):
        s.line([(545+i*10,197),(545+i*10,299)],RED,4)
    s.label(537,151,"Approval gate",25,family="serif")
    s.stamp(345,334,"Waiting for team review",.49)


def latency(s):
    for i,name in enumerate(["Full reply","Streaming"]):
        y=195+i*85
        s.label(150,y+11,name,23)
        s.box(308,y,499,56)
        if i:
            s.typed(329,y+12,"Your tent has shipped.",.31,.76,23,MINT)
        elif s.p<.76:
            s.label(329,y+12,"Waiting"+"."*(1+int(s.p*7)%3),23,SOFT,"mono")
        else:
            s.label(329,y+12,"Your tent has shipped.",23,INK,"mono")


def server_boundary(s):
    s.box(112,147,256,180)
    s.box(540,125,303,231)
    s.label(134,163,"Browser",27,family="serif")
    s.label(561,142,"Server",27,family="serif")
    s.label(564,213,"Credential  ••••",22,SOFT,"mono")
    s.label(564,268,"Tool loop",24)
    s.travel([(539,307),(465,307),(465,252),(369,252)],.42,.72)
    s.typed(137,235,"Reply",.67,.80,25,MINT)


def specialists(s):
    s.paper(106,206,249,94,"COORDINATOR","Split request",False)
    for i,(name,value) in enumerate([("WHOLESALE","Terms"),("INVENTORY","Availability")]):
        y=124+i*157
        s.travel([(356,250),(463,250),(463,y+42),(585,y+42)],.10+i*.14,.33+i*.14)
        s.paper(585,y,241,87,name,value)
        if s.p>.53:
            s.travel([(585,y+65),(494,y+65),(494,270),(356,270)],.54+i*.11,.73+i*.11,MINT)
    s.stamp(135,341,"Assemble reply",.80)


def final_loop(s):
    path=[(176,263),(369,171),(582,171),(762,263),(479,353),(176,263)]
    for i,(a,b) in enumerate(zip(path,path[1:])):
        s.travel([a,b],.04+i*.15,.23+i*.15)
    for (x,y),name in zip(path,["Question","Context","Lookup","Check","Reply"]):
        s.box(x-59,y-23,118,46)
        s.label(x-45,y-14,name,20)


# The middle act shows the exact operation named in each topic's voiceover.
DEMOS = {
    "m1-2": conveyor, "m1-3": order_filter, "m1-4": size_check, "m1-5": credential,
    "m2-1": token_choice, "m2-2": request_packet, "m2-3": prompt_edit,
    "m2-4": refund, "m2-5": schema, "m3-1": tool_roundtrip, "m3-2": registry,
    "m3-3": calculator, "m3-4": carrier, "m3-5": retry, "m4-1": context,
    "m4-2": compress, "m4-3": passages, "m4-4": no_stock, "m4-5": trace,
    "m5-1": blueprint, "m5-2": installation, "m5-3": fixture, "m5-4": bad_argument,
    "m5-5": scorecard, "m6-1": approval, "m6-2": latency, "m6-3": server_boundary,
    "m6-4": specialists, "m6-5": final_loop,
}

EXTRA_SHOTS = {("m1-2", 0): shop_question, ("m1-2", 2): swap_decision}
