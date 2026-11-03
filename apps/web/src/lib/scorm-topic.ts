import { z } from 'zod/v4';
import type { ConceptVideo, Course, ModuleContent, VideoQuiz, VideoSlide } from '@/data/types';

const text = z.string().max(100_000);
const id = z.string().regex(/^[A-Za-z0-9_-]+$/).max(160);
const Question = z.preprocess(value => {
  if (!value || typeof value !== 'object') return value;
  const q = value as Record<string, unknown>;
  if (q.type === 'single') return { ...q, type: 'mcq' };
  if (q.type === 'multiple') return { ...q, type: 'checkbox' };
  return q.type === undefined ? { ...q, type: Array.isArray(q.correct_answers) ? 'checkbox' : 'mcq' } : q;
}, z.object({ id, question: text, type: z.enum(['mcq', 'checkbox']), options: z.array(text).min(2).max(20), correct_answer: z.number().int().optional(), correct_answers: z.array(z.number().int()).optional(), explanation: text.default('') }).superRefine((q, ctx) => {
  const answers = q.type === 'mcq' ? [q.correct_answer] : q.correct_answers ?? [];
  if (!answers.length || new Set(answers).size !== answers.length || answers.some(i => i === undefined || i < 0 || i >= q.options.length)) ctx.addIssue({ code: 'custom', message: 'Invalid quiz answer indices' });
}));
const Quiz = z.object({ title: text.default('Knowledge check'), questions: z.array(Question).max(100).default([]) });
const SubConcept = z.object({ id, title: text, learning_content: text, bot_context: text.default(''), voicebot_context: text.default(''), image: text.nullish(), video: z.object({ src: text, type: z.enum(['local', 'embed']), durationSeconds: z.number().optional() }).nullish(), audio: z.array(z.object({ id, language: text, file: text, transcript: text })).max(10).default([]) });
export const ScormTopic = z.object({ topicId: id, title: text, description: text.default(''), courseId: text, courseName: id, moduleId: z.number().int().positive(), sourceVersion: z.number().int().nonnegative(), status: text, objectives: z.array(text).min(1).max(50), concepts: z.array(z.object({ id, title: text, sub_concepts: z.array(SubConcept).min(1).max(30), quiz: Quiz.optional() })).min(1).max(20), quiz: Quiz.optional(), tasks: z.array(z.object({ id, title: text, unlock_after: text.nullish(), steps: z.array(z.object({ title: text.default('Step'), instructions: text.default(''), description: text.default('') })).max(50) })).max(30).default([]) });
export type ScormTopicData = z.infer<typeof ScormTopic>;
export type ScormImport = { id: string; courseId: string; topicId: string; fingerprint: string; source: ScormTopicData; hierarchy: { num: number; topics: { topicId: string; title: string }[] }[]; active: boolean };

/** Explicitly choose the working draft; never persist ownership, tokens or arbitrary source fields. */
export function normalizeScormTopic(raw: Record<string, unknown>, courseName: string): ScormTopicData {
  const draft = raw.has_draft && raw.draft && typeof raw.draft === 'object' ? raw.draft as Record<string, unknown> : {};
  const data = { ...raw, ...draft };
  const content = (data.content ?? {}) as Record<string, unknown>;
  const match = /^(.+)-M(\d+)-T(\d+)$/.exec(String(data.topicId));
  if (!match || match[1] !== courseName) throw new Error('Topic ID does not match the selected course.');
  return ScormTopic.parse({ ...data, courseName, moduleId: Number(match[2]), sourceVersion: raw.version ?? 0, objectives: data.learning_objectives ?? content.learning_objectives });
}

