/* Host bridge for isolated SCORM 2004 packages. This file never receives the learner profile. */
(() => {
  'use strict';
  const boot = window.__LMS_SCORM_BOOTSTRAP__;
  if (!boot) return;
  const cmi = { 'cmi.completion_status': 'not attempted', 'cmi.success_status': 'unknown', 'cmi.learner_id': 'learner', 'cmi.learner_name': 'Learner', 'cmi.mode': 'normal', 'cmi.credit': 'credit', 'cmi.total_time': 'PT0S', ...boot.state.cmi };
  cmi['cmi.entry'] = cmi['cmi.suspend_data'] || cmi['cmi.location'] ? 'resume' : 'ab-initio';
  const storage = { ...boot.state.storage };
  let initialized = false, terminated = false, error = '0', timer;
  const send = () => parent.postMessage({ protocol: 'lms-scorm-v1', token: boot.token, state: { version: 1, cmi: { ...cmi }, storage: { ...storage } } }, '*');
  const schedule = () => { clearTimeout(timer); timer = setTimeout(send, 100); };
  const fail = code => { error = code; return 'false'; };
  const connected = () => initialized && !terminated;
  const count = prefix => String(new Set(Object.keys(cmi).filter(k => k.startsWith(prefix + '.')).map(k => k.slice(prefix.length + 1).split('.')[0]).filter(k => /^\d+$/.test(k))).size);
  window.API_1484_11 = {
    Initialize(arg) { if (arg !== '') return fail('201'); if (initialized) return fail('103'); if (terminated) return fail('104'); initialized = true; error = '0'; send(); return 'true'; },
    Terminate(arg) { if (arg !== '') return fail('201'); if (!connected()) return fail('112'); terminated = true; error = '0'; clearTimeout(timer); send(); return 'true'; },
    GetValue(key) { if (!connected()) { error = '122'; return ''; } error = '0'; if (key.endsWith('._count')) return count(key.slice(0, -7)); return cmi[key] ?? ''; },
    SetValue(key, value) { if (!connected()) return fail('132'); if (typeof key !== 'string' || !key.startsWith('cmi.') || key.length > 200 || String(value).length > 100000) return fail('201'); if (['cmi.learner_id','cmi.learner_name','cmi.mode','cmi.credit','cmi.entry','cmi.total_time'].includes(key)) return fail('404'); cmi[key] = String(value); error = '0'; schedule(); return 'true'; },
    Commit(arg) { if (arg !== '') return fail('201'); if (!connected()) return fail('142'); error = '0'; clearTimeout(timer); send(); return 'true'; },
    GetLastError() { return error; },
    GetErrorString(code) { return code === '0' ? 'No error' : 'SCORM operation failed'; },
    GetDiagnostic() { return error; },
  };
  // An opaque sandbox has no origin storage. Keep package-local preferences/notes
  // in its scoped state and persist through the same checked host bridge.
  const local = {
    getItem(key) { return Object.hasOwn(storage, key) ? storage[key] : null; },
    setItem(key, value) { if (String(key).length > 250 || String(value).length > 200000) return; storage[String(key)] = String(value); schedule(); },
    removeItem(key) { delete storage[key]; schedule(); },
    clear() { for (const key of Object.keys(storage)) delete storage[key]; schedule(); },
    key(index) { return Object.keys(storage)[index] ?? null; },
    get length() { return Object.keys(storage).length; },
  };
  Object.defineProperty(window, 'localStorage', { value: local });
  const session = new Map();
  Object.defineProperty(window, 'sessionStorage', { value: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key), clear: () => session.clear() } });
  addEventListener('pagehide', send);
  addEventListener('message', event => { if (event.source === parent && event.data?.protocol === 'lms-scorm-save' && event.data.token === boot.token) send(); });
})();
