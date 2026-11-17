import { pipelineRow } from '../../canvas/layout.js'
import video21 from '../videos/m2-1.js'
import video22 from '../videos/m2-2.js'
import video23 from '../videos/m2-3.js'

/*
  Module 2 — Data Transformation: Taming Messy Data
  Same interior blueprint as M1. The quiz mixes in recall questions from M1
  (structural spaced review).
*/

const [sheet, set, fblank, fdupe, crm] = pipelineRow([
  { id: 'sheet',  kind: 'trigger', label: 'Sheet Trigger',         sub: '500-row export lands', gap: 200 },
  { id: 'set',    kind: 'data',    label: 'Normalize Fields',      sub: 'expressions inside' },
  { id: 'fblank', kind: 'logic',   label: 'Filter: Blank Emails',  sub: 'pass or stop' },
  { id: 'fdupe',  kind: 'logic',   label: 'Filter: Duplicate IDs', sub: 'seen before?' },
  { id: 'crm',    kind: 'action',  label: 'Append to CRM',         sub: 'clean rows only' },
])
const CHAIN = [
  { id: 'e1', source: 'sheet', target: 'set' },
  { id: 'e2', source: 'set', target: 'fblank' },
  { id: 'e3', source: 'fblank', target: 'fdupe' },
  { id: 'e4', source: 'fdupe', target: 'crm' },
]

