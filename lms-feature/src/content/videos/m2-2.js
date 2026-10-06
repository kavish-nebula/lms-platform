import { video } from './prep.js'

/* Concept video — lesson 2.2: reshaping items with Edit Fields (Set). */
export default video({
  id: 'm2-2',
  title: 'Reshaping data with Edit Fields',
  slides: [
    {
      kind: 'title', icon: 'pencil', kicker: 'Module 2 · Video 2', title: 'Reshaping data with Edit Fields',
      sub: 'Rename, add and fill in, without losing a single item',
      lines: [
        'In the last lesson you changed single values with expressions.',
        'Now you will change the whole shape of an item, using one node called Edit Fields.',
        'You may also see it called Set, which is its older name.',
      ],
    },
    {
      kind: 'table', title: 'What arrives, and what the CRM expects',
      columns: ['Arrives as', 'The CRM expects'],
      rows: [
        { cells: ['Full Name', 'fullName'], cue: 1 },
        { cells: ['E-mail', 'email'], cue: 1 },
        { cells: ['Plan (often blank)', 'plan, never blank'], tone: 'bad', cue: 2 },
        { cells: ['Signed up, in 3 formats', 'signupDate, in one format'], tone: 'bad', cue: 2 },
      ],
      note: { text: 'Edit Fields is the node that closes this gap.', cue: 3 },
      lines: [
        'Here is the problem it solves.',
        'The data arrives with one set of names, and the customer system, the CRM, expects another.',
        'Some values are blank, and some come in several formats.',
        'Edit Fields is the node that closes this gap.',
      ],
    },
    {
      kind: 'define', title: 'What does Edit Fields do?', term: 'Edit Fields (Set)',
      definition: 'A node that changes what each item looks like, and passes every item on.',
      parts: [{ text: 'Renames fields', cue: 1 }, { text: 'Adds new fields', cue: 2 }, { text: 'Fills in blanks', cue: 3 }],
      analogy: { label: 'Think of it as', text: 'A customs desk: every traveller gets through, and each one leaves with the same standard form filled in.' },
      lines: [
        'So what exactly does it do?',
        'It renames fields.',
        'It adds new fields.',
        'And it fills in blanks.',
        'Think of a customs desk, where every traveller gets through, and each one leaves with the same standard form filled in.',
      ],
    },
    {
      kind: 'bullets', title: 'Three jobs in one node',
      lead: 'For every item that passes, Edit Fields can do all three.',
      bullets: [
        { icon: 'pencil', text: 'Rename: “E-mail” becomes email', cue: 1 },
        { icon: 'boxes', text: 'Add: fullName, from first and last name', cue: 2 },
        { icon: 'download', text: 'Default: a blank plan becomes “free”', cue: 3 },
      ],
      aside: { icon: 'eye', label: 'Key fact', text: 'Items in = items out. Edit Fields never drops an item.', cue: 4 },
      lines: [
        'Let us see each job with an example.',
        'Rename means the field called e-mail becomes simply email.',
        'Add means a new field, full name, is built from first name and last name.',
        'Default means a blank plan becomes the word free.',
        'And here is the key fact, which is that Edit Fields never drops an item, so what goes in comes out.',
      ],
    },
    {
      kind: 'compare', title: 'Edit Fields or Filter?',
      left: { label: 'Edit Fields reshapes', tone: 'info', cue: 1, points: ['Changes the fields', 'Keeps every item', '500 in, 500 out'] },
      right: { label: 'Filter decides', tone: 'info', cue: 3, points: ['Leaves the fields alone', 'Stops some items', '500 in, fewer out'] },
      lines: [
        'People often mix up Edit Fields and Filter, so let us put them side by side.',
        'Edit Fields reshapes, which means it changes the fields and keeps every item.',
        'Five hundred items go in, and five hundred come out.',
        'Filter decides, which means it leaves the fields alone and stops some items.',
        'Five hundred go in, and fewer come out.',
      ],
    },
    {
      kind: 'code', title: 'Filling a blank with a default',
      lead: 'One small expression inside Edit Fields does it.',
      rows: [
        { code: '{{ $json.plan || "free" }}', out: 'the plan, or “free” if there is none', cue: 1 },
        { code: 'plan is “pro”', out: 'stays “pro”', cue: 2 },
        { code: 'plan is blank', out: 'becomes “free”', cue: 3 },
      ],
      aside: { icon: 'boxes', label: 'Read it as', text: 'Use the plan — or, if there is none, use “free”.', cue: 4 },
      lines: [
        'Filling a blank takes one small expression.',
        'It says use the plan, or if there is none, use free.',
        'So when the plan is pro, it stays pro.',
        'And when the plan is blank, it becomes free.',
        'The two upright bars in the middle are simply read as the word or.',
      ],
    },
    {
      kind: 'compare', title: 'Order matters: tidy first, then default',
      left: { label: 'Default first', tone: 'bad', cue: 1, points: ['“FREE ” and blank arrive', 'Blank becomes “free”', 'Two plans now: “FREE ” and “free”'] },
      right: { label: 'Tidy first', tone: 'ok', cue: 3, points: ['Trim and lower-case everything', '“FREE ” becomes “free”', 'Then fill blanks: one plan only'] },
      lines: [
        'There is one trap, and it is about order.',
        'Suppose some rows say free in capitals with a trailing space, and others are blank.',
        'If you fill the blanks first, you end up with two plans that mean the same thing.',
        'If you tidy first, the capitals and the space are gone before anything is filled in.',
        'So tidy the values first, and only then fill the blanks.',
      ],
    },
    {
      kind: 'example', title: 'In practice: 500 rows for the CRM',
      scenario: 'Marketing exports 500 sign-ups, and the CRM rejects anything untidy.',
      steps: [
        { time: 'In', icon: 'table', text: '500 rows with mixed names, cases and blanks', cue: 1 },
        { time: 'Rename', icon: 'pencil', text: 'Every field gets its CRM name', cue: 2 },
        { time: 'Tidy', icon: 'code', text: 'Emails are trimmed and lower-cased', cue: 3 },
        { time: 'Default', icon: 'download', text: 'Blank plans become “free”', cue: 4 },
      ],
      result: { text: '500 items in, 500 items out, and every one now has the same shape.', cue: 5 },
      lines: [
        'Here is Edit Fields at work on a real job.',
        'Five hundred rows arrive with mixed names, mixed cases and blanks.',
        'Every field gets the name the CRM expects.',
        'Emails are trimmed and lower-cased.',
        'Blank plans become free.',
        'Five hundred items in, five hundred out, and every one now has the same shape.',
      ],
    },
    {
      kind: 'cards', title: 'Reshaping, everywhere',
      cards: [
        { icon: 'shop', title: 'Shop', flow: ['Orders from two stores', 'Give both the same field names', 'One combined report'], cue: 1 },
        { icon: 'user', title: 'HR', flow: ['Applications arrive', 'Add a fullName field', 'Save to the tracker'], cue: 2 },
        { icon: 'file', title: 'Finance', flow: ['Expenses arrive', 'Missing currency becomes EUR', 'Send to accounting'], cue: 3 },
      ],
      lines: [
        'Reshaping turns up wherever two systems disagree about names.',
        'In a shop, orders from two stores are given the same field names, so one report covers both.',
        'In human resources, a full name field is added to each application.',
        'In finance, a missing currency becomes euros before the expense goes to accounting.',
      ],
    },
    {
      kind: 'recap', title: 'What to take away',
      points: [
        { text: 'Edit Fields renames, adds and fills in', cue: 0 },
        { text: 'It never drops an item: items in = items out', cue: 1 },
        { text: 'Fill blanks in one place, early in the workflow', cue: 2 },
        { text: 'Tidy values first, then fill the blanks', cue: 3 },
      ],
      lines: [
        'To sum up, Edit Fields renames, adds and fills in.',
        'It never drops an item, so items in equals items out.',
        'Fill blanks in one place, early in the workflow.',
        'And tidy values first, then fill the blanks.',
      ],
    },
  ],
  quizAfter: 4,
  midQuiz: [
    { q: '500 items enter an Edit Fields node. How many come out?', options: ['Fewer than 500', 'Exactly 500', 'It depends on the blanks'], correct: 1, explain: 'Edit Fields reshapes items; it never drops one.', hint: 'At the customs desk, how many travellers get through?' },
    { q: 'Which node would you use to stop rows that have no email?', options: ['Edit Fields', 'Filter', 'The trigger'], correct: 1, explain: 'Filter decides which items continue; Edit Fields only changes how they look.', hint: 'One reshapes, one decides. Which job is this?' },
  ],
  endQuiz: [
    { q: 'What does {{ $json.plan || "free" }} give for a blank plan?', options: ['blank', '“free”', 'undefined'], correct: 1, explain: 'Read it as: use the plan — or, if there is none, use “free”.', hint: 'Read the two bars as the word “or”.' },
    { q: 'Rows contain “FREE ” and blanks. Which order gives one clean plan?', options: ['Fill blanks, then tidy', 'Tidy, then fill blanks', 'The order makes no difference'], correct: 1, explain: 'Tidy first so “FREE ” becomes “free”; then the filled-in blanks match it.', hint: 'What does “FREE ” still look like if you fill the blanks first?' },
  ],
})
