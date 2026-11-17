import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Lesson } from './lesson';

const Root = () => <Composition id="PersonalizedLesson" component={Lesson} durationInFrames={336} fps={24} width={1280} height={720} defaultProps={{title:'Inspect a source record',manim:'',durationSeconds:14,chapters:[{sceneId:'preview',title:'Follow the evidence before acting',kind:'source-inspection',visualKey:'synthetic-record-inspection',purpose:'Preview the visual grammar with a fictional record.',labels:['Source record','Inspect the field','Compare with evidence','Human review'],start:0,end:14,cues:[{phrase:'Inspect the source record',action:'reveal',target:'primary',description:'Show the source document.',seconds:0},{phrase:'Look at the field',action:'reveal',target:'secondary',description:'Inspect a field.',seconds:4},{phrase:'Compare with the evidence',action:'compare',target:'detail',description:'Connect the evidence.',seconds:8}]}]}} calculateMetadata={({props})=>({durationInFrames:Math.ceil(props.durationSeconds*24)})}/>;
registerRoot(Root);
