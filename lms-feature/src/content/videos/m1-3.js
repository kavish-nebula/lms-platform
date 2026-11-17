import { video } from './prep.js'

/* Concept video — lesson 1.3: putting the parts in the right order. */
export default video({
  id: 'm1-3',
  title: 'Putting it together: the lead alert',
  slides: [
    {
      kind: 'title', icon: 'workflow', kicker: 'Module 1 · Video 3', title: 'Putting it together',
      sub: 'Trigger, clean, guard, alert — and why the order matters',
      lines: [
        'You now know the parts of a workflow, and you know how items move through it.',
        'In this lesson we put them together into one complete, working workflow.',
        'The important idea is order, because the same nodes in a different order give a different result.',
      ],
    },
    {
      kind: 'bullets', title: 'The job',
      lead: 'Ana, the founder, wants every real lead in the sales channel within a minute.',
      bullets: [
        { icon: 'send', text: 'Every new sign-up is announced', cue: 1 },
        { icon: 'x-circle', text: 'Empty forms are not announced', cue: 2 },
        { icon: 'pencil', text: 'The message uses clean field names', cue: 3 },
      ],
      aside: { icon: 'boxes', label: 'Notice', text: 'Each requirement becomes one node.', cue: 4 },
      lines: [
        'Start with what is being asked for.',
        'Every new sign-up must be announced to sales.',
        'Empty forms must not be announced.',
        'And the message should use clean, readable field names.',
        'Notice that each requirement will become exactly one node.',
      ],
    },
    {
      kind: 'flow', title: 'The shape: trigger → clean → guard → alert',
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: 'new row', cue: 1 },
        { kind: 'data', icon: 'pencil', label: 'Edit Fields', sub: 'clean names', cue: 2 },
        { kind: 'logic', icon: 'filter', label: 'Filter', sub: 'has an email', cue: 3 },
        { kind: 'action', icon: 'send', label: 'Slack', sub: 'alert sales', cue: 4 },
      ],
      note: { text: 'Four nodes, in this order. Remember the shape.', cue: 5 },
      lines: [
        'Here is the whole workflow.',
        'A Sheet Trigger starts it when a new row arrives.',
        'Edit Fields cleans the names.',
        'A Filter lets through only the rows that have an email.',
        'And Slack alerts sales.',
        'Trigger, clean, guard, alert is a shape you will reuse again and again.',
      ],
    },
    {
      kind: 'define', title: 'What is a guard?', term: 'Guard',
      definition: 'A node that checks each item and lets only the good ones continue.',
      parts: [{ text: 'Checks each item', cue: 1 }, { text: 'Good ones continue', cue: 2 }, { text: 'The rest stop here', cue: 3 }],
      analogy: { label: 'Think of it as', text: 'A ticket inspector at the gate: no ticket, no entry, and nobody inside is disturbed.' },
      lines: [
        'The Filter in the middle has a special role, and we call it a guard.',
        'A guard checks each item.',
        'The good ones continue.',
        'The rest stop right there.',
        'Think of a ticket inspector at a gate, where no ticket means no entry, and nobody inside is disturbed.',
      ],
    },
    {
      kind: 'compare', title: 'Where the guard sits matters',
      left: { label: 'Guard after the alert', tone: 'bad', cue: 1, points: ['Slack posts first', 'The Filter runs afterwards', 'Sales already saw the empty lead'] },
      right: { label: 'Guard before the alert', tone: 'ok', cue: 3, points: ['The Filter runs first', 'Only real leads continue', 'Sales sees only what is real'] },
      lines: [
        'Now the key point of this lesson.',
        'Put the guard after the alert, and Slack posts first.',
        'The Filter still runs and still turns green, but sales has already seen the empty lead.',
        'Put the guard before the alert, and only real leads continue.',
        'A guard only protects what comes after it.',
      ],
    },
    {
      kind: 'flow', title: 'Run it: sixty rows', run: true,
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: '60 items', cue: 1 },
        { kind: 'data', icon: 'pencil', label: 'Edit Fields', sub: '60 in, 60 out', cue: 2 },
        { kind: 'logic', icon: 'filter', label: 'Filter', sub: '60 in, 48 out', cue: 3 },
        { kind: 'action', icon: 'send', label: 'Slack', sub: '48 messages', cue: 4 },
      ],
      note: { text: '12 empty rows stopped at the guard. 48 real leads were announced.', cue: 5 },
      lines: [
        'Let us run it on a real day of data.',
        'Sixty items leave the trigger.',
        'Edit Fields renames all sixty, and all sixty continue.',
        'The Filter stops twelve empty rows and passes forty-eight.',
        'Slack sends forty-eight messages.',
        'Twelve stopped at the guard, forty-eight announced, and the numbers add up to sixty.',
      ],
    },
    {
      kind: 'bullets', title: 'Green does not mean done',
      lead: 'A green node only says one thing: I ran without an error.',
      bullets: [
        { icon: 'send', text: 'The message may have gone to the wrong place', cue: 1 },
        { icon: 'x-circle', text: 'The other app may have rejected it', cue: 2 },
        { icon: 'boxes', text: 'The node may have had nothing to send', cue: 3 },
      ],
      aside: { icon: 'eye', label: 'The check', text: 'Open the last node and read what came back.', cue: 4 },
      lines: [
        'One more habit before you build, because a green node only says that it ran without an error.',
        'The message may still have gone to the wrong place.',
        'The other app may have rejected it.',
        'Or the node may have had nothing to send.',
        'So open the last node and read what came back.',
      ],
    },
    {
      kind: 'example', title: 'In practice: the night it failed quietly',
      scenario: 'At 2:07 AM the alerts stopped, and every run stayed green.',
      steps: [
        { time: '2:07 AM', icon: 'alert', text: 'The Slack channel is renamed', cue: 1 },
        { time: 'All night', icon: 'workflow', text: 'Runs continue, every node green', cue: 2 },
        { time: 'Morning', icon: 'bell-off', text: 'Forty leads waited; nobody was told', cue: 3 },
        { time: 'The fix', icon: 'eye', text: 'The last node’s output shows the rejected message', cue: 4 },
      ],
      result: { text: 'The run data had the answer the whole time.', cue: 5 },
      lines: [
        'This is exactly what happened at Nebula.',
        'At seven minutes past two in the morning, somebody renamed the Slack channel.',
        'The workflow kept running all night, and every node stayed green.',
        'By morning forty leads had waited, and nobody had been told.',
        'The fix began by opening the last node, where the output showed the rejected message.',
        'The run data had the answer the whole time.',
      ],
    },
    {
      kind: 'cards', title: 'The same shape, elsewhere',
      cards: [
        { icon: 'shop', title: 'Shop', flow: ['A new order arrives', 'Check it has an address', 'Send it to the warehouse'], cue: 1 },
        { icon: 'user', title: 'HR', flow: ['A leave request is filed', 'Check the dates are valid', 'Notify the manager'], cue: 2 },
        { icon: 'alert', title: 'IT', flow: ['A server alert fires', 'Ignore known false alarms', 'Page the engineer'], cue: 3 },
      ],
      lines: [
        'The same shape works far beyond lead alerts.',
        'In a shop, an order arrives, its address is checked, and it goes to the warehouse.',
        'In human resources, a leave request is checked for valid dates, and the manager is notified.',
        'In information technology, a server alert is checked against known false alarms, and only then is an engineer paged.',
      ],
    },
    {
      kind: 'recap', title: 'What to take away',
      points: [
        { text: 'Trigger, clean, guard, alert: a shape worth remembering', cue: 0 },
        { text: 'A guard only protects what comes after it', cue: 1 },
        { text: 'Count the items at each node to see what was stopped', cue: 2 },
        { text: 'Green means it ran; the output proves it worked', cue: 3 },
      ],
      lines: [
        'To sum up, trigger, clean, guard, alert is a shape worth remembering.',
        'A guard only protects what comes after it.',
        'Count the items at each node to see what was stopped.',
        'And green means it ran, while the output proves it worked.',
      ],
    },
  ],
  quizAfter: 4,
  midQuiz: [
    { q: 'What does a guard do?', options: ['Renames the fields of every item', 'Checks each item and lets only the good ones continue', 'Starts the workflow'], correct: 1, explain: 'A guard is a Filter doing a protective job: good items continue, the rest stop.', hint: 'Think of the ticket inspector at the gate.' },
    { q: 'The Filter is placed after the Slack node. What happens to an empty row?', options: ['It is announced to sales, then filtered', 'It is stopped before Slack', 'The workflow shows an error'], correct: 0, explain: 'A guard only protects what comes after it — Slack had already posted.', hint: 'Which node does the empty row reach first?' },
  ],
  endQuiz: [
    { q: '60 items enter; the Filter stops 12. How many messages does Slack send?', options: ['60', '48', '12'], correct: 1, explain: '60 − 12 = 48 items reach Slack, one message each.', hint: 'Slack only receives what the Filter lets through.' },
    { q: 'Every node is green, but sales got nothing. What do you open first?', options: ['The trigger settings', 'The last node’s output', 'The spreadsheet'], correct: 1, explain: 'Green means it ran. What the other app answered is in the last node’s output.', hint: 'Which node talks to the outside world?' },
  ],
})