export default {
  id: 'm2',
  n: 2,
  title: 'Data Transformation: Taming Messy Data',

  hook: {
    kicker: 'The handoff',
    title: 'The Spreadsheet From Hell',
    introNarration:
      'Monday, 9 AM at Nebula. Marketing just exported five hundred rows from their old tool and dropped them into your sheet. ' +
      'Dates in three different formats. Emails in mixed case with stray spaces. Duplicate customers from a double-import. Blank plans everywhere. ' +
      'Ana wants the CRM fed by Friday, and the CRM chokes on anything dirty. There is no error to debug this week — the data itself is the bug.',
    whyMatters: {
      text: 'Marketing just exported 500 rows from an old tool and dropped the CSV into your sheet: dates in three formats, emails in mixed case, duplicate IDs from a double-import, and blanks everywhere. Ana’s ask: “CRM-ready by Friday. The CRM chokes on anything dirty — you’ve seen it.”',
      stat: '500 rows · ~80 duplicates · 3 date formats',
    },
    slackMsgs: [
      { who: 'Ana — founder', av: 'A', at: '9:14 AM', text: 'the old tool export is in the sheet. it’s… rough. can the CRM eat this?' },
      { who: 'Sam — marketing', av: 'S', at: '9:20 AM', text: 'fwiw some people signed up twice, the form had no debounce 🙃' },
      { who: 'Ana — founder', av: 'A', at: '9:21 AM', text: 'clean it the way you cleaned the lead alerts. you know what good looks like now.' },
    ],
    pin: false, // nothing failed here, so there is no node to point at — only a hunch to commit to
    pinPrompt: 'No failure to pin this time. Instead: which node family do you reach for first?',
    hunches: [
      { id: 'set', label: 'Set node — normalize every field' },
      { id: 'filter', label: 'Filters — block blanks and dupes' },
      { id: 'both', label: 'Both, in order: normalize first, then guard' },
    ],
    baseNodes: [sheet, set, fblank, fdupe, crm],
    baseEdges: CHAIN,
    correctHunch: 'both',
    pinCaption: 'The export — 500 rows, three date formats',
    revealNarration:
      'Watch one run of the pipeline you are about to build. ' +
      'There is no error to find this week — the data itself is the bug. ' +
      'The trigger picks up the export. Then the Set node normalizes every row: one name for each field, one shape, one date format. ' +
      'Only after that do the guards run. Blank emails stop at the first filter, duplicates stop at the second, and what reaches the CRM is clean and unique. ' +
      'Normalize first, then guard. That order is the whole module.',
    revealScript: [
      { t: 0, do: 'caption', text: 'There’s no error to find this week. The data itself is the bug.' },
      { t: 400, do: 'setNode', id: 'sheet', state: 'running' },
      { t: 1500, do: 'setNode', id: 'sheet', state: 'ok' },
      { t: 1700, do: 'setNode', id: 'set', state: 'running' },
      { t: 2900, do: 'setNode', id: 'set', state: 'ok' },
      { t: 3100, do: 'caption', text: 'Normalize first — every field gets one name, one shape, one format.' },
      { t: 4800, do: 'setNode', id: 'fblank', state: 'running' },
      { t: 5800, do: 'setNode', id: 'fblank', state: 'ok' },
      { t: 6000, do: 'setNode', id: 'fdupe', state: 'running' },
      { t: 7000, do: 'setNode', id: 'fdupe', state: 'ok' },
      { t: 7200, do: 'setNode', id: 'crm', state: 'ok' },
      { t: 7400, do: 'caption', text: 'Then guard — blanks stop, duplicates stop, and only clean, unique rows reach the CRM.' },
    ],
    wrapCorrect: 'Right — transformation first, then guarding. Normalizing before filtering means the filters compare clean values (and “Email” vs “email ” stops mattering).',
    wrapWrong: 'Close — the order matters: normalize first, then guard. Clean values make the filters trustworthy.',
    wrapPoint: 'Module 1 taught you to move data. Module 2 teaches you to change it — safely, at 500-row scale.',
  },

  submodules: [
    /* ---------------- 2.1 EXPRESSIONS ---------------- */
    {
      id: '2.1',
      title: 'Expressions',
      video: video21, // the concept is taught by a narrated slide video
      explainer: {
        beats: [
          {
            narration:
              'An expression is a tiny formula that lives inside a field. You write double curly braces, then dollar-json, then the field name — and n8n hands you that item’s value. ' +
              'Watch the Set node form: it is about to read the Email field from every row that passes. ' +
              'The important word is every. Expressions run per item, so five hundred rows means five hundred evaluations, automatically.',
            script: [
              { t: 0, do: 'caption', text: 'An expression is a tiny formula inside a field: {{ $json["Email"] }}. Read any item, any field, anywhere.' },
              { t: 300, do: 'addNode', node: set, state: 'running' },
              { t: 1600, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1800, do: 'caption', text: 'email: {{ $json["Email"].toLowerCase().trim() }} — every item comes out lowercase, whitespace-free.' },
            ],
            why: { set: 'Expressions turn the Set node from a renamer into a transformer: read anything, compute anything, output clean fields.' },
            check: {
              q: 'What does {{ $json["Email"] }} give you?',
              options: ['The current item’s Email field', 'Every item’s email at once', 'The workflow’s name'],
              correct: 0,
              explain: '$json is “the item flowing through right now”. Expressions run per item.',
            },
          },
          {
            narration:
              'Functions chain onto fields like beads on a string. toLowerCase kills the shouting. trim removes the sneaky spaces at the end. ' +
              'One messy value — PRIYA at example dot com with a trailing space — becomes priya at example dot com. ' +
              'Same person, now recognizable by every machine downstream: the CRM, the dedupe filter, the Slack message. Normalization is what makes comparison possible.',
            script: [
              { t: 0, do: 'caption', text: 'Functions chain: .toLowerCase(), .trim(), .slice(0,10) for dates.' },
              { t: 400, do: 'setNode', id: 'set', state: 'running' },
              { t: 1500, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1700, do: 'caption', text: '“PRIYA@Example.com ” → priya@example.com. Same person — now comparable everywhere.' },
            ],
            why: { set: 'Normalization functions make values comparable. Dedup, matching and merging all depend on it.' },
            check: {
              q: 'Two rows: “priya@x.com” and “PRIYA@X.com”. Same person. Which pair of functions unifies them?',
              options: ['.toLowerCase().trim()', '.slice(0,5)', '.json.parse()'],
              correct: 0,
              explain: 'Case and stray whitespace are the two classics. Normalize both and deduping becomes possible.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The name-tag version',
          analogy: 'An expression is a name-tag printer at an event: every box (item) that passes gets a fresh, correctly-spelled tag. The belt doesn’t care what the tag looked like before — the printer rewrites it, every time, for every box.',
          nounsNote: 'Where in your data would a name-tag printer save you?',
        },
      },
      worked: {
        title: 'Watch one messy field become three clean ones',
        intro: 'One item, transformed live.',
        narration:
          'Here is the ugliest row in the export. Email in caps with a trailing space, a date in slash-format, a name in all lowercase. ' +
          'It enters the Sheet Trigger as one item and flows into the Set node, where three expressions fire: email gets lowercased and trimmed, signup date gets sliced into ISO format, name gets capitalized. ' +
          'What comes out the other side is the same human — but now every machine downstream reads her perfectly. That is transformation.',
        predict: {
          q: 'The dirty item hits the Set node. What exits?',
          options: ['email, signupDate, name — cleaned and consistent', 'The same dirty fields, slightly faster', 'An error — Set rejects messy data'],
          correct: 0,
          explain: 'Set manufactures the shape you need from whatever arrives. Garbage in, contract out.',
        },
        flow: { total: 1, stops: {} },
        script: [
          { t: 0, do: 'caption', text: 'Incoming: { "Email": "PRIYA@Example.com ", "Signed Up": "03/14/25", "Name": "priya sharma" }' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1400, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1600, do: 'addNode', node: set, state: 'running' },
          { t: 3000, do: 'setNode', id: 'set', state: 'ok' },
          { t: 3200, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
          { t: 3400, do: 'caption', text: 'Three expressions per item: email → lowercase+trim · signupDate → ISO · name → capitalized.' },
          { t: 5600, do: 'note', text: 'Out: { email: "priya@example.com", signupDate: "2025-03-14", name: "Priya Sharma" }' },
          { t: 6200, do: 'caption', text: 'Same person. Now legible to every machine downstream — and comparable, which deduping needs.' },
        ],
      },
      scenarioQs: [
        {
          say: 'Emails arrive with capital letters and a trailing space. Which expression cleans them?',
          q: 'Emails arrive like “Ana@Nebula.coffee ” (note the space). Which expression cleans it?',
          options: ['{{ $json["Email"].trim().toLowerCase() }}', '{{ $json["Email"].slice(0, 10) }}', '{{ $json.Email.repeat(2) }}'],
          correct: 0,
          explain: 'Trim the whitespace, drop the case — the two functions that fix 90% of dirty emails.',
        },
        {
          q: 'Where do expressions run — once per workflow, or once per item?',
          options: ['Once per item', 'Once per workflow', 'Only on Mondays'],
          correct: 0,
          explain: 'Expressions evaluate per item as it passes. 500 items, 500 evaluations — that’s the power.',
        },
      ],
    },

    /* ---------------- 2.2 RESHAPING WITH SET ---------------- */
    {
      id: '2.2',
      title: 'Reshaping with Set',
      video: video22,
      explainer: {
        beats: [
          {
            narration:
              'The Set node does three jobs at once, and it is worth naming them. Rename: Email becomes email. Compute: fullName appears, built from two other fields. Default: missing plans quietly become free. ' +
              'One node, all three transformations, applied to every item. The source data stays untouched — Set is a bridge between the shape you have and the shape the CRM demands.',
            script: [
              { t: 0, do: 'addNode', node: set, state: 'running' },
              { t: 1300, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1500, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
              { t: 1700, do: 'caption', text: 'Set does three jobs: RENAME (Email → email), COMPUTE (fullName), DEFAULT (plan: “free”). One node.' },
            ],
            why: { set: 'The shape-shifter. Whatever the CRM needs, Set manufactures — fields renamed, combined, defaulted — without touching the source.' },
            check: {
              q: 'The CRM wants `fullName` but the sheet has `First Name` and `Last Name`. You…',
              options: ['Compute fullName in Set: {{ $json["First Name"] + " " + $json["Last Name"] }}', 'Rename the CRM', 'Concatenate in Slack later'],
              correct: 0,
              explain: 'Compute in Set. The source stays honest, the output fits the destination — transformation is a bridge, not a hack.',
            },
          },
          {
            narration:
              'There is one more Set superpower, and disciplined teams love it most: keep only the fields you name. Everything else vanishes. ' +
              'The CRM feed goes from twelve ragged columns to five deliberate ones. Lean items are fast items — and every later filter and expression gets easier to write when the shape is small and known.',
            script: [
              { t: 0, do: 'caption', text: 'Also: KEEP ONLY the fields you name. Everything else vanishes.' },
              { t: 400, do: 'setNode', id: 'set', state: 'running' },
              { t: 1500, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1700, do: 'caption', text: '500 rows in, 500 rows out — each item now exactly 5 fields the CRM understands.' },
            ],
            why: { set: 'Lean items are fast items — and they make every later filter and expression easier to write.' },
            check: {
              q: 'Why keep only needed fields before the CRM?',
              options: ['Lean, predictable items — fewer surprises downstream', 'It makes the workflow look tidy', 'The CRM bills per field'],
              correct: 0,
              explain: 'Every extra field is a chance for a typo or a merge conflict downstream. Ship what’s needed.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The customs form version',
          analogy: 'The CRM is a country with one legal entry form: fullName, email, plan, signupDate. Set is the customs desk — it renames your documents, fills the blanks with defaults, and confiscates anything not on the form.',
          nounsNote: 'What would your CRM’s “entry form” require?',
        },
      },
      worked: {
        title: 'The customs desk: 12 raw fields in, 5 clean fields out',
        intro: 'One Set node, three jobs, live.',
        narration:
          'The raw export arrives with twelve fields. Four of them matter. ' +
          'The Set node renames Email to email, computes full name from two columns, defaults the missing plans to free — and confiscates everything that is not on the entry form. ' +
          'Five hundred items pass through and every single one comes out with exactly five fields. Nobody touched a row by hand. That is the trick of this module: the shape your data needs is manufactured, not requested.',
        predict: {
          q: '500 items × 12 raw fields enter Set. What leaves?',
          options: ['500 items × exactly 5 clean fields', '500 items × 12 fields', 'One merged item'],
          correct: 0,
          explain: 'Set transforms every item: renamed, computed, defaulted, and reduced to what the CRM needs.',
        },
        flow: { total: 5, stops: {} },
        script: [
          { t: 0, do: 'caption', text: 'Incoming: the raw marketing export — 12 fields, four of them useful.' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1500, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1700, do: 'addNode', node: set, state: 'running' },
          { t: 3300, do: 'setNode', id: 'set', state: 'ok' },
          { t: 3500, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
          { t: 3700, do: 'caption', text: 'RENAME: Email → email. COMPUTE: fullName from two columns. DEFAULT: plan = “free”. KEEP: those five only.' },
          { t: 6200, do: 'note', text: '12 fields → 5 fields · 500 items, zero touched by hand' },
          { t: 6800, do: 'caption', text: 'That’s the whole trick: the shape your data needs is manufactured, not requested.' },
        ],
      },
      scenarioQs: [
        {
          q: 'Some rows have no “Plan” value, and the CRM requires one. Cleanest fix?',
          options: ['Set node with a default: plan = “free”', 'Delete those rows', 'Ask Ana to fill them in by hand'],
          correct: 0,
          explain: 'Defaults in Set turn a data hole into a decision — made once, in code, visible to everyone.',
        },
        {
          q: 'Set vs Filter — which is which?',
          options: [
            'Set changes the shape of items; Filter decides which items continue',
            'Set decides which items continue; Filter changes their shape',
            'They’re interchangeable',
          ],
          correct: 0,
          explain: 'Shape (Set) versus selection (Filter). Pipelines read clearly when each node does exactly one of those jobs.',
        },
      ],
    },

    /* ---------------- 2.3 CLEANING REAL DATA ---------------- */
    {
      id: '2.3',
      title: 'Cleaning real data',
      video: video23,
      explainer: {
        beats: [
          {
            narration:
              'Now the guards, in the right order. Guard one: blank emails. It looks exactly like Module 1’s filter, but it is standing watch in front of the CRM now. ' +
              'And notice the placement rule: the blank-guard runs after normalization. A field of just spaces looks non-empty until something trims it. Clean first — then the guard sees the truth.',
            script: [
              { t: 0, do: 'addNode', node: fblank, state: 'running' },
              { t: 1300, do: 'setNode', id: 'fblank', state: 'ok' },
              { t: 1500, do: 'addEdge', edge: { id: 'e2', source: 'set', target: 'fblank' } },
              { t: 1700, do: 'caption', text: 'Guard #1 — blanks. Same node as Module 1, new post: protecting the CRM.' },
            ],
            why: { fblank: 'Same guard, new post. A blank row in a CRM is a support ticket waiting to happen.' },
            check: {
              q: 'Blank-guard placement: before or after normalization?',
              options: ['After — compare clean values (" " after trim is visibly empty)', 'Before — order never matters', 'Both, twice, always'],
              correct: 0,
              explain: 'A field of just spaces looks non-empty until you trim. Normalize first, then the guard sees the truth.',
            },
          },
          {
            narration:
              'Guard two needs a memory: the duplicate filter. It remembers every normalized email it has already seen, and stops any item it meets twice. ' +
              'Sam’s double-import — eighty-three repeats — dies right here. ' +
              'And the reason we lowercased emails first is now obvious: to this filter, PRIYA at x dot com and priya at x dot com are the same person. Without normalization they would have been strangers.',
            script: [
              { t: 0, do: 'addNode', node: fdupe, state: 'running' },
              { t: 1300, do: 'setNode', id: 'fdupe', state: 'ok' },
              { t: 1500, do: 'addEdge', edge: { id: 'e3', source: 'fblank', target: 'fdupe' } },
              { t: 1700, do: 'caption', text: 'Guard #2 — duplicates. It remembers every email it has seen. Sam’s double-import dies here.' },
            ],
            why: { fdupe: 'Dedup is the guard that needs memory. “Seen-before → stop” is the whole idea — a later module turns it into proper idempotency.' },
            check: {
              q: 'Why dedupe AFTER lowercasing emails?',
              options: ['Otherwise "PRIYA@X.com" and "priya@x.com" count as two people', 'It looks better', 'The CRM requires uppercase'],
              correct: 0,
              explain: 'Comparing unnormalized values splits one person into two. Normalize → then dedupe. Order is the lesson.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The nightclub version',
          analogy: 'Two bouncers, one line. First checks the entry requirements (no email, no entry). Second holds the guest list — if your name’s already inside, you’re not coming in twice. Normalization is the rule that names are checked in the same handwriting.',
          nounsNote: 'Which of your data gates needs a guest list?',
        },
      },
      worked: {
        title: 'The 500-row gauntlet — watch the numbers fall',
        intro: 'Full cleaning chain, with the running count.',
        narration:
          'Five hundred rows enter. Watch the counters. Normalization runs first: every email lowercased and trimmed, every date converted, every missing plan defaulted. ' +
          'Then the first guard: forty-one items have no usable email, and they stop. ' +
          'Then the second guard with the memory: eighty-three duplicates, gone. ' +
          'What reaches the CRM is three hundred seventy-six clean, unique rows — and every rejection has a reason and a count. That is a pipeline you can defend in a meeting.',
        predict: {
          q: '500 dirty rows enter the gauntlet. What reaches the CRM?',
          options: ['376 — every rejection counted and explained', 'All 500 — cleaning is cosmetic', '0 — dirty data cannot be saved'],
          correct: 0,
          explain: '41 stopped for blanks, 83 for duplicates — 376 with reasons attached.',
        },
        flow: { total: 14, stops: { fblank: 3, fdupe: 4 } },
        script: [
          { t: 0, do: 'caption', text: '500 rows enter. Watch the counters.' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1500, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1700, do: 'addNode', node: set, state: 'running' },
          { t: 3100, do: 'setNode', id: 'set', state: 'ok' },
          { t: 3300, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
          { t: 3500, do: 'caption', text: 'Normalize: 500 items — emails lowercased and trimmed, dates to ISO, defaults filled.' },
          { t: 5600, do: 'addNode', node: fblank, state: 'running' },
          { t: 7000, do: 'setNode', id: 'fblank', state: 'ok' },
          { t: 7200, do: 'addEdge', edge: { id: 'e2', source: 'set', target: 'fblank' } },
          { t: 7400, do: 'note', text: '41 items stopped — no usable email' },
          { t: 7600, do: 'addNode', node: fdupe, state: 'running' },
          { t: 9000, do: 'setNode', id: 'fdupe', state: 'ok' },
          { t: 9200, do: 'addEdge', edge: { id: 'e3', source: 'fblank', target: 'fdupe' } },
          { t: 9400, do: 'note', text: '83 items stopped — duplicates' },
          { t: 9600, do: 'addNode', node: crm, state: 'running' },
          { t: 11200, do: 'setNode', id: 'crm', state: 'ok' },
          { t: 11400, do: 'addEdge', edge: { id: 'e4', source: 'fdupe', target: 'crm' } },
          { t: 11600, do: 'note', text: '376 clean, unique rows appended to the CRM ✓' },
          { t: 12000, do: 'caption', text: '500 in, 376 truth out. Every rejection has a reason. That’s a pipeline you can defend in a meeting.' },
        ],
      },
      scenarioQs: [
        {
          q: 'After deduping, the CRM still shows one duplicate. Likely cause?',
          options: ['Two rows with different letter-casing slipped past unnormalized comparison', 'The CRM is haunted', 'n8n duplicated them during the run'],
          correct: 0,
          explain: 'Dedup compares values — if they weren’t normalized first, twins look like strangers. Normalize → dedupe, always in that order.',
        },
        {
          q: 'Ana asks why only 376 of 500 rows made it. Your best answer?',
          options: [
            '41 had no usable email, 83 were duplicates — every rejection has a reason and a count',
            'The rest are in another sheet somewhere',
            'Deduplication is random',
          ],
          correct: 0,
          explain: 'Cleaning with visible counts turns “trust me” into evidence. That’s what makes automation work defensible.',
        },
      ],
    },
  ],

  /* ---------------- CONSOLIDATED GUIDED BUILD ---------------- */
  guided: {
    situation: "The 500-row export is sitting in the sheet: three date formats, mixed-case emails with stray spaces, duplicates from a double import, blank plans. The CRM rejects anything dirty, and Ana needs it loaded by Friday. Build the pipeline that lets only clean, unique rows in.",
    title: 'Build the cleaning pipeline yourself',
    intro: 'Five steps, each explained before you touch it. By the end you’ll have the full 500-row gauntlet.',
    steps: [
      {
        task: 'Start with the Sheet Trigger.',
        before: 'The 500-row export is already in the sheet. The trigger will fire once per row — 500 items, one execution.',
        paletteLabel: 'Sheet Trigger', accept: 'trigger',
        after: 'Live. Every row in that export is now an item on the belt.',
      },
      {
        task: 'Add Normalize Fields (the Set node).',
        before: 'Expressions inside Set lowercase and trim every email, convert the three date formats to ISO, and default missing plans to “free”. Transformation before protection.',
        paletteLabel: 'Normalize Fields', accept: 'data',
        after: 'All 500 items now speak the same language — comparable, mergable, CRM-shaped.',
      },
      {
        task: 'Guard #1: the blank-email filter.',
        before: 'Now that values are trimmed, “ ” is visibly empty. This guard stops 41 items that would have haunted the CRM forever.',
        paletteLabel: 'Filter: Blank Emails', accept: 'logic',
        after: 'Blanks: stopped. First count on the board.',
      },
      {
        task: 'Guard #2: the duplicate-ID filter.',
        before: 'It remembers every normalized email it has seen. Sam’s double-import (83 repeats) hits a wall here.',
        paletteLabel: 'Filter: Duplicate IDs', accept: 'logic',
        after: 'Duplicates: stopped. The guest list works because values were normalized first — order is the lesson.',
      },
      {
        task: 'Land it: Append to CRM.',
        before: 'Only clean, unique, correctly-shaped items remain. The action writes them to the CRM — 376 rows, zero by hand.',
        paletteLabel: 'Append to CRM', accept: 'action',
        after: 'Pipeline complete: normalize → guard → guard → land. Friday’s deadline just got easy.',
      },
    ],
    palette: [
      { label: 'Sheet Trigger', kind: 'trigger' },
      { label: 'Normalize Fields', kind: 'data' },
      { label: 'Filter: Blank Emails', kind: 'logic' },
      { label: 'Filter: Duplicate IDs', kind: 'logic' },
      { label: 'Append to CRM', kind: 'action' },
      { label: 'Wait', kind: 'wait', decoy: true },
      { label: 'AI Classifier', kind: 'ai', decoy: true },
    ],
    predict: {
      q: '500 dirty rows enter your finished pipeline. What ships to the CRM?',
      options: ['376 clean, unique rows — 124 stopped by the guards', 'All 500 — cleaning is cosmetic', '124 rows — only the junk gets through'],
      correct: 0,
      explain: '41 stopped for blanks, 83 for duplicates: 376 rows with reasons attached.',
    },
    flow: { total: 14, stops: { node3: 2, node4: 4 } },
    finalNarration:
      'Here is the full run on the five-hundred-row export. The trigger picks up every row. ' +
      'Normalize Fields does the heavy lifting: emails trimmed and lowercased, three date formats turned into one, missing plans filled in. ' +
      'Now the guards can trust what they compare. Forty-one rows stop at the blank-email filter. Eighty-three more stop at the duplicate filter. ' +
      'And three hundred seventy-six clean, unique rows land in the CRM. ' +
      'Five hundred in, three hundred seventy-six out — and you can explain every single rejection.',
    finalScript: [
      { t: 0, do: 'caption', text: 'Full run — the 500-row export.' },
      { t: 400, do: 'setNode', id: 'node1', state: 'running' },
      { t: 1400, do: 'setNode', id: 'node1', state: 'ok' },
      { t: 1600, do: 'setNode', id: 'node2', state: 'running' },
      { t: 3000, do: 'setNode', id: 'node2', state: 'ok' },
      { t: 3200, do: 'setNode', id: 'node3', state: 'running' },
      { t: 4600, do: 'setNode', id: 'node3', state: 'ok' },
      { t: 4800, do: 'note', text: '41 stopped — no usable email' },
      { t: 5000, do: 'setNode', id: 'node4', state: 'running' },
      { t: 6400, do: 'setNode', id: 'node4', state: 'ok' },
      { t: 6600, do: 'note', text: '83 stopped — duplicates' },
      { t: 6800, do: 'setNode', id: 'node5', state: 'running' },
      { t: 8200, do: 'setNode', id: 'node5', state: 'ok' },
      { t: 8500, do: 'note', text: '376 clean rows in the CRM ✓' },
      { t: 8800, do: 'caption', text: '500 → 376, and you can explain every single rejection. That’s the module.' },
    ],
    breakDrill: {
      title: 'Break it on purpose',
      intro: 'The gauntlet works. Now feel exactly which decision was holding it together.',
      task: 'Let duplicate customers reach the CRM.',
      bugs: [
        { label: 'Move the duplicate filter AFTER the CRM append', note: 'Rows land first, deduped never' },
        { label: 'Lowercase the emails', note: 'That’s normalization — it HELPS dedup' },
        { label: 'Add a second blank-guard', note: 'Redundant, but harmless to dedup' },
      ],
      correct: 0,
      brokenCaption: 'Dedup now runs after the CRM write. The CRM eats everything.',
      brokenNarration:
        'You moved the duplicate filter after the CRM write, so run it again. ' +
        'The rows are normalized, the blanks are stopped — and then everything goes straight into the CRM. ' +
        'Four hundred fifty-nine rows are written, and eighty-three of them are duplicates. ' +
        'The filter still runs afterwards, but it is protecting nothing: the data has already landed. ' +
        'Ana opens the CRM and finds the same customer twice. A guard placed after the action is not a guard. Order is the design.',
      brokenScript: [
        { t: 0, do: 'caption', text: 'Re-running with dedupe moved downstream…' },
        { t: 400, do: 'setNode', id: 'node1', state: 'ok' },
        { t: 900, do: 'setNode', id: 'node2', state: 'ok' },
        { t: 1400, do: 'setNode', id: 'node3', state: 'ok' },
        { t: 1900, do: 'setNode', id: 'node5', state: 'running' },
        { t: 3200, do: 'setNode', id: 'node5', state: 'ok' },
        { t: 3500, do: 'note', text: '⚠ 459 rows written — 83 of them duplicates' },
        { t: 4000, do: 'note', text: 'Ana: “why does Priya Sharma appear twice in the CRM?”' },
        { t: 4400, do: 'caption', text: 'A guard placed after the action protects nothing. Order IS the design.' },
      ],
      fix: 'Move the duplicate filter back before the CRM append',
      fixCaption: 'Order restored — normalize, guard, guard, then land.',
      fixNarration:
        'Put the filter back where it belongs and run it once more. ' +
        'Normalize, then the blank guard, then the duplicate guard — eighty-three repeats stopped before anything is written. ' +
        'Only then does the CRM append run. Three hundred seventy-six rows, zero duplicates. ' +
        'You moved one node, and got a completely different outcome.',
      fixScript: [
        { t: 0, do: 'caption', text: 'Re-running in the right order…' },
        { t: 500, do: 'setNode', id: 'node1', state: 'ok' },
        { t: 1100, do: 'setNode', id: 'node2', state: 'ok' },
        { t: 1700, do: 'setNode', id: 'node3', state: 'ok' },
        { t: 2300, do: 'setNode', id: 'node4', state: 'ok' },
        { t: 2900, do: 'note', text: '83 duplicates stopped before the CRM ✓' },
        { t: 3400, do: 'setNode', id: 'node5', state: 'running' },
        { t: 4200, do: 'setNode', id: 'node5', state: 'ok' },
        { t: 4600, do: 'caption', text: '376 rows, zero duplicates. One node moved — whole different outcome.' },
      ],
    },
  },

  /* Pre-assessment items — two per sub-module. All modules’ items are asked once, before Module 1. Not graded:
     it only sets how much support each lesson opens with. */
  precheck: [
    { sub: '2.1', q: "What does an expression that trims and lower-cases an email field do?", options: ["Cleans that field for each item as it passes through","Runs once and rewrites the sheet","Sends an email"], correct: 0, explain: "Expressions are evaluated per item, on the fly — the source is untouched." },
    { sub: '2.1', q: "An expression returns “undefined”. Most likely cause?", options: ["The field name is misspelled or missing","The workflow is too long","The trigger is paused"], correct: 0, explain: "Undefined almost always means the field you named isn’t on the item." },
    { sub: '2.2', q: "What is the Set (Edit Fields) node for?", options: ["Renaming, adding and reshaping fields","Stopping items","Starting the workflow"], correct: 0, explain: "Set changes the shape of each item; it doesn’t stop anything." },
    { sub: '2.2', q: "Some rows have no plan value and the CRM requires one. Cleanest approach?", options: ["Fill a default in the Set node","Delete those rows by hand","Let the CRM reject them"], correct: 0, explain: "Defaults belong in the transform step — once, upstream." },
    { sub: '2.3', q: "Why normalise emails before removing duplicates?", options: ["So two spellings of the same address are seen as the same","It makes the workflow faster","Duplicates can’t be removed otherwise"], correct: 0, explain: "Dedup compares values, so they have to be in one format first." },
    { sub: '2.3', q: "500 rows go in and 376 reach the CRM. What should you be able to say about the other 124?", options: ["Exactly why each one was stopped","Nothing — they were junk","That the CRM lost them"], correct: 0, explain: "A good pipeline counts its rejections and can explain every one." },
  ],

  quiz: {
    passMark: 0.8,
    teachbackPrompt: 'Optional, in your own words: why normalize before filtering? A sentence for your future self. (Saved to your Reference Book.)',
    questions: [
      { sub: '2.1', q: 'An expression like {{ $json["Email"].toLowerCase() }} runs…', options: ['once per item', 'once per workflow', 'once per node type'], correct: 0,
        explain: 'Expressions evaluate per item — 500 items, 500 evaluations.' },
      { sub: '2.1', q: '“PRIYA@X.com ” needs which cleanup?', options: ['.trim().toLowerCase()', '.slice(0, 4)', '.toUpperCase()'], correct: 0,
        explain: 'Whitespace then case — the two classics that make values comparable.' },
      { sub: '2.2', q: 'The CRM needs fullName; the sheet has two columns. You…', options: ['Compute it in Set', 'Rename the CRM fields', 'Concatenate in the Slack message'], correct: 0,
        explain: 'Set is the bridge: manufacture the shape the destination needs, keep the source honest.' },
      { sub: '2.2', q: 'Set node vs Filter node — the split is…', options: ['Set changes item shape; Filter selects which items continue', 'Both do both', 'Set selects; Filter shapes'], correct: 0,
        explain: 'Shape versus selection. Pipelines stay readable when each node does one job.' },
      { sub: '2.2', q: 'Defaulting plan = “free” in Set is better than hand-fixing rows because…', options: ['The decision is made once, in code, visible to everyone', 'It’s faster to type', 'Hand fixes are forbidden'], correct: 0,
        explain: 'A default is a policy, not a chore. Policies live in the pipeline.' },
      { sub: '2.3', q: 'Correct cleaning order?', options: ['Normalize → blank-guard → dedupe', 'Dedupe → normalize → blank-guard', 'Blank-guard → dedupe → normalize'], correct: 0,
        explain: 'Filters compare values — they can only be trusted if normalization ran first.' },
      { sub: '2.3', q: 'RECALL · Module 1: One sheet row becomes one…', options: ['Item', 'Execution', 'Workflow'], correct: 0, recall: true,
        explain: 'Still true, still load-bearing: executions carry items. (You answered this in Module 1 — this is your brain’s spaced repetition.)' },
      { sub: '2.3', q: 'RECALL · Module 1: What protects an action’s output channel?', options: ['A guard: logic placed before the action', 'Renaming the channel', 'More actions'], correct: 0, recall: true,
        explain: 'Guards before actions — the principle that kept #new-leads trustworthy now keeps the CRM clean.' },
    ],
  },

  reviews: [
    { dueInDays: 3, title: 'Health check · Clean Data Feed',
      scenario: 'The CRM flags 2 duplicate customers. Both emails differ only by casing. Which decision in your pipeline failed?',
      options: ['Normalization ran after dedup — or not at all for those rows', 'The CRM’s font makes them look alike', 'The Sheet Trigger fired twice'],
      correct: 0,
      explain: 'Dedup compares values — unnormalized twins look like strangers. Normalize first, always.',
      award: 'expression-typos' },
    { dueInDays: 10, title: 'Health check · Clean Data Feed',
      scenario: 'Marketing adds a new column “Coupon” to the sheet. Your CRM feed suddenly has 6 fields. Which node do you tighten?',
      options: ['The Set node — keep only the 5 fields the CRM needs', 'The duplicate filter', 'The Sheet Trigger'],
      correct: 0,
      explain: 'Set owns the shape. Keep-only is what keeps feeds lean no matter what grows upstream.',
      award: null },
    { dueInDays: 30, title: 'Health check · Clean Data Feed',
      scenario: 'A one-off bad import pumps 3,000 dirty rows into the sheet overnight. What protects the CRM?',
      options: ['The guards — blanks and dupes stop at the filters, counts show exactly what happened', 'Nothing, the CRM floods', 'You notice in three weeks'],
      correct: 0,
      explain: 'This is why guards + counts beat cleaning by hand. The pipeline absorbs the bad day and shows its work.',
      award: 'rate-limit' },
  ],
}
