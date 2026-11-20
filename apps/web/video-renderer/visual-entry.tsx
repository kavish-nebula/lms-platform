import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { VisualLessonComposition } from '../src/components/video/visual-lesson-composition';
import { automationVisualSeed, visualTimeline, VISUAL_FPS, type VisualLessonData } from '../src/lib/visual-lesson';

const preview = visualTimeline(automationVisualSeed(['Source1'], 'Automation follows fixed rules. AI uses patterns learned from data. A system can combine both methods with human oversight.'));
const reference:VisualLessonData={title:'A polished draft, an unsupported promise',style:'reference-cinema',scenes:[
  {id:'Opening',title:'A polished draft arrives',kind:'workspace',sourceIds:['Source1'],evidence:'The notes propose a demonstration. The draft calls it a confirmed launch.',holdSeconds:3,beats:[
    {id:'Opening1',label:'Read the notes',narration:'The fictional team proposes a Thursday demonstration. No launch date is approved.',visual:{heading:'Source notes',detail:'Thursday demonstration: proposed.',icon:'document',status:'neutral'}},
    {id:'Opening2',label:'Inspect the draft',narration:'The assistant changes that proposal into a confirmed launch. The draft sounds helpful, but its promise is unsupported.',visual:{heading:'Assistant draft',detail:'Thursday launch: confirmed.',icon:'message',status:'warning'}},
  ]},
  {id:'Evidence',title:'Follow the evidence',kind:'document',sourceIds:['Source1'],evidence:'The notes propose a demonstration. The draft calls it a confirmed launch.',holdSeconds:3,beats:[
    {id:'Evidence1',label:'Find the mismatch',narration:'Compare the proposed demonstration with the confirmed launch. Both the event and its status have changed.',visual:{heading:'Two changes',detail:'Demonstration → launch. Proposed → confirmed.',icon:'question',status:'warning'}},
    {id:'Evidence2',label:'Correct the commitment',narration:'Return to the source and preserve its uncertainty. A confident tone does not replace evidence.',visual:{heading:'Source-based correction',detail:'The Thursday demonstration is proposed.',icon:'check',status:'success'}},
  ]},
  {id:'Review',title:'Give the reviewer a clear path',kind:'journey',sourceIds:['Source1'],evidence:'The notes propose a demonstration. The draft calls it a confirmed launch.',holdSeconds:3,beats:[
    {id:'Review1',label:'Inspect',narration:'Inspect each important claim against its source.',visual:{heading:'Inspect the claim',detail:'Which exact note supports it?',icon:'document',status:'neutral'}},
    {id:'Review2',label:'Review',narration:'Correct unsupported promises before a person reviews the draft.',visual:{heading:'Human review',detail:'Keep proposals, agreements and unknowns separate.',icon:'person',status:'success'}},
  ]},
]};
const referencePreview=visualTimeline(reference);
const Root = () => <><Composition id="TextToVisualLesson" component={VisualLessonComposition} width={1280} height={720} fps={VISUAL_FPS} durationInFrames={preview.durationInFrames} defaultProps={preview} calculateMetadata={({props})=>({durationInFrames:props.durationInFrames})}/><Composition id="ReferenceStylePreview" component={VisualLessonComposition} width={1280} height={720} fps={VISUAL_FPS} durationInFrames={referencePreview.durationInFrames} defaultProps={referencePreview} calculateMetadata={({props})=>({durationInFrames:props.durationInFrames})}/></>;
registerRoot(Root);
