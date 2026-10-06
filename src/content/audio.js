/*
  Narration clip paths — the single naming scheme shared by the stages (which
  play them) and scripts/gen-audio.mjs (which generates them from the content).
*/
const at = (name) => `/audio/${name}.mp3`

export const AUDIO = {
  intro: (m) => at(`${m.id}-intro`),
  reveal: (m) => at(`${m.id}-reveal`),
  beat: (m, sm, i) => at(`${m.id}-${sm.id}-beat${i}`),
  worked: (m, sm) => at(`${m.id}-${sm.id}-worked`),
  scenario: (m, sm, i) => at(`${m.id}-${sm.id}-scn${i}`),
  guidedFinal: (m) => at(`${m.id}-guided-final`),
  guidedBroken: (m) => at(`${m.id}-guided-broken`),
  guidedFix: (m) => at(`${m.id}-guided-fix`),
  brief: (m) => at(`${m.id}-project-brief`),
  slide: (video, i) => at(`video-${video.id}-s${i}`),
}

/* The course capstone has one clip: its brief. */
export const capstoneAudio = (c) => [{ src: AUDIO.brief(c), text: c.project.briefNarration }]

/* Every clip a module needs: [{ src, text }]. Clips with no text are skipped. */
export function audioItems(m) {
  // a video module only has its slides
  if (m.lite) return m.submodules.flatMap((sm) => sm.video.slides.map((s, i) => ({ src: AUDIO.slide(sm.video, i), text: s.narration })))
  const items = [
    { src: AUDIO.intro(m), text: m.hook.introNarration },
    { src: AUDIO.reveal(m), text: m.hook.revealNarration },
  ]
  for (const sm of m.submodules) {
    // a lesson with a concept video is explained by its slides; otherwise by its beats
    if (sm.video) sm.video.slides.forEach((s, i) => items.push({ src: AUDIO.slide(sm.video, i), text: s.narration }))
    else sm.explainer.beats.forEach((b, i) => items.push({ src: AUDIO.beat(m, sm, i), text: b.narration }))
    items.push({ src: AUDIO.worked(m, sm), text: sm.worked.narration })
    sm.scenarioQs.forEach((q, i) => items.push({ src: AUDIO.scenario(m, sm, i), text: q.say || q.q }))
  }
  items.push(
    { src: AUDIO.guidedFinal(m), text: m.guided.finalNarration },
    { src: AUDIO.guidedBroken(m), text: m.guided.breakDrill?.brokenNarration },
    { src: AUDIO.guidedFix(m), text: m.guided.breakDrill?.fixNarration },
  )
  // the case-file tour: narrated like video slides
  if (m.guided?.tour) m.guided.tour.slides.forEach((s, i) => items.push({ src: AUDIO.slide(m.guided.tour, i), text: s.narration }))
  return items.filter((it) => it.text)
}
