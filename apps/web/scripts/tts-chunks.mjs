/** Bound English narration chunks before tokenization; preserve every word. */
export function narrationChunks(text, limit = 240) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.split(' ').some(word => word.length > limit || /\d{16,}/.test(word))) throw new Error('Rewrite oversized tokens or digit sequences as spoken narration.');
  const chunks = []; let current = '';
  for (const sentence of normalized.split(/(?<=[.!?])\s+/)) {
    if (sentence.length <= limit) {
      if (current && current.length + sentence.length + 1 > limit) { chunks.push(current); current = ''; }
      current += (current ? ' ' : '') + sentence;
    } else {
      if (current) { chunks.push(current); current = ''; }
      for (const word of sentence.split(' ')) {
        if (word.length > limit || /\d{16,}/.test(word)) throw new Error('Rewrite oversized tokens or digit sequences as spoken narration.');
        if (current && current.length + word.length + 1 > limit) { chunks.push(current); current = ''; }
        current += (current ? ' ' : '') + word;
      }
    }
  }
  if (current) chunks.push(current);
  if (chunks.join(' ') !== normalized) throw new Error('Narration chunk alignment failed.');
  return chunks;
}

export async function synthesizeNarration(tts, text, voice) {
  const segments = [];
  for (const chunk of narrationChunks(text)) {
    const audio = await tts.generate(chunk, { voice });
    if (!audio.audio.length || audio.sampling_rate !== 24000) throw new Error('Invalid speech segment.');
    segments.push(audio.audio);
  }
  const samples = new Float32Array(segments.reduce((n, s) => n + s.length, 0));
  let offset = 0; for (const segment of segments) { samples.set(segment, offset); offset += segment.length; }
  return { audio: samples, sampling_rate: 24000 };
}
