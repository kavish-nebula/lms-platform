import { NEBULA } from '../course.js'
import { pipelineRow } from '../../canvas/layout.js'
import video11 from '../videos/m1-1.js'
import video12 from '../videos/m1-2.js'
import video13 from '../videos/m1-3.js'

/*
  Module 1 — Foundations: Your First Working Workflow
  Interior blueprint: hook → 3 sub-modules (explain → worked → scenario Qs)
  → one guided build (with break-drill) → capstone → module quiz.
  Narration = the spoken audio script; captions = on-screen subtitles.
*/

const [sheet, set, filter, slack] = pipelineRow([
  { id: 'sheet',  kind: 'trigger', label: 'Sheet Trigger',    sub: 'new row appears' },
  { id: 'set',    kind: 'data',    label: 'Clean Up Fields',  sub: 'rename columns' },
  { id: 'filter', kind: 'logic',   label: 'Block Empty Rows', sub: 'pass or stop' },
  { id: 'slack',  kind: 'action',  label: 'Slack #new-leads', sub: 'alert per item' },
])
const CHAIN = [
  { id: 'e1', source: 'sheet', target: 'set' },
  { id: 'e2', source: 'set', target: 'filter' },
  { id: 'e3', source: 'filter', target: 'slack' },
]

export default {
  id: 'm1',
  n: 1,
  title: 'Foundations: Your First Working Workflow',

  hook: {
    kicker: 'The wake-up call',
    title: '2:07 AM',
    introNarration:
      'It is 7 AM at Nebula, a coffee subscription company. This morning you inherit their automations. ' +
      'Friday night at 2:07 AM, the lead alert workflow died. Nobody noticed for sixty-one hours. ' +
      'Forty leads sat in a spreadsheet while the founder slept. Before we explain anything — look at the pipeline and tell me: where do you think it died?',
    whyMatters: {
      text: 'Nebula is a coffee subscription company. As of this morning, you run their automations. The lead alert workflow died on Friday night — and nobody noticed until the founder did.',
      stat: '40 leads lost · 61 hours silent',
    },
    slackMsgs: [
      { who: 'Ana — founder', av: 'A', at: '7:02 AM', text: 'did the lead form break? nothing since friday. we lost every lead from the weekend' },
      { who: 'Ana — founder', av: 'A', at: '7:03 AM', text: '40 leads. FORTY.' },
      { who: 'Tom — sales', av: 'T', at: '7:05 AM', text: 'so… who is calling them back 😬' },
    ],
    pinPrompt: 'Before anything is explained: where do you think it died? Click the node.',
    hunches: [
      { id: 'auth', label: 'The Slack connection expired' },
      { id: 'sheet', label: 'The sheet stopped sending rows' },
      { id: 'filter', label: 'The filter is blocking everything' },
    ],
    baseNodes: [sheet, set, filter, slack],
    baseEdges: CHAIN,
    correctHunch: 'auth',
    pinCaption: 'Lead Alerts — frozen since 2:07 AM',
    revealNarration:
      'Here is the last execution, frame by frame. ' +
      'The Sheet Trigger fires — a new row arrived, exactly as it should. ' +
      'Clean Up Fields renames the columns. Fine. The filter checks for an email and lets the lead through. Also fine. ' +
      'Then the workflow reaches Slack, and Slack refuses the call. Invalid token. ' +
      'The credentials expired on Friday night, and nothing in this workflow was built to say so. ' +
      'Every step before it worked. The failure was at the very last node — and it was silent.',
    revealScript: [
      { t: 0, do: 'caption', text: 'The last execution, frame by frame —' },
      { t: 300, do: 'setNode', id: 'sheet', state: 'running' },
      { t: 1200, do: 'setNode', id: 'sheet', state: 'ok' },
      { t: 1300, do: 'setNode', id: 'set', state: 'running' },
      { t: 2100, do: 'setNode', id: 'set', state: 'ok' },
      { t: 2200, do: 'setNode', id: 'filter', state: 'running' },
      { t: 2900, do: 'setNode', id: 'filter', state: 'ok' },
      { t: 3100, do: 'setNode', id: 'slack', state: 'running' },
      { t: 4200, do: 'setNode', id: 'slack', state: 'error' },
      { t: 4300, do: 'setEdge', id: 'e3', state: 'error' },
      { t: 4600, do: 'caption', text: 'Slack rejected the call: invalid_token. The credentials expired Friday night — and nothing screamed.' },
    ],
    wrapCorrect: 'Called it. Slack threw invalid_token — the credentials expired Friday night, and the workflow kept “succeeding” right up until it didn’t.',
    wrapWrong: 'Close — the trigger and the filter did their jobs all weekend. The failure was at the very end: Slack threw invalid_token. Credentials had expired Friday night.',
    wrapPoint: 'That’s the shape of real automation work: most failures are quiet, and they happen at the edges.',
  },

  submodules: [
    /* ---------------- 1.1 WORKFLOW ANATOMY ---------------- */
    {
      id: '1.1',
      title: 'Workflow anatomy',
      video: video11, // the concept is taught by a narrated slide video
      explainer: {
        beats: [
          {
            narration:
              'A workflow is a pipeline that wakes itself up, and it all starts with the trigger. ' +
              'Watch the first node form: this is a Sheet Trigger, and its whole job is to notice when a new row appears. ' +
              'Nothing in this entire workflow runs until that node fires. No trigger, no execution — that rule has no exceptions. ' +
              'Everything else you will ever build is just smarter stuff that happens after the ring.',
            script: [
              { t: 0, do: 'caption', text: 'A workflow is a pipeline that wakes itself up. Watch the first piece appear.' },
              { t: 200, do: 'addNode', node: sheet, state: 'running' },
              { t: 1400, do: 'setNode', id: 'sheet', state: 'ok' },
              { t: 1500, do: 'caption', text: 'Trigger — “a new row appeared” wakes the workflow. Nothing runs until it fires.' },
            ],
            why: { sheet: 'The entry point. Listens for an outside event (new row, webhook, clock tick) and starts one execution.' },
            check: {
              q: 'What wakes this workflow up?',
              options: ['The trigger — a new sheet row', 'A person clicks “Run” every morning', 'The Slack node checks for leads'],
              correct: 0,
              explain: 'The trigger is the only self-starter. Actions only run when an execution reaches them.',
            },
          },
          {
            narration:
              'Now the other half: the action. This Slack node is where the visible work happens — it posts a message to the team, per lead. ' +
              'Connect a trigger to an action and you already have a complete, working automation. Two nodes. That is genuinely it. ' +
              'Every node you add later is just intelligence squeezed between the wake-up and the work.',
            script: [
              { t: 0, do: 'addNode', node: slack, state: 'running' },
              { t: 1300, do: 'setNode', id: 'slack', state: 'ok' },
              { t: 1400, do: 'addEdge', edge: { id: 'e-direct', source: 'sheet', target: 'slack' } },
              { t: 1600, do: 'caption', text: 'Action — the visible work. Trigger → action: already a complete, working automation.' },
            ],
            why: { slack: 'The visible output. Whatever reaches an action, happens — publicly. Guard it with logic upstream.' },
            check: {
              q: 'The smallest possible n8n workflow is…',
              options: ['Trigger → Action', 'Trigger → Logic → Action → Logic', 'Five nodes, always'],
              correct: 0,
              explain: 'Two nodes can be production-worthy. Logic nodes earn their place as the workflow grows.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The doorbell version',
          analogy: 'The trigger is a doorbell: no press, no anything. The action is what happens next — the door opens. Everything else you will ever add is just smarter stuff happening between the ring and the door.',
          nounsNote: 'Your turn: in your own work, what would the doorbell be? What opens?',
        },
      },
      worked: {
        title: 'Watch a minimal workflow run',
        intro: 'Two nodes. One run. See how an execution flows through them.',
        narration:
          'Friday evening, six-oh-two: someone submits the lead form. The trigger fires, and one execution begins — carrying exactly one item: Priya, priya at example dot com. ' +
          'The item flows down the connection into the Slack node, which posts to the new-leads channel. Execution complete in three hundred eighty milliseconds. ' +
          'Nobody had to check anything. That is the entire promise of this course, in miniature.',
        predict: {
          q: 'One submission just hit the form. What will you see when this runs?',
          options: ['One Slack alert for Priya', 'Nothing — triggers need several submissions', 'Three alerts at once'],
          correct: 0,
          explain: 'One trigger fire = one execution = one alert. Predictions get sharper every time you commit to one.',
        },
        flow: { total: 1, stops: {} },
        script: [
          { t: 0, do: 'caption', text: 'Friday, 6:02 PM — someone submits the lead form.' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1600, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1800, do: 'caption', text: 'The trigger fires → one execution, one item: Priya, priya@example.com, from the launch-page form.' },
          { t: 3600, do: 'addNode', node: slack, state: 'running' },
          { t: 5000, do: 'setNode', id: 'slack', state: 'ok' },
          { t: 5200, do: 'addEdge', edge: { id: 'e-direct', source: 'sheet', target: 'slack' } },
          { t: 5400, do: 'caption', text: 'The action posts to #new-leads. Execution #2,440: green. Total time, 380ms.' },
        ],
      },
      scenarioQs: [
        {
          q: 'Nebula’s form gets 3 submissions in one minute. How many executions run?',
          options: ['3 — one per trigger fire', '1 — they batch automatically', '0 — executions only happen on weekdays'],
          correct: 0,
          explain: 'Every trigger fire starts its own execution. Three submissions, three runs — each traceable on its own.',
        },
        {
          q: 'The Slack node throws an error mid-run. What happens to the rest of that execution?',
          options: [
            'It stops there — nothing after the failing node runs',
            'It skips the error and continues',
            'The whole workflow is deleted',
          ],
          correct: 0,
          explain: 'A failed node ends that execution. Which is exactly why a silent failure like Friday’s is so dangerous — and why Module 4 exists.',
        },
      ],
    },

    /* ---------------- 1.2 DATA & ITEMS ---------------- */
    {
      id: '1.2',
      title: 'Data & items',
      video: video12,
      explainer: {
        beats: [
          {
            narration:
              'Next word: item. One row of the sheet becomes exactly one item inside the run. ' +
              'The Set node — Clean Up Fields — takes each item and reshapes it: first name becomes firstName, email gets cleaned up. ' +
              'It does this per item, automatically, for every row that passes. Data hygiene happens once, here — not patched in five places later.',
            script: [
              { t: 0, do: 'addNode', node: set, state: 'running' },
              { t: 1200, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1300, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
              { t: 1500, do: 'caption', text: 'Item — one sheet row = one item. The Set node reshapes each one so nothing downstream chokes.' },
            ],
            why: { set: 'Reshapes each item’s fields once. Data hygiene lives here instead of being patched in five places later.' },
            check: {
              q: 'One sheet row becomes…',
              options: ['One item', 'One execution', 'One workflow'],
              correct: 0,
              explain: 'A run is one execution. Inside it, each row travels as its own item — 60 rows, 60 items, one execution.',
            },
          },
          {
            narration:
              'Logic is the third piece: the Filter. It looks at each item and makes a decision — pass, or stop. ' +
              'A row with no email? Stopped right here, silently, before it can embarrass anyone. ' +
              'And because actions run per item, this matters more than it seems: forty-eight clean items mean forty-eight alerts. Junk items are the difference between a trusted channel and a muted one.',
            script: [
              { t: 0, do: 'addNode', node: filter, state: 'running' },
              { t: 1200, do: 'setNode', id: 'filter', state: 'ok' },
              { t: 1300, do: 'addEdge', edge: { id: 'e2', source: 'set', target: 'filter' } },
              { t: 1500, do: 'caption', text: 'Logic — the Filter decides per item: pass or stop. Junk dies here, quietly.' },
            ],
            why: { filter: 'The gatekeeper. Decides which items deserve to continue. Most “Slack is full of junk” bugs are missing filters.' },
            check: {
              q: '60 rows arrive. 12 are empty and get filtered. 48 pass to Slack. How many alerts?',
              options: ['48 — one per surviving item', '60 — everything alerts', '1 — items merge into one alert'],
              correct: 0,
              explain: 'Actions run per item by default. Keep that fact close — it explains a lot of future pain.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The assembly-line version',
          analogy: 'Items are boxes on a belt. The Set node labels each box. The Filter is the QC station — rejects never leave the room. The action is the loading dock: whatever survives QC gets shipped, one box per truck.',
          nounsNote: 'Think about your own work: what would the belt, the QC station and the loading dock be?',
        },
      },
      worked: {
        title: 'Watch items move through the pipeline',
        intro: 'Six rows in — two junk. Follow each item’s fate.',
        narration:
          'Six rows hit the Sheet Trigger, so six items start down the belt. The Set node relabels all six: firstName, email, source — same data, speakable names. ' +
          'Then the Filter asks each item one question: is your email present? Two of them say no, and they stop right there — no drama, no Slack message. ' +
          'The surviving four continue to Slack and post. Six in, four alerts, two rejections with reasons. That is the whole mental model of data quality.',
        predict: {
          q: '6 rows enter — 2 have no email. How many alerts post?',
          options: ['4 — the junk stops at the Filter', '6 — filters only tag junk', '2 — only the junk gets alerted'],
          correct: 0,
          explain: 'The Filter is a per-item gate: two items stop, four continue to Slack.',
        },
        flow: { total: 6, stops: { filter: 2 } },
        script: [
          { t: 0, do: 'caption', text: 'Six rows hit the Sheet Trigger. Six items start moving.' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1400, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1600, do: 'addNode', node: set, state: 'running' },
          { t: 2800, do: 'setNode', id: 'set', state: 'ok' },
          { t: 3000, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
          { t: 3200, do: 'caption', text: 'Set renames all six: firstName, email, source. Same data, speakable names.' },
          { t: 5200, do: 'addNode', node: filter, state: 'running' },
          { t: 6600, do: 'setNode', id: 'filter', state: 'ok' },
          { t: 6800, do: 'addEdge', edge: { id: 'e2', source: 'set', target: 'filter' } },
          { t: 7000, do: 'caption', text: 'Filter checks each item: email present? Two say no. They stop here.' },
          { t: 9200, do: 'addNode', node: slack, state: 'running' },
          { t: 10600, do: 'setNode', id: 'slack', state: 'ok' },
          { t: 10800, do: 'addEdge', edge: { id: 'e3', source: 'filter', target: 'slack' } },
          { t: 11000, do: 'caption', text: 'Four alerts post. Four items through, two stopped at the gate. That is the whole mental model.' },
        ],
      },
      scenarioQs: [
        {
          q: 'A row has a name but no email, and the Filter requires a non-empty email. Where does the item end up?',
          options: ['Stopped at the Filter — never reaches Slack', 'In Slack with a blank email', 'Nowhere — the execution crashes'],
          correct: 0,
          explain: 'Filters act per item. One stopped item never affects the others.',
        },
        {
          q: 'Why rename “First Name” to firstName in the Set node?',
          options: [
            'So every downstream node reads a clean, predictable field name',
            'Because n8n forbids spaces in sheet columns',
            'No reason — it just looks nicer',
          ],
          correct: 0,
          explain: 'Hygiene once, upstream. Later nodes (and expressions in Module 2) depend on names you can trust.',
        },
      ],
    },

    /* ---------------- 1.3 BUILD THE LEAD ALERT ---------------- */
    {
      id: '1.3',
      title: 'Build the lead alert',
      video: video13,
      explainer: {
        beats: [
          {
            narration:
              'One more concept before you build, and it is the one Ana cares about most: the guard. ' +
              'A guard is logic placed before an action — the Filter sitting in front of Slack. ' +
              'Its job is to protect the channel: only items that deserve attention get through. ' +
              'Actions amplify whatever reaches them. Feed them junk and people mute the channel; feed them signal and people trust it. Friday happened because something else failed — but most Slack disasters are simply missing guards.',
            script: [
              { t: 0, do: 'caption', text: 'One more concept before you build: the guard.' },
              { t: 300, do: 'setNode', id: 'sheet', state: 'ok' },
              { t: 900, do: 'setNode', id: 'set', state: 'ok' },
              { t: 1400, do: 'setNode', id: 'filter', state: 'running' },
              { t: 2400, do: 'setNode', id: 'filter', state: 'ok' },
              { t: 2600, do: 'caption', text: 'Guard — logic placed before an action. The Filter before Slack keeps the channel trustworthy.' },
            ],
            why: { filter: 'A guard is any logic node protecting an action. Guards make channels trustworthy; without one, people mute the channel and the automation dies socially.' },
            check: {
              q: 'Ana says “Slack is full of junk, everyone muted it.” First thing to check?',
              options: [
                'Is there a Filter (guard) before the Slack node?',
                'Rename the Slack channel',
                'Tell everyone to un-mute',
              ],
              correct: 0,
              explain: 'Junk in a channel is almost always a missing or broken guard upstream of the action.',
            },
          },
        ],
        altTake: {
          offer: 'Want this a different way?',
          analogyTitle: 'The bouncer version',
          analogy: 'The Slack node is a venue. The Filter is the bouncer: no email, no entry. A venue without a bouncer is fine until one night — then it’s never fine again.',
          nounsNote: 'Where does your data need a bouncer?',
        },
      },
      worked: {
        title: 'The full rebuild — watch why each node earns its place',
        intro: 'The fix for Friday, assembled piece by piece. Two things at the end will bite later — spot them.',
        narration:
          'Rebuild time. The Sheet Trigger comes first — and this time the connection is re-authorized, because an expired token was Friday’s killer. ' +
          'Clean Up Fields follows: the sheet’s columns have spaces in their names, so this node renames every field once. Nothing downstream ever chokes again. ' +
          'Block Empty Rows is the guard: forms get double-clicks and blank submissions, and this node decides per item — pass, or stop. ' +
          'Finally Slack posts name, email and source for every clean item. Twelve good rows, twelve alerts, and the channel stays worth reading. ' +
          'Two flaws are still hiding in there, though — keep your eyes open.',
        predict: {
          q: 'Before the rebuild runs: what makes this version trustworthy?',
          options: ['Every clean item alerts — junk never reaches Slack', 'It posts faster', 'It uses a private channel'],
          correct: 0,
          explain: 'Trust = guards. The Filter before Slack is the whole difference.',
        },
        flow: { total: 12, stops: { filter: 0 } },
        script: [
          { t: 0, do: 'caption', text: 'Rebuild it properly. Watch why each node earns its place.' },
          { t: 400, do: 'addNode', node: sheet, state: 'running' },
          { t: 1600, do: 'setNode', id: 'sheet', state: 'ok' },
          { t: 1800, do: 'caption', text: 'Sheet Trigger — wakes on every new row. Connection re-authed first: Ana’s expired token was Friday’s killer.' },
          { t: 3600, do: 'addNode', node: set, state: 'running' },
          { t: 5000, do: 'setNode', id: 'set', state: 'ok' },
          { t: 5200, do: 'addEdge', edge: { id: 'e1', source: 'sheet', target: 'set' } },
          { t: 5400, do: 'caption', text: 'Clean Up Fields — the sheet’s columns have spaces. Rename them once, so nothing downstream ever chokes.' },
          { t: 7600, do: 'addNode', node: filter, state: 'running' },
          { t: 9000, do: 'setNode', id: 'filter', state: 'ok' },
          { t: 9200, do: 'addEdge', edge: { id: 'e2', source: 'set', target: 'filter' } },
          { t: 9400, do: 'caption', text: 'Block Empty Rows — forms get blank submissions and double-clicks. This node decides, per item: pass or stop.' },
          { t: 11600, do: 'addNode', node: slack, state: 'running' },
          { t: 13000, do: 'setNode', id: 'slack', state: 'ok' },
          { t: 13200, do: 'addEdge', edge: { id: 'e3', source: 'filter', target: 'slack' } },
          { t: 13400, do: 'caption', text: 'Slack #new-leads — name, email, source, per clean item. The channel stays trustworthy.' },
          { t: 15400, do: 'caption', text: 'Done. But two flaws hide here: a hard-coded channel, and nothing watching while it sleeps.' },
        ],
      },
      scenarioQs: [
        {
          q: 'Sam deletes the Filter “just to test”. Overnight: 60 rows, 12 empty. What lands in Slack?',
          options: ['60 alerts, including 12 blanks', '48 alerts — n8n auto-filters empties', 'Nothing — workflows need a Filter to run'],
          correct: 0,
          explain: 'Without the guard, every item reaches the action. One noisy night, and the channel loses everyone’s trust.',
        },
        {
          q: 'Friday’s outage had a silent cause. Which habit would have caught it earliest?',
          options: [
            'Watching execution history after every change — the red run was visible for 61 hours',
            'Renaming the workflow',
            'Adding more Slack channels',
          ],
          correct: 0,
          explain: 'The failing run sat in the execution list the whole weekend. Reading run data is the automation engineer’s microscope.',
        },
      ],
    },
  ],

  /* ---------------- CONSOLIDATED GUIDED BUILD ---------------- */
  guided: {
    situation: "Monday, 9 AM. The lead form is live again and Ana wants every new lead in #new-leads within a minute — without the empty rows and double-clicks that flooded the channel last time. You have an empty canvas and four decisions to make. Build the workflow that does it.",
    title: 'Build the lead alert yourself',
    intro: 'Step by step, you assemble the real workflow. Each step tells you what will happen before you do it.',
    steps: [
      {
        task: 'Drag the Sheet Trigger onto the empty canvas.',
        before: 'Every workflow starts with a trigger. Without one, nothing can ever run — this node is the doorbell.',
        paletteLabel: 'Sheet Trigger', accept: 'trigger',
        after: 'The trigger is live. From this moment, one new sheet row = one execution.',
      },
      {
        task: 'Add the Set node after the trigger.',
        before: 'The sheet’s columns have spaces (“First Name”). The Set node renames them once, so every later node reads clean names.',
        paletteLabel: 'Clean Up Fields', accept: 'data',
        after: 'Fields are renamed — firstName, email, source. Data hygiene: done, once, upstream.',
      },
      {
        task: 'Now the guard: add the Filter between Set and Slack.',
        before: 'Forms get empty submissions and double-clicks. The Filter checks each item — email present? — and stops junk before it can reach anyone.',
        paletteLabel: 'Block Empty Rows', accept: 'logic',
        after: 'The guard is in place. Junk dies here, quietly, permanently.',
      },
      {
        task: 'Finish with the action: drag Slack onto the end.',
        before: 'The action is the visible work — one alert per clean item, name and email included. Whatever reaches it, happens.',
        paletteLabel: 'Slack #new-leads', accept: 'action',
        after: 'The pipeline is complete: trigger → clean → guard → alert.',
      },
    ],
    palette: [
      { label: 'Sheet Trigger', kind: 'trigger' },
      { label: 'Clean Up Fields', kind: 'data' },
      { label: 'Block Empty Rows', kind: 'logic' },
      { label: 'Slack #new-leads', kind: 'action' },
      { label: 'Wait', kind: 'wait', decoy: true },
      { label: 'HTTP Request', kind: 'http', decoy: true },
    ],
    predict: {
      q: '60 real items enter your rebuilt pipeline — 12 with no email. What happens?',
      options: ['48 alerts — 12 stopped at the Filter', '60 alerts — Filters only warn', '48 executions'],
      correct: 0,
      explain: 'Per-item guards, per-item actions: 60 in, 12 stopped, 48 clean alerts.',
    },
    flow: { total: 60, stops: { node3: 12 } },
    finalNarration:
      'This is your pipeline, running on real data. Sixty items come in from the sheet. ' +
      'The trigger wakes the workflow, and Clean Up Fields renames every column once, upstream. ' +
      'Now the filter checks each item for an email. Twelve have none, and they stop right there — they never reach anyone. ' +
      'The remaining forty-eight flow on to Slack, one alert each. ' +
      'Sixty in, twelve stopped, forty-eight alerts. You built that, and every green node is a decision you made.',
    finalScript: [
      { t: 0, do: 'caption', text: 'Full run — 60 items, real data.' },
      { t: 400, do: 'setNode', id: 'node1', state: 'running' },
      { t: 1400, do: 'setNode', id: 'node1', state: 'ok' },
      { t: 1600, do: 'setNode', id: 'node2', state: 'running' },
      { t: 2800, do: 'setNode', id: 'node2', state: 'ok' },
      { t: 3000, do: 'setNode', id: 'node3', state: 'running' },
      { t: 4200, do: 'setNode', id: 'node3', state: 'ok' },
      { t: 4400, do: 'note', text: '12 items stopped at the Filter (no email)' },
      { t: 4600, do: 'setNode', id: 'node4', state: 'running' },
      { t: 5800, do: 'setNode', id: 'node4', state: 'ok' },
      { t: 6100, do: 'note', text: '48 alerts posted to #new-leads ✓' },
      { t: 6400, do: 'caption', text: 'You built that. Every green dot is a decision you made.' },
    ],
    breakDrill: {
      title: 'Break it on purpose',
      intro: 'You’ve built it — now feel where it snaps. Break the pipeline exactly one way, watch it fail, then fix it.',
      task: 'Make this pipeline double-alert on the same lead.',
      bugs: [
        { label: 'Delete the duplicate guard', note: 'Sam’s form auto-retries; same email lands twice' },
        { label: 'Rename the Slack channel', note: 'Cosmetic — alerts still fire' },
        { label: 'Add a Wait node before Slack', note: 'Slower, but still one alert per lead' },
      ],
      correct: 0,
      brokenCaption: 'Sam’s form auto-retries… and nothing stops the repeats.',
      brokenNarration:
        'You removed the guard, so watch what happens overnight. ' +
        'One lead submits the form, and the form retries — the same lead arrives four times. ' +
        'The trigger fires each time, the fields get cleaned each time, and with nothing to stop the repeats, Slack posts four alerts for one person. ' +
        'Nothing errored. Every run is green. ' +
        'But by Wednesday, Tom has stopped reading the channel — and that is how a quiet bug costs you real leads.',
      brokenScript: [
        { t: 0, do: 'caption', text: 'Overnight: one lead, submitted 4 times (auto-retry).' },
        { t: 500, do: 'setNode', id: 'node1', state: 'running' },
        { t: 1300, do: 'setNode', id: 'node1', state: 'ok' },
        { t: 1500, do: 'setNode', id: 'node2', state: 'running' },
        { t: 2500, do: 'setNode', id: 'node2', state: 'ok' },
        { t: 2700, do: 'setNode', id: 'node4', state: 'running' },
        { t: 3700, do: 'setNode', id: 'node4', state: 'ok' },
        { t: 4000, do: 'note', text: '⚠ alert 1 — lead X' },
        { t: 4400, do: 'note', text: '⚠ alert 2 — lead X (again)' },
        { t: 4800, do: 'note', text: '⚠ alert 3 — lead X (again)' },
        { t: 5200, do: 'note', text: '⚠ alert 4 — lead X (again)' },
        { t: 5600, do: 'caption', text: 'Four alerts, one lead. Tom stops reading #new-leads by Wednesday.' },
      ],
      fix: 'Restore the duplicate guard',
      fixCaption: 'Guard restored — same 4 submissions, one alert.',
      fixNarration:
        'Now the guard is back, and the same four submissions arrive again. ' +
        'The trigger fires. This time the filter recognises the three repeats and drops them. ' +
        'One item reaches Slack: one lead, one alert. ' +
        'Same input, completely different outcome — and the only thing that changed is one node. Quiet is the feature.',
      fixScript: [
        { t: 0, do: 'caption', text: 'Re-running with the duplicate guard back…' },
        { t: 500, do: 'setNode', id: 'node1', state: 'running' },
        { t: 1300, do: 'setNode', id: 'node1', state: 'ok' },
        { t: 1500, do: 'setNode', id: 'node3', state: 'running' },
        { t: 2600, do: 'setNode', id: 'node3', state: 'ok' },
        { t: 2800, do: 'note', text: '3 repeats dropped (already seen)' },
        { t: 3000, do: 'setNode', id: 'node4', state: 'running' },
        { t: 4000, do: 'setNode', id: 'node4', state: 'ok' },
        { t: 4400, do: 'caption', text: 'One lead, one alert. Quiet is the feature.' },
      ],
    },
  },

  /* Pre-assessment items — two per sub-module. All modules’ items are asked once, before Module 1. Not graded:
     it only sets how much support each lesson opens with. */
  precheck: [
    { sub: '1.1', q: "What starts a workflow running?", options: ["A trigger — an event such as a new row or a webhook","Opening the editor","The last node in the chain"], correct: 0, explain: "A trigger listens for an event and starts one execution. Nothing runs without it." },
    { sub: '1.1', q: "What is an “execution”?", options: ["One run of the workflow, from the trigger to the last node","The workflow’s settings page","A node that sends messages"], correct: 0, explain: "Each time the trigger fires, one execution runs through the nodes in order." },
    { sub: '1.2', q: "A trigger picks up 5 new rows at once. How many items flow into the next node?", options: ["5 — one item per row","1 — the rows are merged","None until someone approves them"], correct: 0, explain: "Each row becomes its own item, and each node runs once per item." },
    { sub: '1.2', q: "What does a Filter node do with an item that fails its condition?", options: ["Stops it — it goes no further","Sends it twice","Deletes the source row"], correct: 0, explain: "A filter is a guard: items that fail simply don’t continue." },
    { sub: '1.3', q: "In a lead-alert pipeline, where should the “block empty rows” filter sit?", options: ["Before the alert is sent","After the alert is sent","It makes no difference"], correct: 0, explain: "A guard only protects what comes after it." },
    { sub: '1.3', q: "A run shows green, but nobody got the alert. What do you check first?", options: ["The last node’s response in the run data","The workflow’s name","Whether the sheet is sorted"], correct: 0, explain: "Green means the node ran, not that the other system accepted the call — read the response." },
  ],

  quiz: {
    passMark: 0.8,
    teachbackPrompt: 'Optional, in your own words: why did the alerts go silent, and how does your pipeline stop it repeating? (Saved to your Reference Book.)',
    questions: [
      { sub: '1.1', q: 'What wakes an n8n workflow up?', options: ['Its trigger', 'A cron job on the server', 'The first action node'], correct: 0,
        explain: 'Triggers are the only self-starters. Everything else runs only when an execution reaches it.' },
      { sub: '1.1', q: 'The smallest useful workflow is…', options: ['Trigger → Action', 'Action → Action', 'Trigger only'], correct: 0,
        explain: 'Two nodes can be production-worthy. Logic earns its place as the workflow grows.' },
      { sub: '1.1', q: 'A failing node mid-execution means…', options: ['That execution stops there', 'The workflow skips ahead', 'n8n retries forever by default'], correct: 0,
        explain: 'Failures end the run — that’s why silent failures are dangerous, and why Module 4 handles them properly.' },
      { sub: '1.2', q: 'One sheet row becomes one…', options: ['Item', 'Execution', 'Connection'], correct: 0,
        explain: 'Execution = the run. Items travel through it — one per row.' },
      { sub: '1.2', q: '60 rows, Filter removes 12 empties, Slack is next. How many alerts?', options: ['48', '60', '12'], correct: 0,
        explain: 'Actions run per surviving item — 48 items, 48 alerts.' },
      { sub: '1.2', q: 'The best place to rename messy column names is…', options: ['A Set node, once, near the start', 'Inside every later node', 'In the spreadsheet manually, forever'], correct: 0,
        explain: 'Hygiene once, upstream. Everything downstream reads names it can trust.' },
      { sub: '1.3', q: 'What does a Filter before Slack actually protect?', options: ['The channel’s trustworthiness', 'The sheet from edits', 'The trigger from firing'], correct: 0,
        explain: 'Actions amplify whatever reaches them. Guards keep the output clean — and channels don’t get muted.' },
      { sub: '1.3', q: 'Friday’s outage: alerts stopped at 2:07 AM, nobody noticed for 61 hours. The cheapest early-detection habit?', options: [
        'Glancing at execution history after every change — the red run was sitting there all weekend',
        'Adding a second Slack channel', 'Rebuilding the workflow from scratch'], correct: 0,
        explain: 'Run data is the microscope. The failure was visible the entire time.' },
    ],
  },

  reviews: [
    { dueInDays: 3, title: 'Health check · Lead Alerts',
      scenario: '3:00 AM: your lead alert fired 4 times for one and the same lead. Someone’s form auto-retries. Which node stops repeats like this?',
      options: ['A duplicate-check Filter before Slack', 'A Wait node between the trigger and Slack', 'Rename the Slack channel'],
      correct: 0,
      explain: 'A filter that drops already-seen emails makes the alert idempotent — retries become invisible.',
      award: 'duplicate-webhook' },
    { dueInDays: 10, title: 'Health check · Lead Alerts',
      scenario: 'Ana renamed the sheet column “Email” to “Contact”. The workflow now alerts on every row again. Which piece breaks?',
      options: ['The Slack message text', 'The Filter condition that reads the Email field', 'The Sheet Trigger'],
      correct: 1,
      explain: 'Conditions read fields by name. Rename the source and every condition that names it silently lies.',
      award: 'renamed-column' },
    { dueInDays: 30, title: 'Health check · Lead Alerts',
      scenario: 'New requirement: VIP leads should also post to #sales-vip. Smallest change that works?',
      options: ['Add a second Filter for VIPs → Slack #sales-vip, branching after the first filter', 'Delete the first filter and add two more', 'Manually forward VIPs each morning'],
      correct: 0,
      explain: 'Branch after the guard: filter once for quality, then route.',
      award: 'rate-limit' },
  ],
}
