/* Nebula — a D2C coffee subscription — is the course spine. 4 modules, 3 sub-modules each. */

export const NEBULA = {
  name: 'Nebula',
  what: 'a direct-to-consumer coffee subscription company',
}

export const COURSE = {
  id: 'n8n',
  title: 'Automate Real Work with n8n',
  /* Skills you'll gain — shown on the course page and the catalogue card. */
  skills: [
    'Workflow automation', 'Triggers & executions', 'Data transformation', 'Expressions',
    'Branching & merging', 'REST APIs', 'Error handling', 'AI in workflows', 'Sub-workflows', 'Files & binary data',
  ],
  problem:
    'Nebula runs on spreadsheets, a flaky CRM and hope. Every week, hours vanish into copy-paste work that a machine should do. Over four modules, you become the person who fixes that — by shipping real, working automations.',
  goal: 'Design, build, debug and maintain real n8n workflows — from a silent Slack alert to clean, reliable data pipelines.',
  /*
    Final assessment — taken once every available module is complete. Harder than the
    module quizzes: half theory, half scenario, and each question draws on more than
    one lesson. Same questions and pass mark for every learner; it never adapts.
  */
  final: {
    passMark: 0.8,
    questions: [
      { type: 'theory', subs: ["1.1","1.2"], q: "Which statement about executions and items is correct?", options: ["Each item starts its own execution, so a node only ever sees one item","One trigger event starts one execution, which can carry many items; each node then runs once per item","An execution only exists once the last node has succeeded","Items are shared between executions until a filter clears them"], correct: 1, explain: "The trigger starts the execution; the items travel inside it, and every node handles them one by one." },
      { type: 'scenario', subs: ["1.1","1.3"], q: "A lead-alert workflow showed green for 61 hours while no alerts arrived. The trigger fired on every new row. Which single check finds the cause fastest?", options: ["Open the last node’s response in a recent run and read what the receiving system returned","Fire the trigger again by hand and watch whether it turns green","Add a Wait node before the alert so the call has more time","Rename the sheet columns so the filter reads them correctly"], correct: 0, explain: "The trigger and the middle of the pipeline are already proven by the green runs. The only unknown is what the other system answered — and that is in the last node’s response." },
      { type: 'theory', subs: ["1.2","2.2"], q: "What is the essential difference between a Set node and a Filter node?", options: ["Set runs once per execution; Filter runs once per item","Set removes fields that fail a rule; Filter renames the ones that pass","Set changes what each item looks like and passes every item on; Filter leaves items unchanged and decides which ones continue","They do the same job; Filter is simply the faster of the two"], correct: 2, explain: "Set reshapes, Filter decides. Confusing the two is how data gets “cleaned” by silently dropping it." },
      { type: 'scenario', subs: ["1.2","1.3"], q: "300 rows arrive: 36 have no email and 41 are repeats of leads already seen. Both guards sit before the alert. How many alerts are sent — and how many would be sent if the duplicate guard were moved to after the alert?", options: ["264 are sent; with the guard moved, 300","223 are sent; with the guard moved, still 223","259 are sent; with the guard moved, 300","223 are sent; with the guard moved, 264"], correct: 3, explain: "300 − 36 − 41 = 223. Move the duplicate guard downstream and the 41 repeats are alerted before anything checks them: 300 − 36 = 264." },
      { type: 'theory', subs: ["1.3"], q: "Why is “the run is green” not proof that the work was done?", options: ["Green only means the trigger fired; later nodes are not checked","A node reports success when it ran without throwing an error; the receiving system can still have rejected or ignored the call","Green runs are cached, so they may show an older result","Green is shown whenever fewer than half of the items fail"], correct: 1, explain: "Success describes the node, not the outcome. The outcome is in the response it got back." },
      { type: 'scenario', subs: ["2.1","2.3"], q: "After deduplication the CRM still holds one customer twice: “priya@x.com” and “ Priya@X.com”. The duplicate filter is configured correctly. What is the real fault, and the fix?", options: ["The filter is too strict; loosen it to compare names instead of emails","The CRM is at fault; delete the second record by hand after each run","The emails reach the guard un-normalised; trim and lower-case them in a Set node upstream of the filter","The trigger is firing twice; add a Wait node after it"], correct: 2, explain: "The guard compares values exactly. Until case and spacing are made uniform, one address is two different strings." },
      { type: 'theory', subs: ["2.1"], q: "When is an expression inside a node evaluated?", options: ["For each item, at the moment that item passes through the node, using that item’s own fields","Once per execution, using the first item only","When the workflow is saved, and the result is stored","Only when the previous node returned an error"], correct: 0, explain: "Expressions are per item and on the fly — which is why one misspelled field name fails on every item." },
      { type: 'scenario', subs: ["2.2","2.3"], q: "Some rows have a blank plan; others say “FREE ” with a trailing space. Blanks must default to “free”. Which order avoids ending up with two versions of the same plan?", options: ["Fill the default first, then trim and lower-case","Filter out the blank rows, then fill the default","Fill the default, then filter duplicates, then trim","Trim and lower-case first, then fill the default for whatever is still blank"], correct: 3, explain: "Normalise before you compare or default. Otherwise “FREE ” and “free” live side by side as two plans." },
      { type: 'theory', subs: ["1.3","2.3"], q: "What does “order is the design” mean for guards in a pipeline?", options: ["Guards should be listed alphabetically so reviewers can find them","A guard protects only what comes after it, so it must sit before the action it is meant to protect","The more guards a pipeline has, the safer it is, wherever they sit","Guards belong at the very end, to clean up whatever got through"], correct: 1, explain: "A guard placed after the action runs, shows green, and protects nothing." },
      { type: 'scenario', subs: ["1.2","2.1"], q: "Someone renames the sheet column “Email” to “Contact”. Every run is still green, but every item now stops at the “has an email” filter. Why?", options: ["Renaming a column pauses the trigger until the workflow is re-saved","The filter’s expression still reads the old field name, which is now undefined on every item, so every item fails the condition","Filters stop working when a sheet has more than one text column","The items are being counted as duplicates of each other"], correct: 1, explain: "Nothing errored: the expression simply found no such field. Quiet failures like this are why field names are tidied once, upstream." },
      { type: 'theory', subs: ["2.3","1.2"], q: "A pipeline takes in 500 rows and writes 376. Which property makes that result defensible?", options: ["It finished without any error","Most of the rows got through","Each of the 124 stopped rows was stopped by a named guard, and the counts per guard are recorded","The 376 rows were written in the original order"], correct: 2, explain: "A trustworthy pipeline can say how many rows each guard stopped and why — not just that it ran." },
      { type: 'scenario', subs: ["1.1","1.3","2.2","2.3"], q: "You inherit this pipeline: trigger → write to CRM → filter blank emails → Set (normalise) → filter duplicates. What is wrong with it, taken as a whole?", options: ["Only the Set node is misplaced; the two filters are fine where they are","Nothing — the filters still remove the bad rows from the CRM afterwards","The trigger should come last, so that it fires only once","It is back to front: the write happens before any guard, and the guards run before normalisation — it should be normalise, guard, guard, then write"], correct: 3, explain: "Two ordering faults at once: nothing protects the write, and the guards compare values that have not been cleaned yet." },
    ],
  },
}

