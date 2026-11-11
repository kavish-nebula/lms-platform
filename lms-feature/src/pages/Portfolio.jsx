import { Package, Clock3, ShieldCheck, Download, ArrowRight } from 'lucide-react'
import { Btn, PageHeader, EmptyNote, StatTile } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { usePortfolio } from '../stores/portfolio.js'
import { useCourse } from '../stores/course.js'

/* Portfolio — the platform's answer to a badge shelf. Real artifacts or nothing. */
export default function Portfolio() {
  const artifacts = usePortfolio((s) => s.artifacts)
  const hours = usePortfolio((s) => s.hoursSaved())
  const quizzesPassed = useCourse((s) => Object.values(s.progress).filter((m) => m.quiz?.passed).length)

  const download = (a) => {
    const blob = new Blob([JSON.stringify(a.workflowJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${a.title.replace(/[^\w-]+/g, '-').toLowerCase()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader kicker="Portfolio" title="Proof of work" sub="Real artifacts or nothing — every one ships with the acceptance checks it passed." />

      <div className="grid c3">
        <StatTile icon={Package} value={artifacts.length} label={`artifact${artifacts.length === 1 ? '' : 's'} shipped`} />
        <StatTile icon={Clock3} tone="amber" value={hours} unit="hrs/wk" label="of work automated" />
        <StatTile icon={ShieldCheck} tone="ok" value={quizzesPassed} label={`module quiz${quizzesPassed === 1 ? '' : 'zes'} passed`} />
      </div>

      {artifacts.length === 0 ? (
        <div className="mt20">
          <EmptyNote>
            Nothing here yet. The course capstone — after the last module — is what lands here: a real workflow JSON with its acceptance checks attached.
            <div className="mt14"><Btn to="/course/n8n" variant="primary" size="sm">Go to the course <ArrowRight size={13} /></Btn></div>
          </EmptyNote>
        </div>
      ) : (
        <div className="stack-v mt20">
          {artifacts.map((a) => (
            <GlassCard key={a.id} hover>
              <div className="row between wrap">
                <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <span className="stat-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Package size={19} /></span>
                  <div>
                    <h3>{a.title}</h3>
                    <p className="muted small mt8" style={{ maxWidth: 560 }}>{a.summary}</p>
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="chip ok">+{a.hrsSaved} hrs/wk</span>
                  <span className="chip info">{a.lint?.filter((r) => r.status === 'pass').length}/{a.lint?.length} checks</span>
                  <Btn size="sm" onClick={() => download(a)}><Download size={13} /> Download .json</Btn>
                </div>
              </div>
              <div className="row wrap mt14" style={{ gap: 4 }}>
                {a.lint?.map((r) => (
                  <span key={r.id} className={`chip ${r.status === 'pass' ? 'ok' : 'warn'}`}>
                    {r.status === 'pass' ? '✓' : '!'} {r.label}
                  </span>
                ))}
              </div>
            </GlassCard>
          ))}
          <GlassCard className="role-card">
            <b className="small">Share line, ready to paste:</b>
            <p className="muted mono mt8" style={{ lineHeight: 1.7 }}>
              Built and debugged {artifacts.length} production-style n8n workflow{artifacts.length === 1 ? '' : 's'} —
              currently automating {hours} hrs/week of manual work. Every artifact ships with its acceptance checks.
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