export function scormCourseId(name: string) { return name === 'AIforProduction' ? 'ai-for-production' : `scorm-${name.toLowerCase()}`; }
const plain = (s: string) => s.replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*`_]/g, '').trim();
function chunks(s: string) {
  const sentences = plain(s).match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [plain(s)];
  const out: string[] = []; let current = '';
  for (const sentence of sentences) {
    // Long source paragraphs are split at word boundaries; no teaching is discarded.
    for (const word of sentence.trim().split(/\s+/)) {
      if (current.length + word.length > 650 && current) { out.push(current); current = ''; }
      current += (current ? ' ' : '') + word;
    }
  }
  if (current) out.push(current);
  return out.filter(Boolean);
}
export function scormQuestion(q: z.infer<typeof Question>): VideoQuiz {
  const base = { q: q.question, options: q.options, explain: q.explanation, hint: 'Review the lesson before trying again.' };
  return q.type === 'checkbox' ? { ...base, selectionType: 'multiple', correctIndices: q.correct_answers! } : { ...base, correct: q.correct_answer! };
}

/** Deterministic source conversion; the adaptive editor changes teaching prose only. */
export function scormDelivery(rows: ScormImport[]): { course: Course; modules: ModuleContent[] } | undefined {
  if (!rows.length) return;
  const head = rows[0]!; const courseId = head.courseId;
  const grouped = Map.groupBy(rows, r => r.source.moduleId);
  const modules: ModuleContent[] = [];
  for (const [number, items] of grouped) {
    const videos: ConceptVideo[] = [];
    for (const item of items) for (const concept of item.source.concepts) for (const sub of concept.sub_concepts) {
      const script = sub.audio.find(a => a.language === 'en')?.transcript || sub.learning_content;
      const narration = chunks(script);
      const slides: VideoSlide[] = narration.map(say => ({ kind: 'title', title: sub.title.slice(0, 100), icon: 'BookOpen', kicker: `${item.topicId} · ${concept.title}`.slice(0, 100), sub: plain(say).slice(0, 180), sentences: [say], narration: say }));
      // Split long source teaching into <=7-minute estimated clips, retaining its ancestry.
      const maxWords = 780; let group: VideoSlide[] = []; let words = 0; let part = 1;
      const flush = () => { if (!group.length) return; videos.push({ id: `${item.topicId}-${sub.id}-p${part}`, module: `M${number}`, lesson: `${item.topicId}-${sub.id}`, title: `${sub.title}${part > 1 ? ` · Part ${part}` : ''}`, notes: [plain(sub.learning_content)], quizAfter: null, slides: group, audio: group.map(() => ''), midQuiz: [], endQuiz: [] }); part++; group = []; words = 0; };
      for (const slide of slides) { const count = slide.narration.split(/\s+/).length; if (words + count > maxWords) flush(); group.push(slide); words += count; } flush();
      const last = videos.at(-1);
      if (last && sub === concept.sub_concepts.at(-1)) last.endQuiz = (concept.quiz?.questions ?? []).map(scormQuestion);
    }
    for (const item of items) {
      const last = videos.findLast(v => v.id.startsWith(`${item.topicId}-`));
      if (last) last.endQuiz.push(...(item.source.quiz?.questions ?? []).map(q => ({ ...scormQuestion(q), q: `Topic check: ${q.question}` })));
    }
    const objectives = items.flatMap(item => item.source.objectives.map((text, i) => ({ id: `${item.topicId}-O${i + 1}`, text, lesson: videos.find(v => v.id.startsWith(item.topicId))!.lesson })));
    const minutes = Math.ceil(videos.reduce((n, v) => n + v.slides.reduce((s, slide) => s + slide.narration.split(/\s+/).length, 0), 0) / 130);
    modules.push({ course_id: courseId, course_title: head.source.courseName, module_id: `M${number}`, version: rows.map(r => r.fingerprint).join('-'), locale: 'en', title: `Module ${number}`, summary: 'Imported teaching with learner-specific explanations and matching narration.', estimated_minutes: minutes, stages_included: ['explainer'], metadata: { objectives }, blocks: [{ stage: 'explainer', step_id: `M${number}.explain`, duration_min: minutes, bloom: 'understand', load: 'medium', objective_ids: objectives.map(o => o.id), concepts: [], segments: [], videos }] });
  }
  const course: Course = { importedRevisionId: head.id, course_id: courseId, slug: courseId, title: head.source.courseName === 'AIforProduction' ? 'AI for Production' : head.source.courseName, tagline: head.source.description, goal: head.source.description, domain: 'manufacturing', provider: 'Nebula KnowLab', level: 'Beginner', estimated_hours: modules.reduce((s, m) => s + m.estimated_minutes, 0) / 60, locales: ['en'], languages: [{ code: 'en', name: 'English', native: 'English' }], version: rows.map(r => r.fingerprint).join('-'), skills: head.source.concepts.map(c => c.title), learn: rows.flatMap(r => r.source.objectives), tools: [], modules: modules.map(m => ({ module_id: m.module_id, title: m.title, minutes: m.estimated_minutes, stages: ['explainer'], authored: ['explainer'], state: 'available', lite: false, pain: m.summary, lead_in: null, lessons: (m.blocks[0] as { videos: ConceptVideo[] }).videos.map(v => ({ id: v.lesson, title: v.title, notes: v.notes })), topics: [{ stage: 'explainer', title: 'Learn the ideas', summary: 'Personalized lessons from the imported source' }], outcomes: m.metadata.objectives.map(o => o.text), skills: [] })), finale: { title: 'Course finale', summary: 'Not included in this topic pilot.', steps: [] } };
  return { course, modules };
}
