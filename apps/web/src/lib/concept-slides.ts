import { conceptNarration, type ConceptScene } from './personalized-concept';

export type ConceptSlide = { text: string; context: boolean; startWord: number; endWord: number };
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** Presentation only: never rewrite teaching, request speech or alter quiz boundaries.
 * Word weighting approximates timing within measured audio, not forced alignment. */
export function conceptSlides(scene: ConceptScene): ConceptSlide[] {
  const slides: ConceptSlide[] = [];
  let position = 0;
  for (const [text, context] of [[scene.narration, false], [scene.bridge, true]] as const) {
    const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    let pending: string[] = [];
    const flush = () => {
      if (!pending.length) return;
      slides.push({ text: pending.join(' '), context, startWord: position, endWord: position + pending.length });
      position += pending.length;
      pending = [];
    };
    for (const sentence of sentences) {
      const tokens = words(sentence);
      if (pending.length + tokens.length > 34) flush();
      for (const token of tokens) {
        pending.push(token);
        if (pending.length === 34) flush();
      }
    }
    flush();
  }
  return slides;
}

export function conceptSlideAt(slides: ConceptSlide[], seconds: number, duration: number) {
  if (!slides.length || !Number.isFinite(duration) || duration <= 0) return 0;
  const word = Math.max(0, Math.min(1, Number.isFinite(seconds) ? seconds / duration : 0)) * slides.at(-1)!.endWord;
  const index = slides.findIndex(slide => word < slide.endWord);
  return index < 0 ? slides.length - 1 : index;
}

export function conceptSlideDuration(scene: ConceptScene, measured: number) {
  return Number.isFinite(measured) && measured > 0 ? measured : words(conceptNarration(scene)).length / 2.2;
}
