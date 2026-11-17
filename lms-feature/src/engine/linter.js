/*
  Client-side linter for exported n8n workflow JSON.
  Same rule list powers the capstone's acceptance check and the Portfolio artifact report.
*/
const has = (wf, re) => (wf.nodes || []).some((n) => re.test(`${n.name} ${n.type || ''}`))

export const RULES = [
  {
    id: 'trigger',
    label: 'Starts with a trigger — something real wakes it up',
    test: (wf) => has(wf, /trigger|webhook|schedule|cron/i),
    hint: 'Every automation needs a starting pulse: a Sheet Trigger, Webhook or Schedule node.',
  },
  {
    id: 'clean',
    label: 'Cleans / reshapes data before anything reads it',
    test: (wf) => has(wf, /\bset\b|edit field|clean/i),
    hint: 'A Set (Edit Fields) node early on means later nodes never choke on messy column names.',
  },
  {
    id: 'guard',
    label: 'Blocks junk rows before they alert (Filter before Slack)',
    test: (wf) => {
      const names = (wf.nodes || []).map((n) => `${n.name}`)
      const f = names.findIndex((n) => /filter|if\b|empty|duplicate/i.test(n))
      const s = names.findIndex((n) => /slack|alert|notify|message|crm|append/i.test(n))
      return f !== -1 && s !== -1 && f < s
    },
    hint: 'Put a Filter (or IF) before the alert/CRM node so empty rows and duplicates never reach it.',
  },
  {
    id: 'dedupe',
    label: 'Handles duplicates explicitly',
    test: (wf) => /duplicate|dedupe|seen[- ]?before/i.test(JSON.stringify(wf)),
    hint: 'Name a filter’s job clearly — “Filter: Duplicate IDs” — so reviewers (and you) know the guard exists.',
  },
  {
    id: 'secrets',
    label: 'No hard-coded credentials',
    test: (wf) => !/(password|bearer\s+[a-z0-9]{8}|api[_-]?key"\s*:\s*"[a-z0-9]{8}|token"\s*:\s*"[a-z0-9]{12})/i.test(JSON.stringify(wf)),
    hint: 'Credentials belong in n8n credentials, never typed into a node parameter.',
  },
  {
    id: 'name',
    label: 'Workflow has a clear, human name',
    test: (wf) => !!wf.name && wf.name.trim().length > 3 && !/untitled|my workflow|asdf/i.test(wf.name),
    hint: 'Name it like a teammate will see it: "Lead alerts → #new-leads".',
  },
]

/* The n8n node type a placed node exports as, by its kind (and, for the last step, what it talks to). */
export const nodeType = (item) =>
  item.kind === 'data' ? 'n8n-nodes-base.set'
    : item.kind === 'logic' ? 'n8n-nodes-base.filter'
      : /slack/i.test(item.label) ? 'n8n-nodes-base.slack' : 'n8n-nodes-base.crm'

/* A workflow export from the nodes placed after the trigger, in canvas order. */
export function workflowFrom(name, items) {
  return {
    name,
    nodes: [{ name: 'Sheet Trigger', type: 'n8n-nodes-base.googleSheetsTrigger' }, ...items.map((it) => ({ name: it.label, type: nodeType(it) }))],
  }
}

export function lint(wf) {
  if (!wf || !Array.isArray(wf.nodes)) {
    return { ok: false, results: RULES.map((r) => ({ ...r, status: 'fail', detail: 'Not a valid workflow JSON' })) }
  }
  const results = RULES.map((r) => {
    let status = 'fail'
    try {
      status = r.test(wf) ? 'pass' : 'fail'
    } catch {
      status = 'fail'
    }
    return { id: r.id, label: r.label, hint: r.hint, status }
  })
  const passed = results.filter((r) => r.status === 'pass').length
  return { ok: passed >= 4, score: passed, total: results.length, results }
}
