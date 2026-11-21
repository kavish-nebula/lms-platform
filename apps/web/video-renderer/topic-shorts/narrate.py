"""Record the approved topic scripts with the local Kokoro Heart narrator."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path
import re
import wave

from kokoro_onnx import Kokoro
import numpy as np
import onnxruntime as ort
from phonemizer.backend import EspeakBackend


def load_voice(model_dir, threads):
    global narrator, phonemizer
    options = ort.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model_dir / "kokoro-v1.0.onnx"), options,
                                   providers=["CPUExecutionProvider"])
    narrator = Kokoro.from_session(session, str(model_dir / "voices-v1.0.bin"))
    phonemizer = EspeakBackend("en-us", preserve_punctuation=True, with_stress=True)


def record_line(line, path, ends_scene):
    # eSpeak reads AI and API as initialisms. Expand names with ambiguous spellings.
    names = {"SDK": "ess dee kay", "MCP": "em see pee", "ID": "eye dee", "JSON": "Jason"}
    spoken = re.sub(r"\b(SDK|MCP|ID|JSON)\b", lambda m: names[m[0]], line)
    phones = phonemizer.phonemize([spoken], strip=True)[0]
    audio, rate = narrator.create(phones, "af_heart", speed=0.84, is_phonemes=True)
    if rate != 24000 or not len(audio) or not np.isfinite(audio).all() or np.max(np.abs(audio)) < 0.01:
        raise ValueError(f"Unusable narration for {path.name}")
    # Let a question land and give the listener a beat at a change of scene.
    rest = 0.46 if line.rstrip().endswith("?") else 0.30
    if ends_scene:
        rest = 0.65
    with wave.open(str(path), "wb") as clip:
        clip.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        clip.writeframesraw((np.clip(audio, -1, 1) * 32767).round().astype("<i2").tobytes())
        clip.writeframesraw(bytes(2 * round(rest * rate)))
    return len(audio) / rate + rest


def record(task):
    film, output = task
    duration = 0
    for i, scene in enumerate(film["scenes"]):
        for j, line in enumerate(scene["lines"]):
            path = output / f"{film['id']}-{i}-{j}.wav"
            duration += record_line(line, path, j == len(scene["lines"]) - 1)
    print(f"{film['id']}  {duration:.2f}s", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("work", type=Path)
    parser.add_argument("model_dir", type=Path)
    parser.add_argument("--topics", nargs="+")
    parser.add_argument("--jobs", type=int, default=2)
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()
    films = json.loads((args.work / "scripts.json").read_text(encoding="utf-8"))
    output = args.work / "voice"
    output.mkdir(parents=True, exist_ok=True)
    tasks = [(f, output) for f in films if not args.topics or f["id"] in args.topics]
    if args.topics and set(args.topics) - {f["id"] for f in films}:
        parser.error("Unknown topic ID")
    with ProcessPoolExecutor(max_workers=args.jobs, initializer=load_voice,
                             initargs=(args.model_dir, args.threads)) as pool:
        list(pool.map(record, tasks))
