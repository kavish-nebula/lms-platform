"""Drawing primitives for the evidence documents, diagrams and workbench props."""
from functools import lru_cache
from render import INK, LINE, font

PAPER_INK = "#302634"
PAPER_MUTED = "#675264"
CABINET = "#2b2532"
WELL = "#1a1924"
MINT = "#a8d2bd"


@lru_cache(maxsize=8192)
def fit(value, width, height, maximum, family):
    for size in range(maximum, 12, -1):
        face = font(size, family)
        lines = []
        for paragraph in value.splitlines():
            line = ""
            for word in paragraph.split():
                if face.getlength(word) > width:
                    break
                combined = f"{line} {word}".strip()
                if line and face.getlength(combined) > width:
                    lines.append(line)
                    line = word
                else:
                    line = combined
            else:
                lines.append(line)
                continue
            break
        else:
            if len(lines)*(size+5) <= height:
                return size, lines
    raise ValueError(f"Text does not fit {width} x {height}: {value}")


def label(draw, xy, value, width, height, maximum=26, family="sans", color=INK):
    size, lines = fit(value, width, height, maximum, family)
    for i, line in enumerate(lines):
        draw.text((xy[0], xy[1]+i*(size+5)), line, font=font(size,family), fill=color)


def panel(draw, box, fill=CABINET, edge=LINE, radius=12):
    draw.rounded_rectangle(box, radius, fill=fill, outline=edge, width=2)
