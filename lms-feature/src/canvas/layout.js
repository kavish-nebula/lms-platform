/* Layout system: every pipeline lives on a 900×360 design grid, evenly spaced, centered. */
export const DESIGN_W = 900
export const NODE_W = 170

export function pipelineRow(specs, { y = 140, width = DESIGN_W, gap = 230 } = {}) {
  const n = specs.length
  if (!n) return []
  const g = n > 1 ? Math.min(gap, (width - NODE_W - 40) / (n - 1)) : 0
  const span = (n - 1) * g
  const start = Math.max(20, (width - NODE_W - span) / 2)
  return specs.map((s, i) => ({ ...s, x: Math.round(start + i * g), y }))
}
