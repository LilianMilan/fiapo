import { useEffect, useRef } from 'react'

type Vec = { x: number; y: number }
type Anchor = { el: Element; x: number; y: number; w: number; h: number }
type Leg = { hip: Vec; rest: Vec; side: number; group: number; foot: Vec; from: Vec; to: Vec; t: number; stepping: boolean; target: Element | null }

// Elements the spider can walk on and grab with its feet
const SELECTOR = 'a, button, h1, h2, h3, p, li, .article-node, .node-tags span, .search-box, .foot-stat'
const UPPER = 34
const LOWER = 42
const SPEED = 70
const STEP_TIME = 0.16
const STEP_DIST = 30
const SNAP_DIST = 36
const TOUCH_MS = 1400
const CYAN = '#6fe3ff'
const PINK = '#ff4d8d'
const AMBER = '#e6ae67'
const WHITE = '#f4f5f6'
const DARK = '#0d0e11'
// Body size; outlines are divided by it so they stay thin as it grows
const BODY_SCALE = 1.6

// Local leg layout: +x is forward, +y is right
const LAYOUT = [
  { hip: { x: 10, y: 7 }, rest: { x: 50, y: 44 } },
  { hip: { x: 4, y: 8 }, rest: { x: 20, y: 58 } },
  { hip: { x: -4, y: 8 }, rest: { x: -20, y: 58 } },
  { hip: { x: -10, y: 7 }, rest: { x: -48, y: 44 } },
]

const rotate = (v: Vec, a: number): Vec => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const ease = (t: number) => t * t * (3 - 2 * t)

function knee(hip: Vec, foot: Vec, side: number): Vec {
  const d = Math.min(Math.max(dist(hip, foot), Math.abs(UPPER - LOWER) + 0.01), UPPER + LOWER - 0.01)
  const bend = Math.acos((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d))
  const angle = Math.atan2(foot.y - hip.y, foot.x - hip.x) - bend * side
  return { x: hip.x + Math.cos(angle) * UPPER, y: hip.y + Math.sin(angle) * UPPER }
}

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }

// Body in local space (+x forward), with whatever accessories are worn on top
function drawBody(ctx: CanvasRenderingContext2D, wear: string) {
  const t = performance.now() / 1000
  ctx.save()
  ctx.scale(BODY_SCALE, BODY_SCALE)
  ctx.lineCap = 'round'
  ctx.fillStyle = DARK
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 1.6 / BODY_SCALE
  ctx.beginPath(); ctx.ellipse(-6, 0, 12, 9.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  circle(ctx, 10, 0, 7); ctx.fill(); ctx.stroke()
  ctx.fillStyle = CYAN
  circle(ctx, -6, 0, 2.6); ctx.fill()
  for (const y of [-3.2, 3.2]) {
    ctx.fillStyle = WHITE; circle(ctx, 13, y, 2); ctx.fill()
    ctx.fillStyle = DARK; circle(ctx, 13.8, y, 1); ctx.fill()
  }

  if (wear.includes('cachecol')) {
    const sway = Math.sin(t * 7)
    ctx.fillStyle = AMBER
    ctx.fillRect(2, -7.5, 3.5, 15)
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2.6
    ctx.beginPath(); ctx.moveTo(3, 6.5); ctx.quadraticCurveTo(-3, 10 + sway * 2, -11, 9 + Math.sin(t * 7 + 1) * 3); ctx.stroke()
  }
  if (wear.includes('oculos')) {
    ctx.strokeStyle = WHITE
    ctx.lineWidth = 1.1 / BODY_SCALE
    for (const y of [-3.2, 3.2]) { circle(ctx, 13, y, 2.9); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(11.5, -5.6); ctx.lineTo(7, -6.8); ctx.moveTo(11.5, 5.6); ctx.lineTo(7, 6.8); ctx.stroke()
  }
  if (wear.includes('lacinho')) {
    ctx.fillStyle = PINK
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-10, 7 * s); ctx.lineTo(-2, 7 * s); ctx.closePath(); ctx.fill() }
    circle(ctx, -6, 0, 2); ctx.fill()
  }
  ctx.restore()
}

