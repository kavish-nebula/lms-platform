import { video } from './prep.js'

/* Concept video — lesson 2.1: expressions. */
export default video({
  id: 'm2-1',
  title: 'Expressions: values that fill themselves in',
  slides: [
    {
      kind: 'title', icon: 'code', kicker: 'Module 2 · Video 1', title: 'Expressions',
      sub: 'Values that fill themselves in, differently for every item',
      lines: [
        'Welcome to Module 2, where we start changing data on its way through a workflow.',
        'The first tool for that is the expression.',
        'By the end of this lesson you will be able to read one, write one, and fix one that is not working.',
      ],
    },
    {
      kind: 'compare', title: 'Typed once, or filled in each time',
      left: { label: 'A fixed value', tone: 'bad', cue: 1, points: ['“New lead: Maya”', 'Typed by hand', 'Says Maya for every lead'] },
      right: { label: 'An expression', tone: 'ok', cue: 3, points: ['“New lead: {{ firstName }}”', 'Filled in for each item', 'Maya, then Tom, then Priya'] },
      lines: [
        'Imagine the Slack message from the last module.',
        'If you type the words new lead Maya, the message says Maya for every single lead.',
        'That is a fixed value, and it is the same every time.',
        'An expression leaves a gap, and the gap is filled in from the item being handled.',
        'So the first message says Maya, the next says Tom, and the next says Priya.',
      ],
    },
    {
      kind: 'define', title: 'What is an expression?', term: 'Expression',
      definition: 'A small formula inside a node that is worked out again for every item.',
      parts: [{ text: 'Inside double curly braces', cue: 1 }, { text: 'Reads the item’s fields', cue: 2 }, { text: 'Worked out per item', cue: 3 }],
      analogy: { label: 'Think of it as', text: 'A mail merge: one letter, and each name is dropped in as that letter is printed.' },
      lines: [
        'Here is the definition.',
        'An expression is a small formula written inside double curly braces.',
        'It reads the fields of the item.',
        'And it is worked out again for every item that passes.',
        'It works like a mail merge, where one letter is written and each name is dropped in as that letter is printed.',
      ],
    },
    {
      kind: 'code', title: 'Reading a field',
      lead: 'An expression starts with {{ and ends with }}.',
      rows: [
        { code: '{{ $json.firstName }}', out: 'Maya', cue: 1 },
        { code: '{{ $json.email }}', out: 'maya@example.com', cue: 2 },
        { code: 'New lead: {{ $json.firstName }}', out: 'New lead: Maya', cue: 3 },
      ],
      aside: { icon: 'boxes', label: 'Read it as', text: '$json means “the item I am handling right now”.', cue: 4 },
      lines: [
        'Let us read some real ones.',
        'This expression asks for the first name of the current item, and the result is Maya.',
        'This one asks for the email.',
        'And an expression can sit inside ordinary text, so the result is new lead Maya.',
        'The word json with a dollar sign simply means the item I am handling right now.',
      ],
    },
    {
      kind: 'flow', title: 'One expression, many results',
      nodes: [
        { kind: 'trigger', icon: 'table', label: 'Sheet Trigger', sub: '3 items', cue: 1 },
        { kind: 'data', icon: 'code', label: 'Slack message', sub: 'uses firstName', cue: 2 },
        { kind: 'action', icon: 'send', label: '3 messages', sub: 'Maya · Tom · Priya', cue: 3 },
      ],
      note: { text: 'The same expression gave three different messages, one per item.', cue: 4 },
      lines: [
        'Now connect that to what you know about items.',
        'Three items leave the trigger.',
        'The Slack node holds one expression that uses the first name.',
        'It runs three times and produces three messages.',
        'The same expression gave three different results, one for each item.',
      ],
    },
    {
      kind: 'code', title: 'Changing a value on the way',
      lead: 'An expression can also clean the value it reads.',
      rows: [
        { code: '{{ $json.email.trim() }}', out: 'spaces at both ends removed', cue: 1 },
        { code: '{{ $json.email.toLowerCase() }}', out: 'Maya@X.com → maya@x.com', cue: 2 },
        { code: '{{ $json.email.trim().toLowerCase() }}', out: 'both, in one go', cue: 3 },
      ],
      aside: { icon: 'eye', label: 'Why it matters', text: 'Two emails that look the same to you must look the same to the computer.', cue: 4 },
      lines: [
        'Expressions can do more than read, because they can also clean.',
        'Trim removes the spaces at both ends of a value.',
        'To lower case turns every capital letter into a small one.',
        'And you can chain them, so the value is trimmed and lower-cased in one go.',
        'This matters because two emails that look the same to you must look the same to the computer.',
      ],
    },
    {
      kind: 'bullets', title: 'When the result is “undefined”',
      lead: 'Undefined means: I could not find a field with that name.',
      bullets: [
        { icon: 'pencil', text: 'The field name is misspelled', cue: 1 },
        { icon: 'search', text: 'The capital letters do not match', cue: 2 },
        { icon: 'table', text: 'A column was renamed earlier on', cue: 3 },
      ],
      aside: { icon: 'eye', label: 'First move', text: 'Compare the name in the expression with the name in the item, letter by letter.', cue: 4 },
      lines: [
        'Sooner or later an expression will show the word undefined, which means it could not find a field with that name.',
        'Usually the field name is misspelled.',
        'Or the capital letters do not match.',
        'Or somebody renamed a column earlier on.',
        'So your first move is to compare the name in the expression with the name in the item, letter by letter.',
      ],
    },
    {
      kind: 'example', title: 'In practice: the duplicate nobody caught',
      scenario: 'Priya signs up twice, typed two slightly different ways.',
      steps: [
        { time: 'Row 1', icon: 'mail', text: 'priya@x.com is saved', cue: 1 },
        { time: 'Row 2', icon: 'mail', text: '“ Priya@X.com” arrives, with a space and capitals', cue: 2 },
        { time: 'Check', icon: 'x-circle', text: 'The two values are not identical, so both are kept', cue: 3 },
        { time: 'The fix', icon: 'code', text: 'Trim and lower-case first, and now they match', cue: 4 },
      ],
      result: { text: 'Clean a value before you compare it.', cue: 5 },
      lines: [
        'Here is why cleaning matters in real life.',
        'Priya signs up, and her email is saved.',
        'Later she signs up again, but this time with a space in front and capital letters.',
        'A duplicate check compares the two values, finds they are not identical, and keeps both.',
        'The fix is one expression that trims and lower-cases the email first, so the two values match.',
        'Clean a value before you compare it.',
      ],
    },
    {
      kind: 'cards', title: 'Expressions, everywhere',
      cards: [
        { icon: 'file', title: 'Finance', flow: ['An invoice arrives', 'Total = price × quantity', 'Save the total'], cue: 1 },
        { icon: 'headset', title: 'Support', flow: ['A ticket arrives', 'Subject = “Urgent: ” + title', 'Post it to the team'], cue: 2 },
        { icon: 'mail', title: 'Sales', flow: ['A deal closes', 'Greeting uses the first name', 'Send the email'], cue: 3 },
      ],
      lines: [
        'You will use expressions in almost every workflow.',
        'In finance, a total is worked out from price and quantity.',
        'In support, the word urgent is added in front of a ticket title.',
        'In sales, a thank-you email greets each customer by first name.',
      ],
    },
    {
      kind: 'recap', title: 'What to take away',
      points: [
        { text: 'An expression is worked out again for every item', cue: 0 },
        { text: 'It lives inside {{ }} and reads fields with $json', cue: 1 },
        { text: 'Trim and lower-case values before comparing them', cue: 2 },
        { text: '“Undefined” usually means a wrong field name', cue: 3 },
      ],
      lines: [
        'To sum up, an expression is worked out again for every item.',
        'It lives inside double curly braces and reads the fields of the current item.',
        'Trim and lower-case values before comparing them.',
        'And undefined usually means a wrong field name.',
      ],
    },
  ],
  quizAfter: 4,
  midQuiz: [
    { q: 'What makes an expression different from a typed value?', options: ['It is worked out again for every item', 'It only runs once per workflow', 'It can only contain numbers'], correct: 0, explain: 'An expression is filled in from the item being handled, so each item gets its own result.', hint: 'Think of the mail merge: is every letter the same?' },
    { q: 'In {{ $json.firstName }}, what does $json stand for?', options: ['The whole spreadsheet', 'The item being handled right now', 'The name of the workflow'], correct: 1, explain: '$json is the current item; .firstName picks one of its fields.', hint: 'The node runs once per item — so what is it looking at each time?' },
  ],
  endQuiz: [
    { q: 'An expression shows “undefined”. What is the most likely cause?', options: ['The workflow has no trigger', 'The field name does not match the item exactly', 'The item has too many fields'], correct: 1, explain: 'Undefined means no field with that exact name was found.', hint: 'It means “I could not find…” — find what?' },
    { q: '“ Priya@X.com” and “priya@x.com” must count as the same person. What comes first?', options: ['Compare them as they are', 'Trim and lower-case both, then compare', 'Delete the second one by hand'], correct: 1, explain: 'Clean a value before you compare it; then the two are identical.', hint: 'What makes them different right now?' },
  ],
})
