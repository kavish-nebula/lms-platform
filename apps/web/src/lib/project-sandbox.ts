import { z } from 'zod/v4';

const key = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,59}$/).refine(s => !['constructor', 'prototype', '__proto__'].includes(s), 'Reserved identifier.');
const referenceId = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const text = z.string().max(4000);
const record = z.record(key, text).refine(r => Object.keys(r).length <= 40, 'Too many fields.');
export const SANDBOX_OPERATIONS = ['copy', 'template', 'trim', 'uppercase', 'lowercase', 'sum', 'multiply', 'fallback'] as const;
const Step = z.object({ id: key, output: key, operation: z.enum(SANDBOX_OPERATIONS), expression: text }).strict();
export const SandboxArtifact = z.object({ version: z.literal(1), values: record, steps: z.array(Step).max(40) }).strict().superRefine((a, ctx) => {
  if (new Set(a.steps.map(s => s.id)).size !== a.steps.length || new Set(a.steps.map(s => s.output)).size !== a.steps.length) ctx.addIssue({ code: 'custom', message: 'Step IDs and output names must be unique.' });
});
export type SandboxArtifactData = z.infer<typeof SandboxArtifact>;

export const ProjectSandbox = z.object({
  version: z.literal(1), runtime: z.literal('data-workflow'),
  instructions: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  fields: z.array(z.object({ id: key, label: z.string().trim().min(1).max(200), help: text, starter: text }).strict()).min(1).max(40),
  inputs: z.array(z.object({ id: key, label: z.string().trim().min(1).max(200), sample: text }).strict()).min(1).max(40),
  starterSteps: z.array(Step).max(40),
  tests: z.array(z.object({ id: key, label: z.string().trim().min(1).max(200), inputs: record }).strict()).min(1).max(20),
  criteria: z.array(z.object({
    id: key, rubricIndex: z.number().int().nonnegative(), weight: z.number().int().min(1).max(100),
    objectiveIds: z.array(referenceId).min(1).max(60), sourceIds: z.array(referenceId).min(1).max(60), videoIds: z.array(referenceId).min(1).max(400),
    checks: z.array(z.object({ testId: key, path: z.string().regex(/^(values|output)\.[A-Za-z][A-Za-z0-9_-]{0,59}$/), operator: z.enum(['equals', 'contains', 'notEmpty', 'numberAtLeast', 'numberAtMost']), expected: text.optional() }).strict()).min(1).max(40),
  }).strict()).min(1).max(30),
  // Without an explicit creator override every criterion is required.
  passPercent: z.number().int().min(1).max(100).optional(),
}).strict().superRefine((s, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  for (const items of [s.fields, s.inputs, s.tests, s.criteria]) if (new Set(items.map(i => i.id)).size !== items.length) error('Sandbox identifiers must be unique within each list.');
  const inputs = new Set(s.inputs.map(i => i.id)); const fields = new Set(s.fields.map(f => f.id));
  for (const test of s.tests) if (Object.keys(test.inputs).length !== inputs.size || Object.keys(test.inputs).some(k => !inputs.has(k))) error('Every test must supply exactly the declared inputs.');
  const usedTests = new Set<string>();
  for (const criterion of s.criteria) for (const check of criterion.checks) {
    usedTests.add(check.testId);
    if (!s.tests.some(t => t.id === check.testId)) error('A criterion references an unknown test.');
    if (check.path.startsWith('values.') && !fields.has(check.path.slice(7))) error('A criterion references an unknown artifact field.');
    if (check.operator !== 'notEmpty' && check.expected === undefined) error('This check needs an expected value.');
    if (check.operator.startsWith('number') && (!check.expected?.trim() || !Number.isFinite(Number(check.expected)))) error('Numeric checks need a finite expected number.');
  }
  if (s.tests.some(t => !usedTests.has(t.id))) error('Every test must contribute to a grading criterion.');
  const starter = SandboxArtifact.safeParse({ version: 1, values: Object.fromEntries(s.fields.map(f => [f.id, f.starter])), steps: s.starterSteps });
  if (!starter.success) error('Starter steps must form a valid artifact.');
});
export type ProjectSandboxData = z.infer<typeof ProjectSandbox>;
export type PublicSandbox = Omit<ProjectSandboxData, 'criteria'> & { criteria: Omit<ProjectSandboxData['criteria'][number], 'checks'>[] };
export const publicSandbox = (s: ProjectSandboxData): PublicSandbox => ({ ...s, criteria: s.criteria.map(c => ({ id: c.id, rubricIndex: c.rubricIndex, weight: c.weight, objectiveIds: c.objectiveIds, sourceIds: c.sourceIds, videoIds: c.videoIds })) });
export const starterArtifact = (s: PublicSandbox): SandboxArtifactData => ({ version: 1, values: Object.fromEntries(s.fields.map(f => [f.id, f.starter])), steps: s.starterSteps });

