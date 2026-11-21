/** Original Twemoji 12 artwork, also published on Wikimedia Commons. */
export const illustrations = {
  robot: "1f916", parcel: "1f4e6", brain: "1f9e0", laptop: "1f4bb",
  memory: "1f5c4", tool: "1f527", chat: "1f4ac", search: "1f50d",
  map: "1f5fa", shield: "1f6e1", chart: "1f4ca", link: "1f517",
  mail: "1f4e8", book: "1f4d6", clock: "23f1", target: "1f3af",
} as const;
type Art = keyof typeof illustrations;
const subjects: [Art, RegExp][] = [
  ["parcel", /\b(parcel|order|orders|shipping|package|stock|warehouse|tracking)\b/i],
  ["shield", /\b(safe\w*|shield|guardrail\w*|permission\w*|lock|key|secret\w*)\b/i],
  ["search", /\b(search|retriev\w*|look up|lookup|find|inspect)\b/i],
  ["memory", /\b(memory|database|history|storage|context|folder|records?)\b/i],
  ["link", /\b(api|plug|connect\w*|network|webhook|link)\b/i],
  ["mail", /\b(mail|email|inbox|ticket\w*|send)\b/i],
  ["laptop", /\b(code|python|json|terminal|install|debug\w*|deploy\w*|server|laptop)\b/i],
  ["clock", /\b(clock|timer|latency|timeout|deadline|wait)\b/i],
  ["chart", /\b(chart|gauge|cost|measure\w*|evaluat\w*|metric\w*|performance)\b/i],
  ["map", /\b(plan\w*|map|route|path|workflow|split|branch)\b/i],
  ["brain", /\b(brain|think\w*|decid\w*|llms?|model\w*|reason\w*)\b/i],
  ["tool", /\b(tool\w*|wrench|build\w*|calculator|fix)\b/i],
  ["chat", /\b(chat\w*|message|reply|conversation|ask|prompt\w*|user)\b/i],
  ["book", /\b(book|read\w*|document\w*|lesson|reference)\b/i],
  ["target", /\b(target|goal\w*|scope|objective\w*)\b/i],
  ["robot", /\b(agent\w*|bot|scout|robot)\b/i],
];

export function artwork(text: string, fallback: Art): Art {
  return subjects.find(([, pattern]) => pattern.test(text))?.[0] ?? fallback;
}

export function sentenceStarts(sentences: string[]) {
  const total = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
  let offset = 0;
  return sentences.map(s => {
    const start = offset / total;
    offset += s.length;
    return start;
  });
}
