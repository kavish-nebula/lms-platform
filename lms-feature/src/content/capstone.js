/*
  The course capstone — one project for the whole course, taken after the last
  module and before the final assessment. It asks for everything the modules
  taught, in one pipeline, with no step-by-step help.
  Same shape as a stage's `project` content so ProjectStage can render it.
*/
export const CAPSTONE = {
  id: 'capstone',
  n: 'capstone',
  title: 'Capstone: Launch week, end to end',
  project: {
    kicker: 'Course capstone',
    title: 'Launch week: one pipeline, end to end',
    workflowName: 'Launch pipeline — sign-ups to CRM and #new-leads',
    briefNarration:
      'Here is your capstone brief. It is Friday, and Nebula’s spring launch goes live on Monday. ' +
      'Ana wants one pipeline she can trust for the whole flow: every sign-up cleaned, checked, written to the CRM, and announced to sales. ' +
      'Nothing dirty, nothing doubled, and nothing lost silently. ' +
      'You built each piece in the modules. Now build the whole thing, in the right order, on your own. ' +
      'Normalise first. Guard next. Write only what is clean. And alert sales only after the write. ' +
      'There are no hints this time. Read the requirements, then build it.',
    brief: {
      scene:
        'Friday. Nebula’s spring launch goes live on Monday, and Ana wants one pipeline she can trust for the whole flow: every sign-up from the form cleaned, checked, written to the CRM and announced to sales — with nothing dirty, nothing doubled, and nothing lost silently. You built each piece in the modules. Now build the whole thing, in the right order, on your own.',
      requirements: [
        'Starts from the sign-up Sheet Trigger (new row = one run)',
        'Normalises every row first: emails trimmed and lower-cased, dates in one format, a missing plan defaulted',
        'Stops rows with no usable email — counted, not silently lost',
        'Stops duplicates, comparing the normalised values',
        'Writes only clean, unique rows to the CRM',
        'Alerts sales in #new-leads only after the CRM write',
        'No hard-coded credentials, and a workflow name a teammate would understand',
      ],
      edgeCases: [
        'The form double-fires for some users — the same email twice within a minute',
        'Emails arrive with capitals and trailing spaces, so one person can look like two',
        'About 8% of rows have no email at all',
        'A column was renamed last month — nothing may depend on the old name',
      ],
      closing: 'The whole course in one build: a trigger, a transform, two guards, a write and an alert — in an order you can defend. Shipped with its acceptance report.',
    },
    predict: {
      q: 'Launch hour: 400 sign-ups arrive. 32 have no email; 48 are repeats once the emails are normalised. How many rows reach the CRM, and how many alerts go to sales?',
      options: [
        '320 rows and 320 alerts — the alert follows the write, so they match',
        '400 rows and 320 alerts',
        '320 rows and 400 alerts',
        '352 rows and 352 alerts',
      ],
      correct: 0,
      explain: '400 − 32 − 48 = 320. Both guards run before the write, and the alert comes after it, so the two numbers are the same.',
    },
    runSummary: ['400 rows in', '32 stopped — no usable email', '48 stopped — duplicates', '320 written to the CRM', '320 alerts posted ✓'],
    buildHere: {
      intro: 'Build the whole pipeline here — five nodes after the trigger, in an order you can defend — then run the acceptance check.',
      slots: [
        { id: 'slot1', kind: 'slot', label: 'Missing node', accept: 'data', x: 250, y: 140 },
        { id: 'slot2', kind: 'slot', label: 'Missing node', accept: 'logic', x: 460, y: 140 },
        { id: 'slot3', kind: 'slot', label: 'Missing node', accept: 'logic', x: 670, y: 140 },
        // the write comes before the alert: sales should only hear about rows that are really in the CRM
        { id: 'slot4', kind: 'slot', label: 'Missing node', accept: 'action', only: 'Append to CRM', why: 'Sales should only be told about rows that are really in the CRM — the write goes here, the alert after it.', x: 880, y: 140 },
        { id: 'slot5', kind: 'slot', label: 'Missing node', accept: 'action', only: 'Slack #new-leads', why: 'The alert is the last thing that happens, after the CRM write.', x: 1090, y: 140 },
      ],
      palette: [
        { kind: 'action', label: 'Slack #new-leads' },
        { kind: 'logic', label: 'Filter: Duplicate IDs' },
        { kind: 'data', label: 'Normalize Fields' },
        { kind: 'action', label: 'Append to CRM' },
        { kind: 'logic', label: 'Filter: Blank Emails' },
      ],
    },
    realN8n: {
      intro: 'Running real n8n (cloud or self-hosted)? Build it there, then export:',
      steps: [
        'In the n8n canvas: ⋯ menu → Download — this exports the workflow as JSON.',
        'Upload the file here (or paste the JSON).',
        'The linter runs the acceptance list and your artifact is saved to the Portfolio.',
      ],
    },
    reactions: [
      { who: 'Ana — founder', av: 'A', text: 'launch day ran itself. 320 sign-ups in the CRM, 320 alerts, zero junk. i checked five by hand. all clean.' },
      { who: 'Tom — sales', av: 'T', text: 'every alert was a real person who was already in the CRM when i clicked. that has never happened before' },
      { who: 'Sam — marketing', av: 'S', text: 'the form double-fired again and nobody noticed. which i think is the point 🙃' },
    ],
    hrsSaved: 11,
  },
}
