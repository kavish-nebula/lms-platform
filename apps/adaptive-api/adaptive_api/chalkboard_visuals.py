"""Narrative-specific, persistent visual compositions for Chalkboard.

Each chapter owns one composition. Cue actions add/change a layer in place;
they do not rebuild the same diagram at every sentence boundary.
"""
from manim import (VGroup, Group, Text, Rectangle, RoundedRectangle, Circle,
                   Line, Arrow, Dot, Polygon, ImageMobject, UP, DOWN, LEFT,
                   RIGHT, ORIGIN)
from chalkboard_tokens import T


class Illustration(VGroup):
    """Compound drawing; overlaps between its intentional parts are expected."""


class VisualLibrary:
    def __init__(self, asset=None):
        self.t = T(theme='chalkboard')
        self.asset = asset

    def text(self, value, at=ORIGIN, size=25, role='body', width=11):
        label = Text(str(value), font='Arial', font_size=size, color=self.t.role(role))
        if label.width > width:
            label.scale_to_fit_width(width)
        return label.move_to(at)

    def paper(self, at, width=.8, height=1.05):
        box = Rectangle(width=width, height=height, color=self.t.role('focus_secondary'), stroke_width=2)
        lines = [Line(LEFT * width * .3 + UP * y, RIGHT * width * .3 + UP * y,
                      color=self.t.role('context_muted')) for y in (height * .23, 0, -height * .23)]
        return Illustration(box, *lines).move_to(at)

    def panel(self, width, height, at, role='stroke_muted'):
        return RoundedRectangle(width=width, height=height, corner_radius=.12,
                                stroke_color=self.t.role(role), stroke_width=2,
                                fill_color=self.t.surface('bg_subtle'), fill_opacity=1).move_to(at)

    def fan(self, at):
        blades = Illustration(*[Line(ORIGIN, direction * .65, color=self.t.role('focus_secondary'), stroke_width=6)
                                for direction in (UP, LEFT, DOWN, RIGHT)])
        return Illustration(Circle(radius=.8, color=self.t.role('stroke_muted')), blades,
                            Dot(radius=.1, color=self.t.role('focus_primary'))).move_to(at)

    def table(self, at=ORIGIN, width=7, rows=4):
        height = 2.8
        outer = Rectangle(width=width, height=height, color=self.t.role('stroke_muted'))
        lines = [Line(LEFT * width / 2 + UP * (height / 2 - i * height / rows),
                      RIGHT * width / 2 + UP * (height / 2 - i * height / rows), color=self.t.role('stroke_muted')) for i in range(1, rows)]
        lines += [Line(UP * height / 2 + RIGHT * x, DOWN * height / 2 + RIGHT * x,
                       color=self.t.role('stroke_muted')) for x in (-width / 6, width / 6)]
        return Illustration(outer, *lines).move_to(at)

    def layers(self, chapter, narration):
        kind, labels = chapter['kind'], chapter['labels']
        label = lambda i, default: labels[i] if i < len(labels) else default
        l = {}
        amber, blue = self.t.role('focus_primary'), self.t.role('focus_secondary')
        if kind == 'incident-board':
            machine = Illustration(self.panel(3,2.4,LEFT*3),Circle(radius=.6,color=blue).move_to(LEFT*3),Line(LEFT*3+UP*.6,LEFT*3+DOWN*.6,color=blue))
            l['primary'] = Illustration(machine,self.text(label(0,'Machine downtime'),LEFT*3+UP*2,26,'focus_primary',4))
            l['secondary'] = Illustration(*[self.paper(RIGHT*(2.1+j*.3)+UP*(.7-j*.2),1.1,1.5) for j in range(4)],self.text(label(1,'Maintenance manuals'),RIGHT*3+UP*2,24,width=4))
            l['detail'] = Illustration(self.text('?',RIGHT*3+DOWN*1.5,50,'accent_warm'),self.text(label(2,'Disconnected descriptions'),DOWN*2.55,25,'accent_warm'))
            l['result'] = self.text(label(3,'Finance analogy'),UP*2.7,22,'accent_meta')
        elif kind == 'parameter-network':
            l['primary'] = Illustration(*[self.paper(LEFT*4.7+UP*y,.7,.95) for y in (-1.2,0,1.2)],self.text(label(0,'Text sources'),LEFT*4.5+UP*2.25,24,width=3))
            nodes=[Dot(RIGHT*x+UP*y,radius=.11,color=amber if x==2 else blue) for x in (-1, .5, 2) for y in (-1.3,0,1.3)]
            l['secondary'] = Illustration(*nodes,self.text(label(1,'Learned parameters'),RIGHT*.5+UP*2.25,26,'focus_primary',6))
            l['detail'] = Illustration(*[Line(a.get_center(),b.get_center(),color=self.t.role('stroke_muted')) for a in nodes[:3] for b in nodes[3:6]],*[Line(a.get_center(),b.get_center(),color=self.t.role('stroke_muted')) for a in nodes[3:6] for b in nodes[6:]],self.text(label(2,'Pattern relationships'),DOWN*2.4,24))
            l['result'] = self.text(label(3,'Finance analogy'),RIGHT*4.8+DOWN*.6,22,'accent_meta',3)
        elif kind == 'document-dialogue':
            l['primary'] = Illustration(*[self.paper(LEFT*(3.5-j*.35)+UP*(.3-j*.15),1.5,2.1) for j in range(3)],self.text(label(0,'Technical documents'),LEFT*3.3+UP*2.3,25,width=5))
            l['secondary'] = Illustration(self.panel(4.8,1.2,RIGHT*2.8+UP*.8,'focus_secondary'),self.text(label(1,'Interactive knowledge'),RIGHT*2.8+UP*.8,24,width=4.4),Arrow(LEFT*1.5,RIGHT*.1,color=blue))
            l['detail'] = Illustration(self.panel(4.8,.9,RIGHT*2.8+DOWN*1),self.text(label(2,'Plain-language prompt'),RIGHT*2.8+DOWN*1,24,width=4.4))
            l['result'] = self.text(label(3,'Finance analogy'),DOWN*2.65,23,'accent_meta')
        elif kind == 'prompt-workspace':
            l['primary'] = Illustration(self.panel(10,4.5,ORIGIN),self.panel(8.8,.85,UP*1.1,'focus_secondary'),self.text(label(0,'Plain-language instruction'),UP*1.1,26),self.text('│',RIGHT*3.9+UP*1.1,35,'focus_primary'))
            l['secondary'] = self.text(label(1,'Model limitations'),DOWN*.2,30,'accent_warm')
            l['detail'] = Illustration(self.panel(7.5,.9,DOWN*1.3,'accent_warm'),self.text(label(2,'Private context not supplied'),DOWN*1.3,25,'accent_warm',7))
            l['result'] = self.text(label(3,'Check the source'),DOWN*2.8,24,'accent_meta')
        elif kind == 'knowledge-hub':
            positions=[LEFT*4+UP*1.6,LEFT*4+DOWN*1.5,RIGHT*4+UP*1.6,RIGHT*4+DOWN*1.5]
            l['primary'] = Illustration(*[self.paper(p,.85,1.2) for p in positions],self.text(label(0,'Technical text'),UP*2.7,26))
            l['secondary'] = Illustration(Circle(radius=1,color=amber),self.text('?',ORIGIN,55,'focus_primary'),self.text(label(1,'Source-grounded engine'),DOWN*2.6,25,'focus_primary'))
            l['detail'] = Illustration(*[Arrow(p*.78,p*.3,color=blue) for p in positions],self.text(label(2,'Accessible knowledge'),UP*1.7,24,'focus_secondary',5))
            l['result'] = self.text(label(3,'Finance analogy'),RIGHT*4.6,23,'accent_meta',3)
        elif kind == 'workbench':
            if self.asset:
                picture = ImageMobject(self.asset).scale_to_fit_width(10)
                if picture.height > 4.9:
                    picture.scale_to_fit_height(4.9)
                picture.move_to(UP * .15)
                l['primary'] = picture
            else:
                l['primary'] = self.table(width=8)
            l['secondary'] = Illustration(self.text(label(1, 'Fixed routing condition'), DOWN * 2.55, 27, 'focus_primary'), self.paper(LEFT * 3.6 + DOWN * .8, .55, .7))
            # Different meaningful additions, not replays of a full flowchart.
            l['detail'] = Illustration(*[self.paper(RIGHT * (3.4 + i * .28) + DOWN * (1.7 - i * .16), .6, .8) for i in range(4)])
            l['result'] = self.text(label(3, 'Rule unchanged'), LEFT * 3 + UP * 2.4, 22, 'accent_warm', 4)
        elif kind == 'claim-evidence':
            chat = self.panel(5.5, 2.2, LEFT * 3 + UP * .9, 'focus_secondary')
            l['primary'] = Illustration(chat, self.text(label(0, 'AI explanation'), LEFT * 3 + UP * 1.5, 24))
            l['secondary'] = self.text(label(1, 'Proposed cause'), LEFT * 3 + UP * .5, 24, 'accent_warm', 5)
            sheet = self.table(RIGHT * 3.3 + UP * .3, width=4.6)
            l['detail'] = Illustration(sheet, self.text(label(2, 'Supplied evidence'), RIGHT * 3.3 + UP * 2, 23, 'focus_primary', 5))
            l['result'] = Illustration(self.panel(4.8, .8, RIGHT * 3.3 + DOWN * 2.1, 'accent_warm'),
                                       self.text(label(3, 'Check support'), RIGHT * 3.3 + DOWN * 2.1, 23, 'accent_warm', 4.5))
        elif kind == 'comparison':
            l['primary'] = Illustration(self.panel(5.4, 4.1, LEFT * 3), self.text(label(0, 'Earlier condition'), LEFT * 3 + UP * 1.55, 24, width=4.8), self.paper(LEFT * 3))
            # Source example is explicitly separated from the learner analogy.
            l['secondary'] = Illustration(self.panel(5.4, 4.1, RIGHT * 3), self.text(label(1, 'Changed condition'), RIGHT * 3 + UP * 1.55, 24, width=4.8),
                                          self.fan(RIGHT * 3 + DOWN * .2))
            l['detail'] = self.text(label(2, 'Compare the condition'), DOWN * 2.65, 27, 'focus_primary')
            l['result'] = self.text(label(3, 'Source example'), RIGHT * 3 + DOWN * 1.55, 21, 'accent_warm', 4.8)
        elif kind == 'source-inspection' and 'do not approve payments' in narration.lower():
            l['primary'] = Illustration(self.paper(ORIGIN, 2.1, 2.6), self.text(label(0, 'Administrative review'), UP * 2.2, 28, 'focus_primary'))
            left = Illustration(Circle(radius=.65, color=blue), self.text('↗', size=44, role='focus_secondary')).move_to(LEFT * 4)
            right = Illustration(self.fan(ORIGIN)).scale(.8).move_to(RIGHT * 4)
            crosses = Illustration(*[Line(at+LEFT*.65+UP*.65, at+RIGHT*.65+DOWN*.65, color=self.t.role('accent_warm'), stroke_width=4) for at in (LEFT*4, RIGHT*4)])
            l['secondary'] = Illustration(left, right, crosses, self.text(label(1, 'No payment approval'), LEFT*4+DOWN*1.4, 23, width=3.5), self.text(label(2, 'No equipment changes'), RIGHT*4+DOWN*1.4, 23, width=3.5))
            l['detail'] = self.text('Learning exercise only', DOWN*2.6, 24, 'context_muted')
            l['result'] = self.text('Inspect, do not operate', UP*2.75, 22, 'accent_meta')
        elif kind in ('source-inspection', 'spreadsheet'):
            sheet = self.table(LEFT * 1, width=7.2, rows=5)
            l['primary'] = Illustration(sheet, self.text(label(0, 'Supplied record'), LEFT * 1 + UP * 2.1, 28, 'focus_primary'))
            highlight = Rectangle(width=7.1, height=.54, color=amber, fill_opacity=.12, fill_color=amber).move_to(LEFT * 1 + UP * .55)
            l['secondary'] = Illustration(highlight, self.text(label(1, 'Inspect the fields'), RIGHT * 4.8 + UP * 1.2, 23, width=2.8))
            l['detail'] = self.text(label(2, 'Evidence not supplied'), DOWN * 2.25, 26, 'accent_warm')
            l['result'] = self.text(label(3, 'Review the boundary'), RIGHT * 4.8 + DOWN * .8, 23, width=2.8)
        elif kind == 'decision':
            l['primary'] = Illustration(self.paper(LEFT * 3, 1.5, 2), self.text('?', RIGHT * 2.5 + UP * .4, 100, 'focus_primary'),
                                        self.text(label(0, 'What would you inspect?'), DOWN * 2.2, 30, width=10))
            l['secondary'] = Illustration(self.panel(5, .9, RIGHT * 2.5 + DOWN * 1.4), self.text('Your explanation', RIGHT * 2.5 + DOWN * 1.4, 21, 'context_muted'))
            l['detail'] = self.text(label(1, 'What would establish the change?'), UP * 2.25, 25, width=10)
            l['result'] = self.text('Pause and think', DOWN * 2.95, 21, 'context_muted')
        elif kind == 'conveyor':
            belt = Illustration(RoundedRectangle(width=9.5, height=.65, corner_radius=.3, color=blue).move_to(DOWN * 1),
                                *[Circle(radius=.18, color=self.t.role('stroke_muted')).move_to(LEFT * (4.2 - i * 1.2) + DOWN) for i in range(8)])
            blocks = Illustration(*[Rectangle(width=.8, height=.75, color=amber).move_to(LEFT * (3.6 - i * 2) + DOWN * .25) for i in range(4)])
            l['primary'] = Illustration(belt, blocks, self.text(label(0, 'Repeatable physical work'), DOWN * 2.3, 25))
            l['secondary'] = Illustration(self.panel(2.5, 1.1, LEFT * 3.6 + UP * 1.65, 'focus_primary'), self.text(label(1, 'Programmed controller'), LEFT * 3.6 + UP * 1.65, 22, width=2.3))
            l['detail'] = Illustration(Arrow(LEFT * 2.5 + UP * 1.65, RIGHT * 2.5 + UP * 1.65, color=blue), self.text(label(2, 'Predictable conditions'), RIGHT * 3 + UP * 2.2, 23, width=4.3))
            l['result'] = self.text(label(3, 'Finance analogy'), UP * .55, 22, 'accent_meta')
        elif kind == 'variables':
            centers = [LEFT * 3.8, ORIGIN, RIGHT * 3.8]
            l['primary'] = Illustration(*[self.panel(2.8, 3.6, p) for p in centers], self.text(label(0, 'Conditions change'), UP * 2.5, 28, 'focus_primary'))
            gauges = []
            for i, p in enumerate(centers):
                gauge = Rectangle(width=.55, height=(1.0 + i * .55), color=blue, fill_color=blue, fill_opacity=.45).move_to(p + DOWN * .3)
                gauges.append(gauge)
            l['secondary'] = Illustration(*gauges, self.text(label(1, 'Input varies'), DOWN * 2.5, 25))
            l['detail'] = Illustration(Line(LEFT * .45 + UP * .45, RIGHT * .45 + DOWN * .45, color=self.t.role('accent_warm')).move_to(UP * .2), self.text(label(2, 'The pathway stops'), UP * 1.3, 22, 'accent_warm'))
            l['result'] = self.text(label(3, 'Manual update'), RIGHT * 3.8 + UP * 1.1, 22, 'focus_primary', 2.6)
        elif kind == 'cooling':
            sensor = Illustration(RoundedRectangle(width=.5, height=2.6, corner_radius=.22, color=blue), Circle(radius=.35, color=blue).move_to(DOWN * 1.25)).move_to(LEFT * 4)
            l['primary'] = Illustration(sensor, self.text(label(0, 'Machine temperature'), LEFT * 3.8 + UP * 2.1, 24, width=4.2))
            l['secondary'] = Illustration(self.panel(3.2, 1.5, ORIGIN, 'focus_primary'), self.text(label(1, 'Programmed threshold'), ORIGIN, 23, width=3), Arrow(LEFT * 3.4, LEFT * 1.8, color=blue))
            l['detail'] = Illustration(self.fan(RIGHT * 4), Arrow(RIGHT * 1.8, RIGHT * 3, color=blue), self.text(label(2, 'Cooling action'), RIGHT * 4 + DOWN * 1.7, 24, width=3.2))
            l['result'] = self.text(label(3, 'Deterministic condition'), DOWN * 2.6, 27, 'focus_primary')
        elif kind == 'coolant-aging':
            tanks = Illustration(*[self.panel(2.2,2.8,at) for at in (LEFT*3, RIGHT*3)], self.text('Earlier coolant',LEFT*3+UP*2.05,24), self.text('Aged coolant',RIGHT*3+UP*2.05,24),
                                 Rectangle(width=1.8,height=1.9,color=blue,fill_color=blue,fill_opacity=.35).move_to(LEFT*3+DOWN*.3),
                                 Rectangle(width=1.8,height=1.9,color=self.t.role('accent_warm'),fill_color=self.t.role('accent_warm'),fill_opacity=.25).move_to(RIGHT*3+DOWN*.3))
            l['primary'] = Illustration(tanks, self.text(label(0,'Coolant ages'),UP*2.7,25,'focus_primary'))
            l['secondary'] = Illustration(Line(LEFT*4.3+DOWN*1.8,RIGHT*4.3+DOWN*1.8,color=self.t.role('focus_primary')),self.text(label(1,'Same programmed trigger'),DOWN*2.3,27,'focus_primary'))
            l['detail'] = self.text(label(2,'Efficiency changes'),ORIGIN,24,'accent_warm',2.8)
            l['result'] = self.text(label(3,'Finance analogy'),RIGHT*4.5+UP*2.75,22,'accent_meta',3.5)
        elif kind == 'pattern-chart':
            axes = Illustration(Line(LEFT * 5 + DOWN * 1.8, RIGHT * 2 + DOWN * 1.8, color=blue), Line(LEFT * 5 + DOWN * 1.8, LEFT * 5 + UP * 2.1, color=blue))
            positions = [LEFT * (4.4 - i * .8) + UP * (-1.25 + i * .4 + (.23 if i % 2 else -.13)) for i in range(8)]
            l['primary'] = Illustration(axes, *[Dot(p, radius=.075, color=amber) for p in positions], self.text(label(0, 'Operational history'), UP * 2.7, 26))
            l['secondary'] = Illustration(Line(positions[0], positions[-1], color=blue, stroke_width=4), self.text(label(1, 'Learned relationship'), RIGHT * 4 + UP * 1.6, 25, 'focus_primary', 3.6))
            l['detail'] = Illustration(Polygon(positions[0]+UP*.35, positions[-1]+UP*.35, positions[-1]+DOWN*.35, positions[0]+DOWN*.35, color=blue, fill_color=blue, fill_opacity=.16), self.text(label(2, 'Variable confidence'), RIGHT * 4 + DOWN * .4, 23, width=3.6))
            l['result'] = self.text(label(3, 'Illustration, not measured data'), DOWN * 2.6, 24, 'accent_meta')
        elif kind == 'system-layers':
            rows = [DOWN * 1.8, ORIGIN, UP * 1.8]
            for target, at, index in zip(('primary', 'secondary', 'detail'), rows, range(3)):
                l[target] = Illustration(self.panel(9 - index * 1.2, 1.15, at, 'focus_primary' if index == 2 else 'stroke_muted'), self.text(label(index, ('Physical execution', 'AI coordination', 'Human goals')[index]), at, 28))
            l['result'] = self.text(label(3, 'Different responsibilities'), RIGHT * 4.8 + UP * 2.65, 22, 'accent_meta', 3.2)
        elif kind == 'control-room':
            head = Circle(radius=.35, color=amber).move_to(LEFT * 4 + UP * 1)
            body = Illustration(Line(LEFT * 4 + UP * .6, LEFT * 4 + DOWN * .8, color=amber), Line(LEFT * 4.6, LEFT * 3.4, color=amber))
            l['primary'] = Illustration(head, body, self.text(label(0, 'Human performance targets'), UP * 2.2, 29, 'focus_primary'))
            sliders = Illustration(*[Line(LEFT * .6 + UP * y, RIGHT * 4.7 + UP * y, color=blue) for y in (.9, 0, -.9)], *[Circle(radius=.12, color=amber).move_to(RIGHT * x + UP * y) for x,y in ((1,.9),(3,0),(2,-.9))])
            l['secondary'] = Illustration(sliders, self.text(label(1, 'Human oversight'), DOWN * 2.25, 25))
            l['detail'] = self.text(label(2, 'AI coordination'), RIGHT * 2 + DOWN * 1.45, 22, 'focus_secondary')
            l['result'] = self.text(label(3, 'Execution layer'), LEFT * 4 + DOWN * 1.75, 22, 'context_muted', 3)
        elif kind == 'token-stream':
            cells = Illustration(*[self.panel(1.6, .9, LEFT * (4.2 - i * 2)) for i in range(4)])
            l['primary'] = Illustration(cells, self.text(label(0, 'Supplied text'), UP * 2, 28, 'focus_primary'))
            l['secondary'] = Illustration(Circle(radius=.8, color=blue).move_to(DOWN * 1.8), *[Line(LEFT * (4.2-i*2)+DOWN*.55, DOWN, color=self.t.role('stroke_muted')) for i in range(4)])
            l['detail'] = Illustration(self.panel(1.5, .9, RIGHT * 4.4, 'focus_primary'), self.text('?', RIGHT * 4.4, 35, 'focus_primary'))
            l['result'] = self.text(label(3, 'Likely text still needs evidence'), DOWN * 2.9, 24, 'accent_warm')
        elif kind in ('retrieval-map', 'data-boundary', 'backlog'):
            if kind == 'backlog':
                l['primary'] = Illustration(self.panel(8.5, 3.5, ORIGIN), self.text(label(0, 'Request queue'), UP * 2.4, 28))
                l['secondary'] = Illustration(*[self.paper(LEFT * (3 - i * 1.3) + UP * .4) for i in range(5)])
                l['detail'] = Illustration(*[self.paper(LEFT * (3 - i * 1.3) + DOWN * .9) for i in range(5)])
                l['result'] = self.text(label(3, 'Rule unchanged'), DOWN * 2.5, 27, 'focus_primary')
            elif kind == 'retrieval-map':
                l['primary'] = Illustration(self.paper(LEFT * 4, 1.5, 2), self.text(label(0, 'Question'), LEFT * 4 + UP * 1.8, 24))
                if 'telemetry' in narration.lower():
                    l['secondary'] = Illustration(self.paper(UP*1.1),self.text(label(1,'SOP document'),UP*2.1,22),Arrow(LEFT*3,LEFT*.7+UP*1.1,color=blue))
                    l['detail'] = Illustration(Circle(radius=.5,color=blue).move_to(DOWN*1.1),Line(DOWN*1.1,RIGHT*.3+DOWN*.9,color=amber),self.text(label(2,'Live telemetry'),DOWN*2.1,22),Arrow(LEFT*3,LEFT*.7+DOWN*1.1,color=blue))
                else:
                    l['secondary'] = Illustration(*[self.paper(RIGHT * x + UP * y) for x,y in ((-.6,1.2),(1.1,.2),(-.6,-1.2))])
                    l['detail'] = Illustration(*[Arrow(LEFT*3+UP*.2, RIGHT*x+UP*y, color=blue) for x,y in ((-.6,1.2),(1.1,.2),(-.6,-1.2))])
                l['result'] = Illustration(self.panel(3, 2, RIGHT*4), self.text(label(3, 'Source-linked response'), RIGHT*4, 23, width=2.8))
            else:
                l['primary'] = Illustration(self.panel(5,4,LEFT*3), self.text(label(0, 'Local system'),LEFT*3+UP*1.5,26),self.paper(LEFT*3))
                l['secondary'] = Illustration(Circle(radius=1.1,color=blue).move_to(RIGHT*3),self.text(label(1, 'Cloud service'),RIGHT*3+UP*1.7,26))
                l['detail'] = Illustration(Line(UP*2.5,DOWN*2.5,color=self.t.role('accent_warm')),self.text(label(2,'Data boundary'),DOWN*2.8,25,'accent_warm'))
                l['result'] = self.text(label(3, 'Location is not a security guarantee'),UP*2.75,24,'context_muted')
        else:
            raise ValueError('No reviewed renderer for visual kind: ' + kind)
        return l
