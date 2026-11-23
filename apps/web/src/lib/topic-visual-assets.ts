import { z } from 'zod/v4';
import type { ConceptScene } from './personalized-concept';

// Coordinates are fractions of the *standard* frame. A creator selects the
// teaching illustration once; player chrome and burned-in captions stay out.
const crop = z.object({ x:z.number().min(0).lt(1), y:z.number().min(0).lt(1), width:z.number().min(.05).max(1), height:z.number().min(.05).max(1) }).strict()
  .refine(r => r.x + r.width <= 1 && r.y + r.height <= 1, 'Crop must be inside the recording.');
export const TopicVisualLibrary = z.object({
  recordingSha256: z.string().regex(/^[a-f0-9]{64}$/),
  frames: z.array(z.object({
    id: z.string().regex(/^[\w-]{1,80}$/), label: z.string().trim().min(1).max(120),
    seconds: z.number().nonnegative().max(7200), crop,
    spokenPhrase: z.string().trim().min(4).max(150).refine(s => normalized(s).split(' ').length >= 2),
    field: z.string().trim().min(1).max(80).optional(),
    partId: z.string().regex(/^[\w-]{1,80}$/).optional(),
  }).strict()).min(1).max(20),
}).strict().refine(v => new Set(v.frames.map(f => f.id)).size === v.frames.length, 'Use distinct frame IDs.');
export type TopicLibrary = z.infer<typeof TopicVisualLibrary>;
export type TopicFrame = TopicLibrary['frames'][number];
export type SelectedVisual = { id:string; label:string; sentence:string; image:string };

// Both published editions use this same recording. These crops were checked
// against its actual frames; a new edit with the same title cannot inherit them.
export const automationFrames: TopicLibrary = {
  recordingSha256:'f6a5caac4fcc64e06c3024d2f8010ff251aece96c4726283b9fb2fc0ca2a2fee',
  frames:[
    {id:'plc-ladder', label:'Programmed ladder logic on a controller', seconds:32, crop:{x:.09,y:.01,width:.69,height:.89}, spokenPhrase:'programmable logic controller'},
    {id:'logic-path', label:'A stopped step in the programmed sequence', seconds:66.5, crop:{x:.19,y:.01,width:.62,height:.90}, spokenPhrase:'logic sequence stops'},
    {id:'aging-coolant', label:'Coolant in the machine circuit', seconds:115, crop:{x:.03,y:.02,width:.90,height:.87}, spokenPhrase:'if the coolant ages'},
  ],
};

function normalized(s: string) { return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function spokenSentences(text: string) { return text.trim().split(/(?<=[.!?])\s+/).filter(Boolean); }

export function framesForRecording(library:TopicLibrary, hash:string) {
  return library.recordingSha256 === hash ? library.frames : [];
}

export function matchTopicFrames(frames:TopicFrame[], scenes:ConceptScene[], field:string) {
  const selections: {sceneId:string; sentence:string; frame:TopicFrame}[] = [];
  const used = new Set<string>();
  for (const scene of scenes) {
    const sentences = [...spokenSentences(scene.narration), ...spokenSentences(scene.bridge)];
    for (const [script, bridge] of [[scene.narration,false],[scene.bridge,true]] as const) {
      for (const sentence of spokenSentences(script)) {
        if (sentences.indexOf(sentence) !== sentences.lastIndexOf(sentence)) continue;
        const speech = ' ' + normalized(sentence) + ' ';
        const candidates = frames.filter(f => (!f.partId || scene.id.replace(/-concept-\d+$/, '') === f.partId)
          && (!bridge || f.field) && (!f.field || normalized(f.field) === normalized(field))
          && speech.includes(' ' + normalized(f.spokenPhrase) + ' '));
        const specific = candidates.filter(f => f.field);
        const eligible = specific.length ? specific : candidates;
        // Two equally applicable pictures require a more specific author cue.
        if (eligible.length !== 1 || used.has(eligible[0].id)) continue;
        const frame = eligible[0];
        selections.push({ sceneId:scene.id, sentence, frame });
        used.add(frame.id);
      }
    }
  }
  return selections;
}
