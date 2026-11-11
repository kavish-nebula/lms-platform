import { Check } from 'lucide-react'

/* A module's checklist: one row per sub-module, then guided practice and the quiz. */
export default function ModuleSteps({ m, prog, className = '' }) {
  const rows = [
    ...m.submodules.map((sm) => ({
      key: sm.id,
      label: `${sm.id} · ${sm.title}`,
      done: (m.lite ? ['explain'] : ['explain', 'worked', 'scenarios']).every((k) => prog?.stages?.[`${sm.id}-${k}`]),
    })),
    ...(m.lite ? [] : [{ key: 'guided', label: 'Guided practice', done: !!prog?.stages?.guided }]),
    { key: 'quiz', label: 'Module quiz', done: !!prog?.stages?.quiz },
  ]
  return (
    <div className={`tree-rows ${className}`}>
      {rows.map((r) => (
        <div key={r.key} className="tree-row">
          <span className={`tree-ic ${r.done ? 'ok' : ''}`}>{r.done && <Check size={10} />}</span>
          <span className="small">{r.label}</span>
        </div>
      ))}
    </div>
  )
}
