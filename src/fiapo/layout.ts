// Where each source card sits on the web, in pixels of the stage
export type Spot = { x: number; y: number }
export type CardSize = { w: number; h: number }

const GAP = 12
const PAD = { side: 8, top: 34, bottom: 34 } // room for the "SUA TEIA" label and the legend
const SPIDER = { w: 110, h: 104, top: 0.51 } // the halo plus the caption under it, centered like .spider-wrap

// First ring holds 6 sources; the outer ring starts between them so cards don't line up
function ringSpot(i: number, n: number, w: number, h: number): Spot {
  const outer = i >= 6
  const count = outer ? n - 6 : Math.min(n, 6)
  const k = outer ? i - 6 : i
  const angle = -Math.PI / 2 + (k / count) * Math.PI * 2 + (outer ? Math.PI / 6 : 0)
  const [rx, ry] = outer ? [0.42, 0.4] : [0.31, 0.31]
  return { x: w / 2 + Math.cos(angle) * rx * w, y: h / 2 + Math.sin(angle) * ry * h }
}

// Starts from the rings, then nudges cards apart until none overlap each other, the spider or the edges
export function layoutWeb(n: number, w: number, h: number, card: CardSize): Spot[] {
  const spots = Array.from({ length: n }, (_, i) => ringSpot(i, n, w, h))
  const spider = { x: w / 2, y: h * SPIDER.top }
  const minX = card.w / 2 + PAD.side, maxX = w - card.w / 2 - PAD.side
  const minY = card.h / 2 + PAD.top, maxY = h - card.h / 2 - PAD.bottom
  const clamp = (v: number, lo: number, hi: number) => lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi)

  for (let round = 0; round < 120; round++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = spots[i], b = spots[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const ox = card.w + GAP - Math.abs(dx), oy = card.h + GAP - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        // Push apart along the shorter way out; a tie (same x) still gets a direction
        if (ox < oy) { const s = (dx < 0 ? -1 : 1) * ox / 2; a.x -= s; b.x += s }
        else { const s = (dy < 0 ? -1 : 1) * oy / 2; a.y -= s; b.y += s }
      }
    }
    for (const p of spots) {
      const dx = p.x - spider.x, dy = p.y - spider.y
      const ox = (card.w + SPIDER.w) / 2 + GAP - Math.abs(dx), oy = (card.h + SPIDER.h) / 2 + GAP - Math.abs(dy)
      if (ox > 0 && oy > 0) {
        moved = true
        if (ox < oy) p.x += (dx < 0 ? -1 : 1) * ox
        else p.y += (dy < 0 ? -1 : 1) * oy
      }
      p.x = clamp(p.x, minX, maxX)
      p.y = clamp(p.y, minY, maxY)
    }
    if (!moved) break
  }
  return overlaps(spots, spider, card) ? gridLayout(n, w, h, card) : spots
}

const columns = (w: number, card: CardSize) => Math.max(1, Math.floor((w - 2 * PAD.side) / (card.w + GAP)))

function overlaps(spots: Spot[], spider: Spot, card: CardSize) {
  return spots.some((a, i) =>
    (Math.abs(a.x - spider.x) < (card.w + SPIDER.w) / 2 && Math.abs(a.y - spider.y) < (card.h + SPIDER.h) / 2)
    || spots.slice(i + 1).some(b => Math.abs(a.x - b.x) < card.w && Math.abs(a.y - b.y) < card.h))
}

// Fallback when the rings get too crowded (mostly on phones): tidy rows above and below the spider
function gridLayout(n: number, w: number, h: number, card: CardSize): Spot[] {
  const cols = columns(w, card)
  const rows = Math.ceil(n / cols)
  const above = Math.ceil(rows / 2)
  const step = card.h + GAP
  const spiderY = h * SPIDER.top
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, n - row * cols)
    const x = w / 2 + ((i % cols) - (inRow - 1) / 2) * (card.w + GAP)
    const y = row < above
      ? spiderY - (SPIDER.h + card.h) / 2 - GAP - (above - 1 - row) * step
      : spiderY + (SPIDER.h + card.h) / 2 + GAP + (row - above) * step
    return { x, y }
  })
}

// Taller stage as the web grows, so every card has room: rows of cards plus one row for the spider
export function stageHeight(n: number, w: number, card: CardSize) {
  const rows = Math.max(3, Math.ceil(n / columns(w, card)) + 1)
  const needed = Math.ceil(rows * (card.h + GAP) * 1.3) + PAD.top + PAD.bottom
  return Math.max(n > 6 ? 600 : 0, needed)
}