/* Sub-module titles and short notes live here so Dashboard/Course/wrap-up can render them without loading content files. */
export const MODULES = [
  {
    n: 1, id: 'm1', built: true, guidedSteps: 4, quizQuestions: 8,
    title: 'Foundations: Your First Working Workflow',
    pain: 'The lead alert workflow died at 2:07 AM. 40 leads lost before anyone noticed.',
    hrsSaved: 6,
    submodules: [
      { id: '1.1', title: 'Workflow anatomy', notes: ["A workflow starts with a trigger — no trigger, no run.","One trigger event starts one execution, which passes through the nodes in order.","Actions do the visible work, and only run when an execution reaches them."] },
      { id: '1.2', title: 'Data & items', notes: ["Each row is one item; every node runs once per item.","Tidy field names once, early, so every later node reads clean names.","A Filter is a guard: items that fail it stop there."] },
      { id: '1.3', title: 'Build the lead alert', notes: ["The shape to remember: trigger → clean → guard → alert.","A guard only protects what comes after it.","Green means the node ran — read its response to know the work was done."] },
    ],
  },
  {
    n: 2, id: 'm2', built: true, hookTitle: 'The handoff', guidedSteps: 5, quizQuestions: 8,
    leadIn: 'You can now move data safely from a trigger to an action. Next you learn to change it on the way: clean messy fields, reshape each item and remove duplicates — inside the same trigger → guard → action shape.',
    title: 'Data Transformation: Taming Messy Data',
    pain: 'A 500-row export with mixed date formats, duplicate IDs and blank emails. Ana wants it CRM-ready.',
    hrsSaved: 5,
    submodules: [
      { id: '2.1', title: 'Expressions', notes: ["Expressions run for each item, on the fly.","Trim and lower-case values before comparing them.","“Undefined” almost always means a misspelled or missing field name."] },
      { id: '2.2', title: 'Reshaping with Set', notes: ["Set renames, adds and reshapes fields — it never stops an item.","Fill defaults in one place, upstream.","Normalise before you default, or one value turns into two."] },
      { id: '2.3', title: 'Cleaning real data', notes: ["The order: normalise → guard → guard → write.","Dedup compares values, so they must share one format first.","Count every rejection, and be able to explain each one."] },
    ],
  },
  {
    n: 3, id: 'm3', built: true, lite: true, quizQuestions: 6, // a video module: concept videos, then the module quiz
    leadIn: 'So far your pipelines run in a straight line. Next they branch: different paths for different cases, merging them back together, and talking to outside systems through their APIs.',
    title: 'Logic, Branching & APIs',
    pain: 'VIP and standard orders, digital and physical — and a CRM API that paginates and rate-limits.',
    hrsSaved: 7,
    submodules: [
      { id: '3.1', title: 'Conditional logic', notes: ["Filter drops items; IF and Switch route them.","IF has two paths, Switch has many.","Always give Switch a path for “everything else”."] },
      { id: '3.2', title: 'Merging branches', notes: ["Append stacks items; Combine pairs them by a shared field.","Merge waits for both inputs.","Normalise the matching field first, then count."] },
      { id: '3.3', title: 'Talking to APIs', notes: ["A request has a method, a URL, authentication and a body.","Read the status code first: 200, 401, 404, 429.","Expect pagination and rate limits."] },
    ],
  },
  {
    n: 4, id: 'm4', built: true, lite: true, quizQuestions: 12,
    leadIn: 'Next comes what happens when things break — and when workflows grow up: catching errors, retrying safely, putting AI in the loop, reusing sub-workflows, writing a few lines of code, and handling files.',
    title: 'Reliability, AI & Bigger Workflows',
    pain: 'Duplicate invoices, silent failures, and 200 tickets a day that an AI could triage. Then the same cleaning steps copied into five workflows, a tax rule no node can express, and invoices that arrive as PDFs.',
    hrsSaved: 18,
    submodules: [
      { id: '4.1', title: 'When things break', notes: ["Failures are temporary or permanent.","Retry the temporary ones; continue past bad items and keep them.","Anything retried must be safe to run twice."] },
      { id: '4.2', title: 'Error workflows', notes: ["An error workflow starts with an Error Trigger.","A good alert says what failed, where, and links to the run.","Use Stop and Error when nothing broke but the result is wrong."] },
      { id: '4.3', title: 'AI in the loop', notes: ["Use a model for reading, rules for exact tests.","Ask for a fixed set of answers and validate them.","A person approves anything that cannot be undone."] },
      { id: '4.4', title: 'Sub-workflows', notes: ["A sub-workflow does one job for a parent workflow.","Build once, reuse everywhere.","Small parts are easier to read and test."] },
      { id: '4.5', title: 'The Code node', notes: ["Use a node if one exists; code if none does.","Choose the mode: each item, or all items.","Always return items, and keep secrets out of code."] },
      { id: '4.6', title: 'Files and binary data', notes: ["An item can carry fields and a file.","Extract from File: file → items. Convert to File: items → file.","Check the file is still attached after each node."] },
    ],
  },
]

