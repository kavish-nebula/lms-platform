// Narration for adapted lessons, with Kokoro (kokoro-js, on the CPU). Run by
// src/server/adapt/tts.ts as its own process, so synthesis never blocks the
// web server. Reads one job from stdin:
//   { "voice": "am_michael", "clips": [{ "text": "...", "out": "C:/.../s0.wav" }] }
// and writes each clip as a 16-bit mono WAV, printing "ok <out>" or
// "fail <out> <reason>" per clip, then "done". The model is downloaded on first
// use and cached by transformers.js.
//
// Device: KOKORO_DEVICE (default "cpu"; "dml" is DirectML on a Windows GPU,
// "cuda" an NVIDIA GPU on Linux) and KOKORO_DTYPE (default "fp32"). Measured on
// an i5-14400: fp32 on the CPU runs at about 4.4x real time, q8 at only 1.6x
// (de-quantising costs more than it saves). DirectML on Intel UHD graphics
// can't run Kokoro's ConvTranspose layers, so a GPU that fails a warm-up line
// falls back to the CPU.
import fs from "node:fs";
import path from "node:path";
import { KokoroTTS } from "kokoro-js";
import { AutoTokenizer, StyleTextToSpeech2Model } from '@huggingface/transformers';
import { synthesizeNarration } from './tts-chunks.mjs';

const MODEL = process.env.KOKORO_MODEL ?? "onnx-community/Kokoro-82M-v1.0-ONNX";
const DEVICE = process.env.KOKORO_DEVICE ?? "cpu";
const DTYPE = process.env.KOKORO_DTYPE ?? "fp32";

async function loadCpu() {
  const dtype = DEVICE === 'cpu' ? DTYPE : 'fp32';
  if (!job.chunkLong) return KokoroTTS.from_pretrained(MODEL, { dtype, device: 'cpu' });
  // Several long-form video jobs can run together. Automatic per-session
  // thread pools otherwise compete for the same cores and waste batch time.
  const threads = Number(process.env.KOKORO_CPU_THREADS ?? 2);
  if (!Number.isInteger(threads) || threads < 0 || threads > 64) throw new Error('KOKORO_CPU_THREADS must be an integer from 0 to 64.');
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(MODEL, { dtype, device: 'cpu', session_options: { intraOpNumThreads: threads, interOpNumThreads: 1 } }),
    AutoTokenizer.from_pretrained(MODEL),
  ]);
  return new KokoroTTS(model, tokenizer);
}

async function load() {
  if (DEVICE !== "cpu") {
    try {
      const gpu = await KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: DEVICE });
      await gpu.generate("Ready.", { voice: job.voice ?? "am_michael" });
      return gpu;
    } catch (e) {
      console.error(`kokoro: ${DEVICE}/${DTYPE} failed (${String(e?.message ?? e).slice(0, 160)}); using the CPU`);
    }
  }
  return loadCpu();
}

function wav16(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const input = await new Promise((resolve) => {
  let s = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (s += c));
  process.stdin.on("end", () => resolve(s));
});
const job = JSON.parse(input);
const tts = await load();

for (const clip of job.clips) {
  try {
    const audio = job.chunkLong ? await synthesizeNarration(tts, clip.text, job.voice ?? 'am_michael') : await tts.generate(clip.text, { voice: job.voice ?? "am_michael" });
    fs.mkdirSync(path.dirname(clip.out), { recursive: true });
    const tmp = `${clip.out}.part`;
    fs.writeFileSync(tmp, wav16(audio.audio, audio.sampling_rate));
    fs.renameSync(tmp, clip.out);
    console.log(`ok ${clip.out}`);
  } catch (e) {
    console.log(`fail ${clip.out} ${String(e?.message ?? e).replace(/\s+/g, " ").slice(0, 200)}`);
  }
}
console.log("done");
