import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceFrameWindows} from './source-frames.mjs';

test('source frames use aligned speech inside their own scene and stop at its boundary', () => {
  const visual = {id:'controller',sentence:'Follow the programmed sequence.'};
  const scenes = [{id:'part-2',selectedVisuals:[visual]}];
  const segments = [{sceneId:'part-2',startSeconds:10,endSeconds:16}];
  const captions = [
    {caption:visual.sentence,start:4,end:7},
    {caption:visual.sentence,start:12.4,end:16.5},
  ];
  assert.deepEqual(sourceFrameWindows(scenes,segments,captions),[{visual,start:12.4,end:16}]);
  assert.deepEqual(sourceFrameWindows(scenes,segments,[captions[0]]),[]);
  assert.deepEqual(sourceFrameWindows(scenes,segments,[{...captions[1],caption:'A different example.'}]),[]);
});
