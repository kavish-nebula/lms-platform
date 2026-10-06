import { video } from './prep.js'

/* Concept video — lesson 1.2: what travels between nodes. */
export default video({
  id: 'm1-2',
  title: 'How data moves: items',
  slides: [
    {
      kind: 'title', icon: 'boxes', kicker: 'Module 1 · Video 2', title: 'How data moves: items',
      sub: 'What travels along the connections, and why nodes run more than once',
      lines: [
        'In this lesson you will see what actually travels along the connections between nodes.',
        'It is called an item, and once you understand items, most of the tool stops being mysterious.',
        'As before, there is a short check half way.',
      ],
    },
    {
      kind: 'table', title: 'Data arrives as rows',
      columns: ['First Name', 'Email', 'Source'],
      rows: [
        { cells: ['Maya', 'maya@example.com', 'Instagram'], cue: 2 },
        { cells: ['Tom', 'tom@example.com', 'Referral'], cue: 2 },
        { cells: ['(blank)', '(blank)', 'Website'], tone: 'bad', cue: 2 },
      ],
      note: { text: 'Each row becomes one item.', cue: 3 },
      lines: [
        'Start with the data itself.',
        'At Nebula, sign-ups land in a spreadsheet, one row per person.',
        'Here is Maya, here is Tom, and here is a row where somebody submitted the form empty.',
        'When the trigger reads these rows, each row becomes one item.',
      ],
    },
    {
      kind: 'define', title: 'What is an item?', term: 'Item',
      definition: 'One record travelling through the workflow: one row, one order, one ticket.',
      parts: [{ text: 'One record', cue: 1 }, { text: 'With named fields', cue: 2 }, { text: 'Moves node to node', cue: 3 }],
      analogy: { label: 'Think of it as', text: 'Parcels on a conveyor belt: each parcel has a label, and each station handles one parcel at a time.' },
      lines: [
        'So here is the definition.',
        'An item is one record: one row, one order, one ticket.',
        'It carries named fields, such as first name and email.',
        'And it travels from node to node.',
        'Picture parcels on a conveyor belt, where each parcel has a label and each station handles one parcel at a time.',
      ],
    },
    {
      kind: 'flow', title: 'A node runs once for each item',
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: '3 rows', cue: 1 },
        { kind: 'data', icon: 'boxes', label: 'Any node', sub: 'runs 3 times', cue: 2 },
        { kind: 'action', icon: 'send', label: 'Slack', sub: '3 messages', cue: 3 },
      ],
      note: { text: '3 items in → the node runs 3 times → 3 results out.', cue: 4 },
      lines: [
        'This is the idea that surprises most people.',
        'The trigger hands over three rows, so three items.',
        'The next node does not run once, it runs three times, once for each item.',
        'And the last node sends three messages.',
        'Three items in, three runs, three results out.',
      ],
    },
    {
      kind: 'bullets', title: 'Fields: the names inside an item',
      lead: 'Every item is a set of fields. Each field has a name and a value.',
      bullets: [
        { icon: 'user', text: 'First Name → Maya', cue: 1 },
        { icon: 'mail', text: 'Email → maya@example.com', cue: 2 },
        { icon: 'search', text: 'Source → Instagram', cue: 3 },
      ],
      aside: { icon: 'alert', label: 'Watch out', text: 'Names must match exactly. “Email” and “email” are two different fields.', cue: 4 },
      lines: [
        'Now look inside one item, where you will find fields, each with a name and a value.',
        'First name is Maya.',
        'Email is her address.',
        'Source is Instagram.',
        'One warning: field names must match exactly, so email with a capital letter and email without one are two different fields.',
      ],
    },
    {
      kind: 'compare', title: 'Messy names in, clean names out',
      left: { label: 'Straight from the sheet', tone: 'bad', cue: 1, points: ['First Name', 'E-mail Address', 'Where did you hear?'] },
      right: { label: 'After Edit Fields', tone: 'ok', cue: 2, points: ['firstName', 'email', 'source'] },
      lines: [
        'Field names straight from a spreadsheet are rarely tidy.',
        'They have spaces, capitals and punctuation, and every later node would have to spell them exactly.',
        'So early in the workflow we add one node, called Edit Fields, that renames them once.',
        'After it, every later node reads short, clean names.',
        'Tidy once, early, and the rest of the workflow gets simpler.',
      ],
    },
    {
      kind: 'flow', title: 'A Filter decides item by item', run: true,
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: '3 items', cue: 1 },
        { kind: 'logic', icon: 'filter', label: 'Filter', sub: 'email is not empty', cue: 2 },
        { kind: 'action', icon: 'send', label: 'Slack', sub: '2 messages', cue: 3 },
      ],
      note: { text: 'The empty row stops at the Filter. It never reaches Slack.', cue: 4 },
      lines: [
        'Because nodes work item by item, a node can also decide item by item.',
        'Three items leave the trigger.',
        'The Filter checks each one and asks whether the email is filled in.',
        'Two pass, and Slack sends two messages.',
        'The empty row stops at the Filter and never reaches Slack.',
      ],
    },
    {
      kind: 'example', title: 'In practice: three rows, one of them empty',
      scenario: 'Three rows arrive together, and one has no email.',
      steps: [
        { time: 'Item 1', icon: 'user', text: 'Maya passes the Filter, and Slack announces her', cue: 1 },
        { time: 'Item 2', icon: 'user', text: 'Tom passes the Filter, and Slack announces him', cue: 2 },
        { time: 'Item 3', icon: 'x-circle', text: 'The empty row is stopped at the Filter', cue: 3 },
      ],
      result: { text: '3 items in, 2 messages out, and nobody is alerted about an empty form.', cue: 4 },
      lines: [
        'Follow each item through that workflow.',
        'Maya passes the Filter, and Slack announces her.',
        'Tom passes too, and Slack announces him.',
        'The empty row is stopped at the Filter.',
        'Three items in, two messages out, and nobody is alerted about an empty form.',
      ],
    },
    {
      kind: 'bullets', title: 'Reading a run: count the items',
      lead: 'After a run, every node shows how many items went in and came out.',
      bullets: [
        { icon: 'table', text: 'Trigger: 3 items out', cue: 1 },
        { icon: 'pencil', text: 'Edit Fields: 3 in, 3 out', cue: 2 },
        { icon: 'filter', text: 'Filter: 3 in, 2 out', cue: 3 },
      ],
      aside: { icon: 'eye', label: 'A good habit', text: 'When a number surprises you, that node is where to look.', cue: 4 },
      lines: [
        'This gives you a simple way to read any run, which is to count the items.',
        'The trigger shows three items out.',
        'Edit Fields shows three in and three out, because renaming never drops anything.',
        'The Filter shows three in and two out.',
        'When a number surprises you, that node is where to look.',
      ],
    },
    {
      kind: 'cards', title: 'Items, everywhere',
      cards: [
        { icon: 'shop', title: 'Shop', flow: ['New orders arrive', 'Each order is one item', 'One confirmation per order'], cue: 1 },
        { icon: 'headset', title: 'Support', flow: ['Tickets come in', 'Each ticket is one item', 'Each one gets an owner'], cue: 2 },
        { icon: 'factory', title: 'Factory', flow: ['Sensor readings arrive', 'Each reading is one item', 'Bad readings raise a ticket'], cue: 3 },
      ],
      lines: [
        'Items are the same idea in every field.',
        'In a shop, each order is one item, and each gets its own confirmation.',
        'In support, each ticket is one item, and each gets an owner.',
        'In a factory, each sensor reading is one item, and the bad ones raise a ticket.',
      ],
    },
    {
      kind: 'recap', title: 'What to take away',
      points: [
        { text: 'An item is one record, with named fields', cue: 0 },
        { text: 'A node runs once for each item it receives', cue: 1 },
        { text: 'Rename fields once, early, with Edit Fields', cue: 2 },
        { text: 'Count items in and out to read any run', cue: 3 },
      ],
      lines: [
        'To sum up, an item is one record with named fields.',
        'A node runs once for each item it receives.',
        'Rename fields once, early, with Edit Fields.',
        'And count items in and out to read any run.',
      ],
    },
  ],
  quizAfter: 4,
  midQuiz: [
    { q: 'A trigger reads 5 new rows at once. How many items go to the next node?', options: ['1', '5', 'It depends on the node'], correct: 1, explain: 'Each row becomes one item, so 5 rows are 5 items.', hint: 'What does each row become when the trigger reads it?' },
    { q: 'A node receives 4 items. How many times does it run?', options: ['Once', 'Four times — once per item', 'Not at all, until a Filter is added'], correct: 1, explain: 'A node runs once for each item it receives.', hint: 'Think of the conveyor belt: one parcel at a time.' },
  ],
  endQuiz: [
    { q: 'Why rename fields early with Edit Fields?', options: ['So every later node reads the same clean names', 'To make the workflow run faster', 'Because the trigger requires it'], correct: 0, explain: 'Renamed once, upstream, every later node can use short, clean names.', hint: 'If “E-mail Address” is never renamed, who has to spell it exactly?' },
    { q: 'A Filter receives 10 items; 3 have no email. What reaches the next node?', options: ['10 items', '7 items', 'Nothing — the run stops'], correct: 1, explain: 'The Filter checks each item separately: 7 pass, 3 stop.', hint: 'The Filter decides item by item, not for the whole run.' },
  ],
})
