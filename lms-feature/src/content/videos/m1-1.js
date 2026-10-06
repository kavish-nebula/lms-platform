/*
  Concept video — Module 1, lesson 1.1: "What is a workflow?"
  A narrated slide lesson of about five minutes. Each slide has its own narration
  clip; `cue` on an element is the sentence (0-based) at which it appears.
  `quizAfter` is the slide after which the lesson pauses for a short popup check;
  a wrong answer shows the question's `hint`, never the answer.
*/
export default {
  id: 'm1-1',
  title: 'What is a workflow?',
  slides: [
    {
      kind: 'title', icon: 'workflow',
      kicker: 'Module 1 · Video 1',
      title: 'What is a workflow?',
      sub: 'The three parts of every automation, and what happens when one runs',
      narration:
        'Welcome to the first lesson. In the next five minutes you will learn what a workflow is, the three parts every workflow is made of, and what actually happens when one runs. ' +
        'Halfway through there is a short check, so you know the first half has landed before we build on it.',
    },
    {
      kind: 'compare', title: 'The same job, done two ways',
      left: { label: 'By hand', tone: 'bad', cue: 1, points: ['Open the sheet and look for new rows', 'Copy the name and the email', 'Paste them into the sales channel', 'Repeat all day, and hope nothing is missed'] },
      right: { label: 'With a workflow', tone: 'ok', cue: 4, points: ['A new row arrives', 'The message is written and posted', 'Nobody had to look, copy or paste', 'It happens the same way every time'] },
      narration:
        'Start with a job you may know. At Nebula, a small coffee subscription company, every new sign-up lands as a row in a spreadsheet. ' +
        'Someone has to notice the new row, copy the name and email, and paste them into the sales channel. ' +
        'It takes a minute each time, all day long. And when that person is busy, or asleep, a lead simply waits. ' +
        'Now the same job with a workflow. The row arrives, and the message is posted within seconds. ' +
        'Nobody looked, nobody copied, and it happens the same way every single time.',
    },
    {
      kind: 'define', title: 'So, what is a workflow?',
      term: 'Workflow',
      definition: 'A set of steps that a computer carries out for you, in order, every time a chosen event happens.',
      analogy: { label: 'Think of it as', text: 'A recipe that cooks itself: once the doorbell rings, every step is followed in the same order, with nothing skipped.' },
      parts: [{ text: 'A set of steps', cue: 1 }, { text: 'In order', cue: 2 }, { text: 'Every time an event happens', cue: 3 }],
      narration:
        'So here is the definition. A workflow is a set of steps that a computer carries out for you. ' +
        'The steps always run in the same order. ' +
        'And they run every time a chosen event happens, with no one pressing a button. ' +
        'A helpful picture is a recipe that cooks itself. The moment the doorbell rings, every step is followed, in order, with nothing skipped.',
    },
    {
      kind: 'flow', title: 'Every workflow has three parts',
      nodes: [
        { kind: 'trigger', icon: 'zap', label: 'Trigger', sub: 'what starts it', cue: 1 },
        { kind: 'data', icon: 'boxes', label: 'Nodes', sub: 'the steps in between', cue: 2 },
        { kind: 'action', icon: 'send', label: 'Action', sub: 'the visible result', cue: 3 },
      ],
      note: { text: 'Trigger → steps → action. Every automation you will ever build has this shape.', cue: 4 },
      narration:
        'Every workflow, however large, is made of the same three parts. ' +
        'First, a trigger: the event that starts everything. ' +
        'Second, the nodes in between: each one is a single step that does something with the data. ' +
        'Third, an action: the visible result, such as a message sent or a record saved. ' +
        'Trigger, steps, action. Every automation you will ever build has this shape.',
    },
    {
      kind: 'bullets', title: 'Part 1 — the trigger',
      lead: 'A trigger listens for one kind of event. When it happens, the workflow starts.',
      bullets: [
        { icon: 'table', text: 'A new row in a spreadsheet', cue: 1 },
        { icon: 'form', text: 'A form is submitted', cue: 2 },
        { icon: 'clock', text: 'A time on the clock — every day at 9 AM', cue: 3 },
        { icon: 'webhook', text: 'Another system calls in (a webhook)', cue: 4 },
      ],
      aside: { icon: 'bell-off', label: 'Remember', text: 'No trigger, no run. A workflow without a trigger never starts by itself.', cue: 5 },
      narration:
        'Let us take the parts one at a time. A trigger listens for one kind of event, and when that event happens, the workflow starts. ' +
        'The event can be a new row in a spreadsheet. ' +
        'It can be a form being submitted. ' +
        'It can be a time on the clock, such as every day at nine in the morning. ' +
        'Or it can be another system calling in, which is called a webhook. ' +
        'One rule to remember: no trigger, no run. A workflow without a trigger never starts by itself.',
    },
    {
      kind: 'bullets', title: 'Part 2 — the nodes',
      lead: 'Each node does one job, then passes its result to the next node along the connection.',
      bullets: [
        { icon: 'download', text: 'Get — read data from an app or a file', cue: 1 },
        { icon: 'pencil', text: 'Change — rename, clean or reshape it', cue: 2 },
        { icon: 'split', text: 'Decide — let some data through, stop the rest', cue: 3 },
        { icon: 'send', text: 'Send — post, save or email the result', cue: 4 },
      ],
      aside: { icon: 'arrow-right', label: 'Direction', text: 'Data travels left to right, from one node to the next.', cue: 5 },
      narration:
        'Now the nodes. Each node does exactly one job, then hands its result to the next node. ' +
        'Some nodes get data: they read from an app or a file. ' +
        'Some change data: they rename it, clean it or reshape it. ' +
        'Some decide: they let certain data through and stop the rest. ' +
        'And some send: they post, save or email the result. That last kind is the action. ' +
        'The lines between nodes are connections, and data always travels along them from left to right.',
    },
    {
      kind: 'flow', title: 'What happens when it runs', run: true,
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: 'new row', cue: 1 },
        { kind: 'data', icon: 'pencil', label: 'Clean up fields', sub: 'tidy the names', cue: 2 },
        { kind: 'action', icon: 'send', label: 'Slack message', sub: 'tell sales', cue: 3 },
      ],
      note: { text: 'One trigger event = one execution, from the first node to the last.', cue: 4 },
      narration:
        'So what happens when a workflow runs? One run, from start to finish, is called an execution. ' +
        'The trigger fires because its event happened. ' +
        'The data moves to the next node, which does its job and turns green. ' +
        'Then the next, until the last node has finished. ' +
        'One trigger event means one execution. Ten new rows on ten occasions means ten executions, each one complete and separate.',
    },
    {
      kind: 'example', title: 'In practice: Nebula’s lead alert',
      scenario: 'Maya signs up for a coffee subscription at 9:02 AM.',
      steps: [
        { time: '9:02:00', icon: 'form', text: 'Maya submits the form — a new row appears in the sheet', cue: 1 },
        { time: '9:02:01', icon: 'zap', text: 'The Sheet Trigger notices the row and starts an execution', cue: 2 },
        { time: '9:02:02', icon: 'pencil', text: 'The middle node tidies the field names', cue: 3 },
        { time: '9:02:03', icon: 'send', text: 'Slack posts “New lead: Maya — maya@example.com”', cue: 4 },
      ],
      result: { text: 'Three seconds, no human involved. Sales replies while Maya is still on the page.', cue: 5 },
      narration:
        'Here is that workflow in real life. Maya signs up for a coffee subscription at two minutes past nine. ' +
        'She submits the form, and a new row appears in the sheet. ' +
        'The Sheet Trigger notices the row and starts an execution. ' +
        'The middle node tidies the field names. ' +
        'And Slack posts the message: new lead, Maya, with her email. ' +
        'Three seconds, and no human involved. Sales can reply while Maya is still on the page.',
    },
    {
      kind: 'bullets', title: 'Three ways a run can go wrong',
      lead: 'Knowing the parts tells you where to look when something breaks.',
      bullets: [
        { icon: 'bell-off', text: 'It never starts — look at the trigger', cue: 1 },
        { icon: 'x-circle', text: 'A node turns red — that step failed; read its error', cue: 2 },
        { icon: 'eye', text: 'Everything is green, but nothing arrived — read the last node’s output', cue: 3 },
      ],
      aside: { icon: 'alert', label: 'Worth knowing', text: 'Green means the node ran. It does not prove the result reached anyone.', cue: 4 },
      narration:
        'Knowing the three parts also tells you where to look when something breaks. ' +
        'If the workflow never starts, look at the trigger. ' +
        'If a node turns red, that step failed, and its error message says why. ' +
        'And the quiet one: everything is green, but nothing arrived. Then open the last node and read what it sent back. ' +
        'Green only means the node ran. It does not prove the result reached anyone.',
    },
    {
      kind: 'cards', title: 'The same shape, everywhere',
      cards: [
        { icon: 'file', title: 'Finance', flow: ['An invoice arrives by email', 'Read the amount', 'Save it and notify finance'], cue: 1 },
        { icon: 'headset', title: 'Support', flow: ['A ticket is created', 'Check its priority', 'Assign it to the right person'], cue: 2 },
        { icon: 'clock', title: 'Reporting', flow: ['Every day at 9 AM', 'Collect yesterday’s sales', 'Email the summary'], cue: 3 },
      ],
      narration:
        'This shape is not special to Nebula. You will find it everywhere. ' +
        'In finance: an invoice arrives by email, the amount is read, and it is saved and finance is notified. ' +
        'In support: a ticket is created, its priority is checked, and it is assigned to the right person. ' +
        'In reporting: every day at nine, yesterday’s sales are collected and a summary is emailed. ' +
        'Different tools, same three parts: a trigger, steps, and an action.',
    },
    {
      kind: 'recap', title: 'What to take away',
      points: [
        { text: 'A workflow is a set of steps that runs by itself when an event happens', cue: 0 },
        { text: 'Three parts: a trigger, the nodes in between, and an action', cue: 1 },
        { text: 'One trigger event starts one execution, first node to last', cue: 2 },
        { text: 'When it breaks, the three parts tell you where to look', cue: 3 },
      ],
      narration:
        'Let us pull it together. A workflow is a set of steps that runs by itself when an event happens. ' +
        'It has three parts: a trigger, the nodes in between, and an action. ' +
        'One trigger event starts one execution, from the first node to the last. ' +
        'And when something breaks, those three parts tell you where to look. ' +
        'Next, a short check, and then you will watch this workflow being built on the canvas.',
    },
  ],
  // the lesson pauses here — roughly half way — for a check on what has been covered so far
  quizAfter: 5,
  midQuiz: [
    { q: 'What starts a workflow running?', options: ['Opening the n8n editor', 'A trigger — an event such as a new row or a submitted form', 'The last node in the chain'], correct: 1, explain: 'A trigger listens for an event; when it happens, the workflow starts. No trigger, no run.', hint: 'Think of the doorbell: something has to happen first, before any step runs.' },
    { q: 'A node in the middle of a workflow…', options: ['Does one job and passes its result to the next node', 'Runs the whole workflow by itself', 'Only decides when the workflow starts'], correct: 0, explain: 'Each node does exactly one job — get, change, decide or send — and hands its result on.', hint: 'Get, change, decide, send — how many of those does a single node do?' },
  ],
  endQuiz: [
    { q: 'Twelve new rows arrive at twelve different times today. How many executions are there?', options: ['1 — one per day', '12 — one per trigger event', '36 — one per node'], correct: 1, explain: 'One trigger event starts one execution, from the first node to the last.', hint: 'Count the trigger events, not the days or the nodes.' },
    { q: 'Every node is green, but sales never got the message. Where do you look first?', options: ['The trigger', 'The workflow’s name', 'The last node’s output'], correct: 2, explain: 'Green means the node ran. What the receiving app answered is in the last node’s output.', hint: 'The workflow started and every step ran, so the start is fine. Which node talks to the outside world?' },
  ],
}
