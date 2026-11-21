import type { VideoSlide } from "@/data/types";

// Opening cuts follow the narrator's sentences. Each number selects a demonstration
// from that lesson, so its people, examples and results also appear in the main film.
const openingCuts: Record<string, readonly number[]> = {
  "What is an AI agent?": [1, 1, 4, 1],
  "Agents vs. chatbots vs. workflows": [2, 3, 4],
  "Real-world use cases of AI agents": [2, 1, 5],
  "Core components: LLM, tools, memory, planning": [4, 1, 3],
  "Setting up your development environment": [2, 4, 5, 6],
  "How large language models work": [1, 6, 1, 3],
  "Choosing a model and API setup": [4, 1, 5],
  "Prompt engineering essentials": [1, 3, 4],
  "System prompts and role design": [3, 2, 4],
  "Structured outputs (JSON, schemas)": [1, 4, 3],
  "What is tool calling?": [3, 1, 3, 4],
  "Defining and registering tools": [2, 1, 5],
  "Building tools: web search, calculator, file access": [1, 4, 5],
  "Connecting external APIs": [2, 1, 3],
  "Handling tool errors and edge cases": [1, 2, 5],
  "Short-term vs. long-term memory": [1, 3, 5],
  "Managing conversation context": [4, 2, 6],
  "Retrieval-Augmented Generation (RAG) basics": [1, 1, 3],
  "Planning and task decomposition": [3, 1, 4],
  "The agent loop: think, act, observe (ReAct)": [3, 2, 5],
  "Project scoping and architecture design": [4, 5, 1, 2],
  "Building the agent step by step": [1, 3, 2],
  "Adding tools and memory to the project": [2, 3, 4],
  "Testing and debugging the agent": [5, 2, 4],
  "Evaluating agent performance": [2, 5, 6],
  "Safety, guardrails and responsible AI": [1, 2, 4, 3],
  "Cost, latency and monitoring": [5, 2, 7],
  "Deploying the agent (web app or API)": [5, 3, 6],
  "Intro to multi-agent systems and frameworks": [1, 2, 3],
  "Course recap and next learning path": [3, 2, 6],
};

export function selectCut(slide: VideoSlide, chapters: VideoSlide[], topic: string, cue: number) {
  if (slide.kind === "title") {
    const plan = openingCuts[topic];
    const selected = plan?.[Math.min(cue, plan.length - 1)];
    const cut = selected === undefined ? chapters[1] : chapters[selected];
    if (cut && cut.kind !== "title" && cut.kind !== "recap") return cut;
  }
  if (slide.kind === "recap") {
    // Revisit the demonstration with the most vocabulary in common with the point.
    const words = new Set((slide.points.filter(p => p.cue <= cue).at(-1)?.text ?? slide.sentences[cue] ?? "")
      .toLowerCase().match(/[a-z]{4,}/g)?.filter(w => !["with","that","this","your","then","when","from","they","what","have","scout"].includes(w)));
    let best: VideoSlide | undefined;
    let high = 0;
    for (const chapter of chapters) {
      if (chapter.kind === "title" || chapter.kind === "recap") continue;
      const tokens = new Set((chapter.title + " " + chapter.narration).toLowerCase().match(/[a-z]{4,}/g));
      const score = [...words].filter(w => tokens.has(w)).length;
      if (score > high) { high = score; best = chapter; }
    }
    return best;
  }
}
