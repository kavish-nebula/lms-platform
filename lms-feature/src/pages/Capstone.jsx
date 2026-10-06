import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import ProjectStage from '../stages/ProjectStage.jsx'
import AdaptedStrip from '../ui/AdaptedStrip.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { Btn } from '../ui/bits.jsx'
import { useCourse } from '../stores/course.js'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { COURSE, MODULES } from '../content/course.js'
import { CAPSTONE } from '../content/capstone.js'
import { currentModule } from '../engine/progress.js'
import { stageSettings } from '../engine/adaptive.js'

/*
  The course capstone — one big project after the last module and before the
  final assessment. It opens once every available module is complete; saving the
  accepted build to the Portfolio is what unlocks the final assessment.
*/
export default function Capstone() {
  const navigate = useNavigate()
  const progress = useCourse((s) => s.progress)
  const capstone = useCourse((s) => s.capstone)
  const recordCapstone = useCourse((s) => s.recordCapstone)
  const { calibrate, demoMode, profile } = useLearner()
  const adapt = useAdaptation()
  const pending = currentModule(progress, calibrate)
  const course = `/course/${COURSE.id}`

  // demo access opens it early, so a presenter can jump straight here
  if (pending && !demoMode) {
    return (
      <div className="mt30">
        <GlassCard className="pad-lg center" style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="kicker mb8">Course capstone · locked</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Finish the modules first</h1>
          <p className="muted mt8">The capstone uses every lesson in one build, so it opens once every available module is complete.</p>
          <div className="mt20"><Btn variant="primary" to={`/player/${pending.n}`}>Continue Module {pending.n} <ArrowRight size={14} /></Btn></div>
        </GlassCard>
      </div>
    )
  }

  // it draws on every lesson, so it follows the lesson that needs the most support
  const built = MODULES.filter((m) => m.built)
  const settings = stageSettings(adapt, { module: { n: CAPSTONE.n, submodules: built.flatMap((m) => m.submodules) }, kind: 'project', demoMode })

  return (
    <div>
      <div className="row between wrap mb14">
        <div>
          <div className="kicker">Course capstone · after {built.map((m) => `Module ${m.n}`).join(' and ')} · before the final assessment</div>
          <h1 style={{ fontSize: 27.5 }}>{CAPSTONE.title}</h1>
        </div>
        <Btn to={course} size="sm" variant="ghost">Exit to course path</Btn>
      </div>

      {capstone && (
        <div className="glass fb ok row between wrap mb14">
          <span className="small"><CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} /><b>Capstone accepted.</b> The final assessment is open on the course page — you can also rebuild the capstone below.</span>
          <Btn size="sm" variant="primary" to="/final">Final assessment <ArrowRight size={13} /></Btn>
        </div>
      )}

      <section className="glass stage-box">
        <AdaptedStrip chips={settings.chips} hasProfile={!!profile} />
        <ProjectStage
          content={CAPSTONE} moduleId="capstone" adapt={settings}
          onSaved={recordCapstone} onNext={() => navigate(course)}
          doneLabel="Back to the course — the final assessment is open →"
        />
      </section>
    </div>
  )
}
