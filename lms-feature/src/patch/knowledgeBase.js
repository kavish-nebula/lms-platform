/*
  Patch's knowledge base — built from the course's own concepts.
  Deterministic keyword retrieval + a hard scope guard: Patch answers ONLY
  questions about this course's world (Nebula, n8n concepts, the current module).
*/
export const KB = [
  {
    keys: ['item', 'items', 'row', 'rows', 'record'],
    answer: 'One row of data = one item. An execution (one run) carries all its items through the pipeline — 60 rows in, 60 items, one run.',
    deep: 'Think of the workflow as a belt in a factory: each item is one box. Nodes do their work per box, not per shipment. That’s why a Filter can stop one bad box without touching the others.',
  },
  {
    keys: ['execution', 'executions', 'run', 'history', 'log'],
    answer: 'An execution is one run of the workflow — one trigger fire, end to end. The execution list shows every run: green = survived, red = died at a specific node.',
    deep: 'Run data is your microscope. In Module 1, the failed run sat red in the list for 61 hours before anyone looked. Glancing at history after every change is the cheapest monitoring there is.',
  },
  {
    keys: ['trigger', 'wakes', 'wake', 'start'],
    answer: 'The trigger is the only self-starter: a new sheet row, a webhook, a schedule. No trigger fire, no execution — ever.',
    deep: 'Doorbell analogy: no press, no anything. Everything after the trigger is just “what happens when it rings”.',
  },
  {
    keys: ['action', 'slack', 'alert'],
    answer: 'Actions do the visible work — posting to Slack, writing to a CRM. They run once per item that reaches them, which is why junk upstream is so painful.',
    deep: 'Actions amplify. Whatever reaches them, happens publicly. That’s why guards (filters) always sit in front of them.',
  },
  {
    keys: ['filter', 'guard', 'block'],
    answer: 'A Filter looks at each item and decides: pass or stop. Placed before an action, it’s the guard that keeps the output channel trustworthy.',
    deep: 'Bouncer analogy: no email, no entry. A venue without a bouncer is fine — until one night. Then it’s never fine again.',
  },
  {
    keys: ['set', 'rename', 'normalize', 'reshape', 'default'],
    answer: 'The Set node changes an item’s shape: rename fields, compute new ones, fill defaults, keep only what’s needed. Hygiene once, upstream.',
    deep: 'Customs-desk analogy: the CRM has one legal entry form. Set renames your documents, fills blanks with defaults, and confiscates anything not on the form.',
  },
  {
    keys: ['expression', 'expressions', '$json', 'function'],
    answer: 'An expression is a tiny formula in a field: {{ $json["Email"].toLowerCase().trim() }}. It runs per item, as the item passes through.',
    deep: 'Name-tag printer analogy: every box passing gets a fresh, correctly-spelled tag. The belt doesn’t care what the label looked like before.',
  },
  {
    keys: ['duplicate', 'dedupe', 'dupes', 'twice'],
    answer: 'Deduping is a guard with memory: the filter remembers every normalized email it has seen and stops any item it has met before. Normalize first — otherwise twins look like strangers.',
    deep: '“PRIYA@X.com” and “priya@x.com” are one person only after lowercasing. Order is the lesson: normalize → then dedupe.',
  },
  {
    keys: ['invalid_token', 'token', 'credential', 'credentials', 'auth', 'expired'],
    answer: 'That was Module 1’s villain: Slack rejected the call because the credentials expired Friday night — and nothing screamed. Credentials belong in n8n’s credential manager, never hard-coded in a node.',
    deep: 'The failure was visible the whole time: one red run in the execution list. Reading run data is the microscope.',
  },
  {
    keys: ['webhook', 'webhooks'],
    answer: 'A webhook is a URL another system can call to wake your workflow — a trigger you hand to someone else. Coming in depth in Module 3.',
    deep: 'Doorbell you give to a neighbor: they press it when a package arrives. Also: webhooks can fire twice — real pipelines plan for that (Module 4).',
  },
  {
    keys: ['http', 'api', 'apis', 'crm api', 'pagination', 'rate limit', '429'],
    answer: 'The HTTP node is how workflows talk to other systems’ APIs — with auth, pagination and rate limits to respect. That’s all of Module 3.',
    deep: 'Real APIs paginate, throttle and have undocumented null fields. You’ll meet a deliberately mean one in Module 3 — safely.',
  },
  {
    keys: ['error', 'errors', 'retry', 'retries', 'idempotency', 'silent failure', 'broke'],
    answer: 'Failures stop an execution silently unless you design against it — error workflows, retries, and idempotent alerts. That’s the heart of Module 4.',
    deep: 'Nebula’s duplicate-invoice week exists because nobody made alerts idempotent. “Already alerted? stop” — one guard, whole class of bugs gone.',
  },
  {
    keys: ['nebula', 'company', 'ana', 'tom', 'sam', 'story'],
    answer: 'Nebula is a coffee subscription company — and for this course, it’s your client. Ana (founder) breaks things by shipping fast, Tom sells, Sam markets. Every workflow you build is theirs.',
    deep: 'The fiction does real work: spaced-review “health checks” are Patch paging you about Nebula workflows, exactly like real maintenance.',
  },
  {
    keys: ['workflow', 'workflow anatomy', 'node', 'nodes', 'connection', 'canvas'],
    answer: 'A workflow is nodes connected left to right: a trigger wakes it, items flow through, actions do work. The smallest useful version is Trigger → Action.',
    deep: 'You built one node-by-node in the guided build — trigger → clean → guard → alert. Everything else in n8n is that pattern, longer.',
  },
  {
    keys: ['quiz', 'gate', 'pass', 'score'],
    answer: 'The module quiz is the mastery gate: 80% to pass, unlimited retakes, and every option explains itself after answering. Module 2’s quiz also asks about Module 1 — spaced review, built in.',
    deep: 'It’s graded on coverage, not speed. Missed questions tell you exactly which sub-module to reread.',
  },
]

export const SUGGESTIONS = [
  'What is an item?',
  'Why did the alerts die?',
  'What does a Filter do?',
  'How does the quiz work?',
]

/* Deterministic retrieval. Returns {text, inScope}. */
export function answerQuestion(question, { confused = false, context = '' } = {}) {
  const q = question.toLowerCase()
  let best = null
  let bestScore = 0
  for (const entry of KB) {
    let score = 0
    for (const k of entry.keys) if (q.includes(k)) score += k.length > 3 ? 2 : 1
    if (score > bestScore) { bestScore = score; best = entry }
  }
  if (!best || bestScore === 0) {
    return {
      inScope: false,
      text: 'That’s outside what we’re building here. Ask me about the Nebula workflows, n8n nodes, expressions, filters — or whatever stage you’re looking at right now.',
    }
  }
  const parts = []
  if (confused) parts.push(best.deep)
  parts.push(best.answer)
  if (context) parts.push(`(You’re on: ${context}.)`)
  return { inScope: true, text: parts.join(' ') }
}
