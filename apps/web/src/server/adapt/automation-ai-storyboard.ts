import { AUTOMATION_AI_SOURCE, automationCase } from '@/lib/automation-ai-lesson';
import type { ConceptScene } from '@/lib/personalized-concept';
import type { DirectedChapter } from './visual-director';

/** Exact sentence anchors are aligned to speech, never estimated from word count. */
export function automationAiStoryboard(scenes: ConceptScene[]): DirectedChapter[] | undefined {
  if (![7,8].includes(scenes.length) || scenes.some(s => !s.sourceIds.includes(AUTOMATION_AI_SOURCE))) return undefined;
  const opening = scenes[0].narration;
  const field = /clinic/.test(opening) ? 'Healthcare' : /accounts payable/.test(opening) ? 'Finance' : /course administration/.test(opening) ? 'Education' : /factory support/.test(opening) ? 'Production' : '';
  const c = automationCase({ answers: { field } });
  const alternate = c.alternate.split(' ').slice(0, 5).join(' ') + '…';
  const spec: {kind: DirectedChapter['kind']; title: string; labels: string[]; second: string}[] = [
    {kind:'method-comparison',title:'Same automatic outcome. Different mechanism.',labels:['People write rules','Rules → action','Patterns learned from data','Model → suggestion'],second:'AI uses patterns learned from data'},
    {kind:'rule-router',title:'A written condition controls the route',labels:[c.object,c.phrase,'Phrase found','Review queue','Other wording'],second:'A differently worded request may miss'},
    {kind:'intent-model',title:'Different words can express the same intent',labels:[c.phrase,alternate,c.category,'Learned language patterns','Check the suggestion'],second:'Staff check the proposed category'},
    {kind:'fixed-cooler',title:'Source machine: the rule stays fixed',labels:['Temperature sensor','Above 70 degrees','Cooling on','Unchanged trigger'],second:'If the coolant ages but'},
    {kind:'request-comparison',title:'One request, two ways to process it',labels:[alternate,'Exact phrase missing','Manual review','Learned patterns',c.category,'Check prediction'],second:'The AI path interprets'},
    {kind:'reviewed-workflow',title:'AI assists. People review. Automation routes.',labels:['Incoming message','AI draft','Human review','Approved routing'],second:'Fixed rule automation then routes'},
    {kind:'mechanism-recap',title:'Identify the mechanism, not just the outcome',labels:['Order confirmed','Send receipt','Written condition','Varied messages','Interpret intent','Learned patterns'],second:'Interpreting differently worded messages using'},
  ];
  if (scenes.length === 8) {
    spec[3]={kind:'stopped-line',title:'An unexpected input has no matching instruction',labels:['Expected: 10 centimeters','Oversized part','Programmed path','Sequence stops'],second:'When an unexpected oversized part enters'};
    spec.splice(4,0,{kind:'threshold-prediction',title:'A written threshold versus an uncertain estimate',labels:['Above 50 pounds','Reject part','Heat · vibration · weight','92 percent estimate','Illustrative, not verified'],second:'By contrast an AI model considers'});
  }
  const starts = [
    ['Two systems','Fixed-rule automation','AI uses','The difference'],
    ['Our simple rule','That is fixed-rule','A differently worded'],
    ['A trained language','Its suggestion can','Staff check'],
    scenes.length===8?['The source production','When an unexpected','A different automation','The key distinction']:['Its fixed rule','If the coolant','Changing conditions','AI could examine'],
    ...(scenes.length===8?[['In the source example','By contrast','The source also','People must']]:[]),
    ['The fixed rule','The AI path','Neither label'],
    ['AI suggests','Fixed-rule automation then'],
    ['Sending a receipt','Interpreting differently','A workflow can'],
  ];
  return spec.map((s, i) => ({ ...(['intent-model','request-comparison'].includes(s.kind)?{example:{message:c.alternate,...(s.kind==="request-comparison"?{rule:c.phrase}:{}),category:c.category}}:{}), sceneId: scenes[i].id, kind: s.kind, title: s.title, labels: s.labels, visualKey:`automation-ai-reference-v2-${i}-${field || 'support'}`, purpose: `Illustrate ${s.title.toLowerCase()} using only the creator's narrated explanation.`, cues: starts[i].map((start,j)=>{
    const sentence=scenes[i].narration.split(/(?<=[.!?])\s+/).find(text=>text.startsWith(start));
    if(!sentence)throw Error('Missing authored visual anchor: '+start);
    const short=starts[i].length<4 && i!==spec.length-1;
    const target=short?(j===0?'primary':j===1?(starts[i].length===2?'result':'detail'):'result'):(['primary','secondary','detail','result'] as const)[j];
    return {withTargets:short&&j===0?['secondary']:short&&starts[i].length===2&&j===1?['detail']:[],phrase:s.kind==='threshold-prediction'&&j===1?'chance of a defect':sentence.split(/\s+/).slice(0,6).join(' '),action:j===0?'reveal' as const:'change' as const,target,description:'Advance the demonstrated mechanism at this exact narrated sentence, then hold for reading.'};
  }) }));
}
