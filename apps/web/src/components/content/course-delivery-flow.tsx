import { MODULE_FLOW, COURSE_END_FLOW, CODEX_MODULE_FLOW, CODEX_COURSE_END_FLOW, STAGE_LABELS, type DeliveryStructure } from '@/lib/course-delivery';
export function CourseDeliveryFlow({ structure, lastModule = 'the final module' }: { structure?: DeliveryStructure; lastModule?: string }) {
  if (structure !== 'six-stage-v1' && structure !== 'codex-ild-v2') return null;
  const moduleFlow = structure === 'codex-ild-v2' ? CODEX_MODULE_FLOW : MODULE_FLOW;
  const courseEnd = structure === 'codex-ild-v2' ? CODEX_COURSE_END_FLOW : COURSE_END_FLOW;
  return <section aria-label="Course delivery structure" className="space-y-4 rounded-xl border border-line bg-panel p-5 text-sm">
    <h2 className="text-xl font-semibold">Course learning sequence</h2>
    <p>Every module follows these stages in order:</p><ol className="flex flex-wrap gap-3">{moduleFlow.map((stage, i) => <li className="rounded-lg border border-line px-3 py-2" key={stage}>{i + 1}. {STAGE_LABELS[stage]}</li>)}</ol>
    {structure === 'codex-ild-v2' && <p>Each concept video pauses around its midpoint for two formative questions. These checks give feedback and do not count toward mastery.</p>}
    <h3 className="font-semibold">After completing {lastModule}</h3><ol className="list-decimal space-y-2 pl-5">{courseEnd.map(stage => <li key={stage}>{STAGE_LABELS[stage]}</li>)}</ol>
    <p className="text-xs text-ink-muted">{structure === 'codex-ild-v2' ? 'Course-wide assessment and reflection assets are authored once after the modules. Nothing is published until the full course has passed human review.' : 'Course-end stages remain separate from module instruction. This delivery layout does not publish the course or approve new assessment assets.'}</p>
    <p className="text-xs text-ink-muted">{structure === 'codex-ild-v2' ? 'Codex ILD structure v2. Video, slide and narration length are recommended from the learning objectives and time budget, then editable by the creator.' : 'Delivery structure v1. Frozen blueprints, approvals and completed media retain their original records.'}</p>
  </section>;
}
