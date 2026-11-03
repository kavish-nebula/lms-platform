const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../public/course-packages/scorm-runtime.js'), 'utf8');

function launch(state = { version: 1, cmi: {}, storage: {} }) {
  const messages = [], listeners = {};
  const parent = { postMessage: m => messages.push(m) };
  const window = { __LMS_SCORM_BOOTSTRAP__: { token: 'session', state } };
  const context = { window, parent, setTimeout, clearTimeout, addEventListener: (key, handler) => { listeners[key] = handler; } };
  vm.runInNewContext(code, context);
  return { api: window.API_1484_11, window, parent, messages, listeners };
}

test('SCORM state survives reopening, with scoped package preferences and notes', () => {
  const one = launch();
  assert.equal(one.api.GetValue('cmi.location'), '');
  assert.equal(one.api.GetLastError(), '122');
  assert.equal(one.api.Initialize(''), 'true');
  assert.equal(one.api.SetValue('cmi.location', 'concept-2'), 'true');
  assert.equal(one.api.SetValue('cmi.suspend_data', JSON.stringify({ completedConcepts: ['concept-1'] })), 'true');
  one.window.localStorage.setItem('notes', 'Review the supplied SOP');
  assert.equal(one.api.Commit(''), 'true');
  const two = launch(one.messages.at(-1).state);
  assert.equal(two.api.Initialize(''), 'true');
  assert.equal(two.api.GetValue('cmi.entry'), 'resume');
  assert.equal(two.api.GetValue('cmi.location'), 'concept-2');
  assert.equal(two.window.localStorage.getItem('notes'), 'Review the supplied SOP');
  assert.deepEqual(JSON.parse(two.api.GetValue('cmi.suspend_data')), { completedConcepts: ['concept-1'] });
});

test('SCORM lifecycle, read-only identity and dynamic interaction counts', () => {
  const { api } = launch();
  assert.equal(api.Initialize(''), 'true');
  assert.equal(api.Initialize(''), 'false');
  assert.equal(api.SetValue('cmi.learner_id', 'other-user'), 'false');
  assert.equal(api.SetValue('outside.key', 'value'), 'false');
  assert.equal(api.SetValue('cmi.interactions.0.id', 'q1'), 'true');
  assert.equal(api.SetValue('cmi.interactions.0.result', 'correct'), 'true');
  assert.equal(api.GetValue('cmi.interactions._count'), '1');
  assert.equal(api.SetValue('cmi.completion_status', 'completed'), 'true');
  assert.equal(api.SetValue('cmi.score.raw', '80'), 'true');
  assert.equal(api.Terminate(''), 'true');
  assert.equal(api.Commit(''), 'false');
});

test('only the matching parent save message can flush state', () => {
  const x = launch();
  x.listeners.message({ source: {}, data: { protocol: 'lms-scorm-save', token: 'session' } });
  assert.equal(x.messages.length, 0);
  x.listeners.message({ source: x.parent, data: { protocol: 'lms-scorm-save', token: 'wrong' } });
  assert.equal(x.messages.length, 0);
  x.listeners.message({ source: x.parent, data: { protocol: 'lms-scorm-save', token: 'session' } });
  assert.equal(x.messages.length, 1);
});
