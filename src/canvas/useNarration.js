/* Sentence splitting + shared narration text utilities. */
export function splitSentences(text) {
  if (!text) return []
  return text.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) || []
}