export type SandboxRun = { outputs: Record<string, string>; trace: { stepId: string; output: string; value: string }[]; error: string | null };
export type SandboxReport = { passed: boolean; score: number; total: number; percent: number; criteria: { id: string; rubricIndex: number; passed: boolean; earned: number; possible: number; checks: { testId: string; passed: boolean }[] }[]; runs: { testId: string; result: SandboxRun }[] };
export type SandboxWork = { artifact: SandboxArtifactData | null; version: number; report: SandboxReport | null; submittedAt: string | null; submissionId: string | null };

/** Bounded interpreter: no eval, user code, network, file or host-system access. */
export function runSandbox(artifact: SandboxArtifactData, inputs: Record<string, string>): SandboxRun {
  const outputs: Record<string, string> = Object.create(null); const trace: SandboxRun['trace'] = [];
  try {
    SandboxArtifact.parse(artifact); record.parse(inputs);
    const read = (ref: string): string => {
      const match = /^(input|values|output)\.([A-Za-z][A-Za-z0-9_-]{0,59})$/.exec(ref.trim());
      if (!match) throw new Error(`Use input.name, values.name or output.name: ${ref}`);
      const source = match[1] === 'input' ? inputs : match[1] === 'values' ? artifact.values : outputs;
      if (!Object.hasOwn(source, match[2]!)) throw new Error(`Unknown or unavailable value: ${ref}`);
      return source[match[2]!]!;
    };
    for (const step of artifact.steps) {
      let value: string;
      switch (step.operation) {
        case 'template': value = step.expression.replace(/\{\{([^{}]+)\}\}/g, (_all, ref: string) => read(ref)); break;
        case 'sum': case 'multiply': {
          const refs = step.expression.split(',');
          if (refs.length > 40 || !refs.length) throw new Error('Use at most 40 numeric value references.');
          const numbers = refs.map(ref => { const raw = read(ref); const n = Number(raw); if (!raw.trim() || !Number.isFinite(n)) throw new Error(`Not a finite number: ${ref}`); return n; });
          const result = step.operation === 'sum' ? numbers.reduce((a, b) => a + b, 0) : numbers.reduce((a, b) => a * b, 1);
          if (!Number.isFinite(result)) throw new Error('Numeric result is outside the supported range.');
          value = String(result); break;
        }
        case 'fallback': { const refs = step.expression.split('|'); if (refs.length !== 2) throw new Error('Fallback needs two references separated by |.'); value = read(refs[0]!); if (!value.trim()) value = read(refs[1]!); break; }
        case 'trim': value = read(step.expression).trim(); break;
        case 'uppercase': value = read(step.expression).toUpperCase(); break;
        case 'lowercase': value = read(step.expression).toLowerCase(); break;
        default: value = read(step.expression);
      }
      if (value.length > 4000) throw new Error('An output exceeded 4,000 characters.');
      outputs[step.output] = value; trace.push({ stepId: step.id, output: step.output, value });
    }
    return { outputs, trace, error: null };
  } catch (error) { return { outputs, trace, error: error instanceof Error ? error.message : 'Simulation failed.' }; }
}

export function gradeSandbox(definition: ProjectSandboxData, artifact: SandboxArtifactData): SandboxReport {
  const runs = definition.tests.map(test => ({ testId: test.id, result: runSandbox(artifact, test.inputs) }));
  const criteria = definition.criteria.map(criterion => {
    const checks = criterion.checks.map(check => {
      const run = runs.find(r => r.testId === check.testId)!.result;
      const [scope, name] = check.path.split('.');
      const values = scope === 'values' ? artifact.values : run.outputs;
      const value = Object.hasOwn(values, name!) ? values[name!] : undefined;
      let passed = !run.error && value !== undefined;
      if (passed) switch (check.operator) {
        case 'equals': passed = value === check.expected; break;
        case 'contains': passed = value!.includes(check.expected!); break;
        case 'notEmpty': passed = !!value!.trim(); break;
        case 'numberAtLeast': case 'numberAtMost': passed = !!value!.trim() && Number.isFinite(Number(value)) && (check.operator === 'numberAtLeast' ? Number(value) >= Number(check.expected) : Number(value) <= Number(check.expected)); break;
      }
      return { testId: check.testId, passed };
    });
    const passed = checks.every(c => c.passed);
    return { id: criterion.id, rubricIndex: criterion.rubricIndex, passed, earned: passed ? criterion.weight : 0, possible: criterion.weight, checks };
  });
  const score = criteria.reduce((n, c) => n + c.earned, 0); const total = criteria.reduce((n, c) => n + c.possible, 0);
  return { passed: runs.every(r => !r.result.error) && score * 100 >= total * (definition.passPercent ?? 100), score, total, percent: total ? score * 100 / total : 0, criteria, runs };
}
