const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(id => mocks[id] ?? require(id), mod, mod.exports);
  return mod.exports;
}
const { restoreContinuousResume, firstUnplayedConceptTime } = load('src/lib/continuous-concept.ts');
const playback = { durationSeconds: 60, checkpointSeconds: 30, segments: [{ startSeconds: 0, endSeconds: 20 }, { startSeconds: 20, endSeconds: 40 }, { startSeconds: 40, endSeconds: 60 }] };
const saved = changes => ({ version: 2, seconds: 60, ranges: [[0, 60]], checkpointDone: true, endCheckDone: false, ...changes });

test('refresh at the end recovers a fully watched opening without requiring another replay', () => {
  assert.equal(restoreContinuousResume(saved({}), null, playback, false, false).endCheckDone, true);
});
test('seeking to the end never completes skipped teaching', () => {
  const result = restoreContinuousResume(saved({ ranges: [[0, 20]] }), null, playback, false, false);
  assert.equal(result.endCheckDone, false);
  assert.equal(firstUnplayedConceptTime(playback, result.ranges), 20);
});
test('resume cannot bypass midpoint or final source checks', () => {
  assert.equal(restoreContinuousResume(saved({ checkpointDone: false }), null, playback, true, false).endCheckDone, false);
  assert.equal(restoreContinuousResume(saved({}), null, playback, true, true).endCheckDone, false);
  assert.equal(restoreContinuousResume(saved({ endCheckDone: true }), null, playback, true, true).endCheckDone, true);
  assert.equal(firstUnplayedConceptTime(playback, [[0, 60]]), null);
});
test('a part-watched resume does not become complete merely because its coverage is present', () => {
  assert.equal(restoreContinuousResume(saved({ seconds: 20 }), null, playback, false, false).endCheckDone, false);
});
test('released hooks unlock explicit navigation after playback without auto-routing', () => {
  let ready = false, navigated = 0;
  const Shell = () => null, Film = () => null;
  const { ReleasedHookStage } = load('src/components/player/stages/released-hook-stage.tsx', {
    react: { ...React, useState: () => [ready, value => { ready = value; }] },
    '../stage-shell': { StageShell: Shell },
    '../video/released-visual-lesson': { ReleasedVisualLesson: Film },
  });
  const props = { module: { course_id: 'course', module_id: 'M1', title: 'Opening', remotionHook: { endpoint: '/released' } }, nextLabel: 'Next: Understand AI', onComplete: () => { navigated++; } };
  let stage = ReleasedHookStage(props);
  assert.equal(stage.type, Shell);
  assert.equal(stage.props.canComplete, false);
  assert.equal(stage.props.completeLabel, 'Next: Understand AI');
  stage.props.children.props.onComplete();
  assert.equal(navigated, 0, 'The video callback only unlocks the next action.');
  stage = ReleasedHookStage(props);
  assert.equal(stage.props.canComplete, true);
  stage.props.onComplete();
  assert.equal(navigated, 1);
  ready = false;
  assert.equal(ReleasedHookStage({ ...props, done: true }).props.canComplete, true, 'Existing progress does not require another viewing.');
});