/* Rough time per step, in minutes — estimates for the Learning Plan, not a timer. */
export const STAGE_MINUTES = {
  hook: 3, explain: 7, worked: 8, scenarios: 10, guided: 10, project: 30, quiz: 10, review: 5,
}

/* Edge-case bingo — earned by surviving them, never by clicking. Each card flips into a flash drill. */
export const BINGO = [
  { id: 'double-submit', emoji: '📝', title: 'Double-submit form', how: 'Survived in M1 · Guided practice', check: (c) => c.stage(1, 'guided'),
    drill: { q: 'Same lead arrives twice in one minute. First move?', options: ['Filter duplicates before anything fires', 'Add a Wait node', 'Post both to Slack'], correct: 0 } },
  { id: 'silent-failure', emoji: '🤫', title: 'Silent failure', how: 'Survived in M1 · The hook', check: (c) => c.stage(1, 'hook'),
    drill: { q: 'A run shows green but nobody got the alert. First check?', options: ['The action node’s response in the run data', 'The workflow name', 'The sheet color'], correct: 0 } },
  { id: 'hardcoded-secret', emoji: '🔑', title: 'Hard-coded secret', how: 'Survived in the course capstone', check: (c) => !!c.capstone,
    drill: { q: 'Where do credentials live?', options: ['n8n credentials — never in node parameters', 'In the node name', 'In the sheet'], correct: 0 } },
  { id: 'reasoned-fix', emoji: '🧠', title: 'Passed a module quiz', how: 'Survived in M1 · Module quiz', check: (c) => c.stage(1, 'quiz'),
    drill: { q: 'A fix “works”. What makes it trustworthy?', options: ['Re-running it and reading the run data', 'Shipping immediately', 'Renaming the workflow'], correct: 0 } },
  { id: 'duplicate-webhook', emoji: '👯', title: 'Duplicate webhook fire', how: 'M1 health check · +3 days', check: (c) => c.reviewDone('m1-r1'),
    drill: { q: 'A webhook just fired twice. Your alert pipeline should…', options: ['Drop the repeat with a seen-before guard', 'Alert twice for safety', 'Crash loudly'], correct: 0 } },
  { id: 'renamed-column', emoji: '🏷️', title: 'Renamed column', how: 'M1 health check · +10 days', check: (c) => c.reviewDone('m1-r2'),
    drill: { q: 'Sheet column “Email” renamed to “Contact”. What breaks?', options: ['Conditions and expressions naming Email', 'The trigger', 'Nothing ever'], correct: 0 } },
  { id: 'rate-limit', emoji: '🚦', title: 'Rate limit 429', how: 'M1 health check · +30 days', check: (c) => c.reviewDone('m1-r3'),
    drill: { q: 'An API starts returning 429s. A respectful pipeline…', options: ['Waits and retries with backoff', 'Slams it harder', 'Deletes the data'], correct: 0 } },
  { id: 'expression-typos', emoji: '🧬', title: 'Expression typo chaos', how: 'Survived in M2 · Module quiz', check: (c) => c.stage(2, 'quiz'),
    drill: { q: '{{ $json["Emai"] }} returns undefined. Why?', options: ['Field name typo — undefined field', 'Expressions hate Mondays', 'The JSON is broken'], correct: 0 } },
  { id: 'messy-migration', emoji: '🧹', title: 'The messy migration', how: 'Survived in M2 · Cleaning real data', check: (c) => c.stage(2, '2.3-scenarios'),
    drill: { q: '4,000 dirty rows, deadline Wednesday. First node?', options: ['Normalize — then guards compare clean values', 'Delete duplicates first', 'Panic'], correct: 0 } },
  { id: 'clean-feed', emoji: '✨', title: 'CRM-ready clean feed', how: 'Survived in M2 · Guided practice', check: (c) => c.stage(2, 'guided'),
    drill: { q: 'What makes a CRM feed “clean”?', options: ['Consistent names, formats and no dupes', 'It looks nice in a spreadsheet', 'It is short'], correct: 0 } },
]

/* Stack Builder — Nebula's automation stack assembles as you complete modules. */
export const STACK = [
  { n: 1, label: 'Lead Pipeline', x: 40, y: 30 },
  { n: 2, label: 'Clean Data Feed', x: 250, y: 30 },
  { n: 3, label: 'Order Triage', x: 460, y: 30 },
  { n: 4, label: 'Reliable AI Ops', x: 250, y: 150, capstone: true },
]
