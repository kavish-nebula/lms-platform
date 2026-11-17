"""Run with the adaptive-api venv, from apps/web, after regeneration."""
import json
import subprocess
import sys
import wave
from pathlib import Path

import av
import numpy as np

pilot = '--pilot' in sys.argv
file = Path('.data/reference-pilot-results.json' if pilot else '.data/reference-regeneration-results.json')
results = []
rows = json.loads(file.read_text())
if not rows:
    raise SystemExit('No rendered lessons to verify.')
for row in rows:
    if row['status'] != 'ready':
        results.append(row)
        continue
    directory = Path('.data/chalkboard-video') / row['enrollment'] / row['module'] / row['key']
    manifest = json.loads((directory / 'manifest.json').read_text())
    quality = json.loads((directory / 'visual-quality.json').read_text())
    alignment = json.loads((directory / 'alignment-report.json').read_text())
    with av.open(str(directory / 'final.mp4')) as video:
        duration = video.duration / av.time_base
        assert {'audio', 'video'} <= {s.type for s in video.streams}
    assert abs(duration - row['duration']) < .2
    assert quality['fullDecodePassed'] is True
    assert alignment['minimumSourceCoverage'] >= .82
    assert len(list((directory / 'qa').glob('chapter-*.png'))) == alignment['chapters']
    raw = subprocess.run([manifest['ffmpeg'], '-v', 'error', '-i', str(directory / 'final.mp4'), '-map', '0:a:0', '-ac', '1', '-ar', '24000', '-f', 'f32le', '-'], check=True, stdout=subprocess.PIPE).stdout
    decoded = np.frombuffer(raw, dtype=np.float32)
    with wave.open(manifest['audio'], 'rb') as source:
        expected = np.frombuffer(source.readframes(source.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    count = min(len(decoded), len(expected))
    correlation = float(np.corrcoef(decoded[:count:20], expected[:count:20])[0, 1])
    assert correlation > .98
    results.append({**row, 'measuredSeconds': duration, 'audioCorrelation': correlation,
                    'sourceCoverage': alignment['minimumSourceCoverage'], 'verified': True})
destination = Path('.data/reference-pilot-verification.json' if pilot else '.data/reference-regeneration-verification.json')
destination.write_text(json.dumps(results, indent=2))
print(json.dumps({'verified': sum(r.get('verified', False) for r in results), 'total': len(results), 'report': str(destination)}))
if not all(r.get('verified') for r in results):
    raise SystemExit(1)
