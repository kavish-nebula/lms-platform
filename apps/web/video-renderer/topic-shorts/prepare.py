"""Assemble beginner concepts and their worked examples before recording them."""
import argparse
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
COURSE = HERE.parents[3] / "fixtures/src/ai-agent"


def sentences(value):
    return re.split(r"(?<=[.!?])\s+(?=[A-Z])", value)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def assemble():
    plans = read(HERE / "teaching.json")
    direction = read(HERE / "direction.json")
    films = []
    for case in read(HERE / "storyboards.json"):
        topic_id = case["id"]
        module, number = topic_id.split("-")
        path = COURSE / module / f"video-{module[1:]}.{number}.json"
        lesson, plan = read(path), plans[topic_id]
        concept = {"type": "concept", "title": lesson["title"], "treatment": plan["treatment"],
                   "lines": [], "cards": []}
        for beat in plan["concept"]:
            concept["cards"].append({"term": beat["term"], "meaning": beat["meaning"],
                                     "cue": len(concept["lines"])})
            concept["lines"].extend(sentences(beat["voice"]))
        edit = direction[topic_id]
        concept["opening"] = edit["opening"]
        sequence = {"intro": concept}
        for i, shot in enumerate(case["shots"]):
            sequence[f"case{i+1}"] = {"type": "example", "title": shot["set"], "caseIndex": i,
                                      "lines": sentences(shot["voice"])}
            camera = edit.get("inspection", {}).get(str(i))
            if camera:
                sequence[f"case{i+1}"]["inspection"] = camera
        for key, index in zip(("a", "b"), edit["sections"], strict=True):
            slide = lesson["slides"][index]
            lines = list(slide["sentences"])
            for number, revised in edit.get("voiceEdits", {}).get(key, {}).items():
                lines[int(number)] = revised
            sequence[key] = {"type": "source", "title": slide["title"], "visual": slide,
                             "lines": lines, "sourceSlide": index}
        workshop = edit["workbench"]
        lab = {"type": "workbench", "title": " / ".join(workshop["stations"]),
               "stage": workshop["stage"], "stations": workshop["stations"], "marks": workshop["marks"],
               "illustration": workshop.get("illustration"), "lines": [], "beats": []}
        for beat in workshop["beats"]:
            lab["beats"].append({"label": beat["label"], "detail": beat["detail"], "cue": len(lab["lines"])})
            lab["lines"].extend(sentences(beat["voice"]))
        sequence["lab"] = lab
        if sorted(edit["sequence"]) != sorted(sequence):
            raise ValueError(f"Incomplete or repeated scene in {topic_id}")
        scenes = [sequence[key] for key in edit["sequence"]]
        films.append({"id": topic_id, "title": lesson["title"], "color": case["color"],
                      "source": path.relative_to(COURSE).as_posix(), "scenes": scenes})
    if set(plans) != set(direction) or set(plans) != {f["id"] for f in films}:
        raise ValueError("Teaching plans and topic videos must cover the same IDs")
    return films


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("work", type=Path)
    work = parser.parse_args().work
    work.mkdir(parents=True, exist_ok=True)
    films = assemble()
    (work / "scripts.json").write_text(json.dumps(films, ensure_ascii=False, indent=2), encoding="utf-8")
    titles = {film["id"]: film["title"] for film in films}
    (work / "topic-film-titles.json").write_text(json.dumps(titles, ensure_ascii=False, indent=2)+"\n",
                                               encoding="utf-8")
    draft = ["# Build Your First AI Agent", "", "## Beginner topic films", ""]
    for film in films:
        draft.extend([f"### {film['id']} · {film['title']}", "", f"Course source · {film['source']}", ""])
        for scene in film["scenes"]:
            draft.extend([f"**{scene['title']}**", "", " ".join(scene["lines"]), ""])
        if any(scene.get("illustration") for scene in film["scenes"]):
            draft.extend(["Illustration credit: Twemoji 12 by Twitter, Inc. and other contributors, resized and animated here. [Original artwork](https://github.com/twitter/twemoji/tree/v12.1.6/assets/svg) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).", ""])
    (work / "Topic video scripts.md").write_text("\n".join(draft), encoding="utf-8")