function readAnchors(canvas: HTMLCanvasElement): Anchor[] {
  const vw = window.innerWidth, vh = window.innerHeight
  const anchors: Anchor[] = []
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (canvas.contains(el)) continue
    const r = el.getBoundingClientRect()
    const visible = r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh
    if (!visible || r.width < 4 || r.height < 4 || r.width * r.height > vw * vh * 0.3) continue
    anchors.push({ el, x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height })
  }
  return anchors
}

export function PageCrawler() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const body: Vec = { x: window.scrollX + window.innerWidth / 2, y: window.scrollY + window.innerHeight / 2 }
    const vel: Vec = { x: 0, y: 0 }
    let angle = -Math.PI / 2
    let target: Vec | null = null
    let targetEl: Element | null = null
    let celebrating: Element | null = null
    let partyTime = 0
    let pause = 0
    let anchors = readAnchors(canvas)
    let anchorsAge = 0
    const touched = new Map<Element, number>()

    const legs: Leg[] = [-1, 1].flatMap(side => LAYOUT.map((l, i) => {
      const rest = { x: l.rest.x, y: l.rest.y * side }
      const foot = add(body, rotate(rest, angle))
      return { hip: { x: l.hip.x, y: l.hip.y * side }, rest, side, group: (i + (side > 0 ? 1 : 0)) % 2, foot, from: foot, to: foot, t: 0, stepping: false, target: null }
    }))

    const touch = (el: Element | null) => {
      if (!el) return
      el.classList.add('crawler-touched')
      el.classList.toggle('crawler-touched-alt', Math.random() < 0.35)
      touched.set(el, performance.now())
    }

    // A new source: the spider rushes over and makes the card bounce
    const cheer = (el: Element) => {
      el.classList.add('fiapo-celebrate')
      setTimeout(() => el.classList.remove('fiapo-celebrate'), 1400)
    }

    const snap =(p: Vec): { point: Vec; el: Element | null } => {
      let best: { point: Vec; el: Element | null } = { point: p, el: null }
      let bestDist = SNAP_DIST
      for (const a of anchors) {
        const q = { x: Math.min(Math.max(p.x, a.x), a.x + a.w), y: Math.min(Math.max(p.y, a.y), a.y + a.h) }
        const d = dist(p, q)
        if (d < bestDist) { bestDist = d; best = { point: q, el: a.el } }
      }
      return best
    }

    const pickTarget = () => {
      // Forgotten sources get visited more often
      // During a focus session he only weaves around the focus card
      const focusing = 'fiapoFocus' in document.documentElement.dataset
      const onCard = focusing ? anchors.filter(a => a.el.closest('[data-fiapo-focus]')) : []
      const pool = onCard.length ? onCard : anchors.flatMap(a => a.el.closest('[data-forgotten]') ? [a, a, a, a] : [a])
      const a = pool[Math.floor(Math.random() * pool.length)]
      if (a) {
        target = { x: a.x + Math.random() * a.w, y: a.y + Math.random() * a.h }
        targetEl = a.el
      } else {
        target = { x: window.scrollX + Math.random() * window.innerWidth, y: window.scrollY + Math.random() * window.innerHeight }
        targetEl = null
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      target = { x: e.pageX, y: e.pageY }
      targetEl = null
      celebrating = null
      pause = 0
    }

    const onParty = () => { partyTime = 1.8 }

    const onVisit = (e: Event) => {
      const el = document.querySelector(`[data-source-id="${CSS.escape((e as CustomEvent<string>).detail)}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      target = { x: r.left + window.scrollX + r.width / 2, y: r.top + window.scrollY + r.height / 2 }
      targetEl = el
      celebrating = el
      pause = 0
    }

    const update = (dt: number) => {
      anchorsAge += dt
      if (anchorsAge > 0.4) { anchors = readAnchors(canvas); anchorsAge = 0 }

      const mood = document.documentElement.dataset.fiapoMood
      const pace = celebrating ? 3 : mood === 'animado' ? 1.5 : mood === 'sonolento' ? 0.5 : 1

      if (pause > 0) pause -= dt
      else if (!target || dist(body, target) < 16) {
        if (target) {
          touch(targetEl)
          if (celebrating && celebrating === targetEl) cheer(celebrating)
          celebrating = null
          pause = (0.5 + Math.random() * 1.2) * (mood === 'sonolento' ? 2.5 : 1)
          target = null
        }
        else pickTarget()
      }

      // Party: stand still and spin in place
      if (partyTime > 0) { partyTime -= dt; angle += dt * 9 }

      const desired = target && pause <= 0 && partyTime <= 0 ? rotate({ x: SPEED * pace, y: 0 }, Math.atan2(target.y - body.y, target.x - body.x)) : { x: 0, y: 0 }
      const k = Math.min(1, dt * 4)
      vel.x += (desired.x - vel.x) * k
      vel.y += (desired.y - vel.y) * k
      body.x += vel.x * dt
      body.y += vel.y * dt

      if (Math.hypot(vel.x, vel.y) > 5) {
        const turn = Math.atan2(Math.sin(Math.atan2(vel.y, vel.x) - angle), Math.cos(Math.atan2(vel.y, vel.x) - angle))
        angle += turn * Math.min(1, dt * 5)
      }

      for (const leg of legs) {
        if (leg.stepping) {
          leg.t += dt / (STEP_TIME / Math.max(1, pace))
          leg.foot = lerp(leg.from, leg.to, ease(Math.min(1, leg.t)))
          if (leg.t >= 1) { leg.stepping = false; leg.foot = leg.to; touch(leg.target) }
          continue
        }
        const rest = add(add(body, rotate(leg.rest, angle)), { x: vel.x * 0.25, y: vel.y * 0.25 })
        const far = dist(leg.foot, rest)
        const otherGroupStepping = legs.some(l => l.stepping && l.group !== leg.group)
        if ((far > STEP_DIST && !otherGroupStepping) || far > STEP_DIST * 2.5) {
          const { point, el } = snap(add(rest, { x: vel.x * 0.15, y: vel.y * 0.15 }))
          Object.assign(leg, { stepping: true, t: 0, from: leg.foot, to: point, target: el })
        }
      }

      const now = performance.now()
      for (const [el, at] of touched) {
        if (now - at > TOUCH_MS) { el.classList.remove('crawler-touched', 'crawler-touched-alt'); touched.delete(el) }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.save()
      ctx.translate(-window.scrollX, -window.scrollY)

      if (target) {
        ctx.setLineDash([3, 5])
        ctx.strokeStyle = PINK + '66'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.lineTo(target.x, target.y); ctx.stroke()
        ctx.setLineDash([])
      }

      for (const leg of legs) {
        const hip = add(body, rotate(leg.hip, angle))
        const lift = leg.stepping ? Math.sin(Math.min(1, leg.t) * Math.PI) * 8 : 0
        const foot = { x: leg.foot.x, y: leg.foot.y - lift }
        const k = knee(hip, foot, leg.side)
        ctx.strokeStyle = CYAN
        ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(k.x, k.y); ctx.lineTo(foot.x, foot.y); ctx.stroke()
        ctx.fillStyle = PINK
        ctx.beginPath(); ctx.arc(k.x, k.y, 2.4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(foot.x, foot.y, leg.stepping ? 3.2 : 2.4, 0, Math.PI * 2); ctx.fill()
      }

      ctx.translate(body.x, body.y)
      ctx.rotate(angle)
      drawBody(ctx, document.documentElement.dataset.fiapoWear ?? '')
      ctx.restore()
    }

    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      update(Math.min(0.05, (now - last) / 1000))
      last = now
      draw()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    window.addEventListener('resize', resize)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('fiapo:visit', onVisit)
    window.addEventListener('fiapo:party', onParty)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('fiapo:visit', onVisit)
      window.removeEventListener('fiapo:party', onParty)
      for (const el of touched.keys()) el.classList.remove('crawler-touched', 'crawler-touched-alt')
    }
  }, [])

  return <canvas ref={canvasRef} className="page-crawler" aria-hidden="true" />
}
