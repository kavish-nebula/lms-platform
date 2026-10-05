import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Btn } from './bits.jsx'

/*
  A question as a popup over the lesson. Built on the native <dialog>, so the
  page behind is inert, focus stays inside, and Esc closes it.
  `answered` is the chosen option index (null until the learner picks one);
  after an answer the popup shows why, and Continue moves on.
*/
export default function QuestionDialog({ open, kicker, question, options, correct, explain, answered, onAnswer, onContinue, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const right = answered === correct
  return (
    <dialog
      ref={ref}
      className="qdialog"
      aria-labelledby="qdialog-q"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current.close() }} // click on the backdrop
    >
      <div className="qdialog-body">
        <div className="row between">
          <div className="kicker">{kicker}</div>
          <button type="button" className="btn sm ghost" aria-label="Close and go back to the lesson" onClick={() => ref.current.close()}><X size={14} /></button>
        </div>
        <h2 id="qdialog-q">{question}</h2>
        <div>
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              className={`opt ${answered !== null && i === correct ? 'right' : ''} ${answered === i && !right ? 'wrong' : ''}`}
              disabled={answered !== null}
              onClick={() => onAnswer(i)}
            >
              {o}
            </button>
          ))}
        </div>
        {answered === null ? (
          <p className="tag-mono">not graded · Esc to go back and listen again</p>
        ) : (
          <div aria-live="polite">
            <p className="small">
              <b style={{ color: right ? 'var(--ok-ink)' : 'var(--err)' }}>{right ? 'Right — ' : 'Not quite — '}</b>
              {explain}
            </p>
            <div className="row between mt14">
              <span />
              <Btn variant="primary" autoFocus onClick={onContinue}>Continue →</Btn>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
