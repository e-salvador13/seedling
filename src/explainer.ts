import { mulberry32 } from './rng'

interface N2 { x: number; y: number; p: number; birth: number }
interface A2 { x: number; y: number; unlock: number; killed: number }
interface Tree2 { nodes: N2[]; atts: A2[]; days: number; sizes: Int32Array }

const INK = '#1f2a23'
const MUTED = 'rgba(31,42,35,0.35)'
const GOLD = '#d9a441'
const ACCENT = '#c9718c'

/** Small 2D version of the same growth rule, precomputed so figures can scrub by day. */
function grow2d(seed: number, w: number, h: number, days = 140): Tree2 {
  const rng = mulberry32(seed)
  const cx = w / 2
  const groundY = h - 30
  const trunk = 120
  const rx = 190 + rng() * 60
  const ry = 110 + rng() * 30
  const cy = groundY - trunk - ry
  const atts: A2[] = []
  while (atts.length < 260) {
    const x = rng() * 2 - 1
    const y = rng() * 2 - 1
    if (x * x + y * y > 1) continue
    const ay = cy + y * ry
    atts.push({ x: cx + x * rx, y: ay, unlock: ((cy + ry - ay) / (2 * ry)) * days * 0.5 + rng() * 10, killed: Infinity })
  }
  const nodes: N2[] = [{ x: cx, y: groundY, p: -1, birth: 0 }]
  const step = 9
  const influence = 70
  const kill = 16
  let leader = 0
  for (let day = 1; day <= days; day++) {
    const px = new Float32Array(nodes.length)
    const py = new Float32Array(nodes.length)
    const pc = new Uint16Array(nodes.length)
    for (const a of atts) {
      if (a.killed !== Infinity || a.unlock > day) continue
      let best = -1
      let bd = influence
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - a.x, nodes[i].y - a.y)
        if (d < bd) { bd = d; best = i }
      }
      if (best < 0) continue
      px[best] += (a.x - nodes[best].x) / bd
      py[best] += (a.y - nodes[best].y) / bd
      pc[best]++
    }
    const born: number[] = []
    const cand: number[] = []
    for (let i = 0; i < nodes.length; i++) if (pc[i] > 0) cand.push(i)
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]] }
    for (const i of cand.slice(0, 6)) {
      let dx = px[i] / pc[i] + (rng() - 0.5) * 0.5
      let dy = py[i] / pc[i] - 0.2 + (rng() - 0.5) * 0.3
      const l = Math.hypot(dx, dy) || 1
      dx /= l; dy /= l
      nodes.push({ x: nodes[i].x + dx * step, y: nodes[i].y + dy * step, p: i, birth: day })
      born.push(nodes.length - 1)
    }
    const lead = nodes[leader]
    if (lead.y > cy + ry * 0.4 && (born.length === 0 || lead.y > groundY - trunk)) {
      nodes.push({ x: lead.x + (rng() - 0.5) * 3, y: lead.y - step, p: leader, birth: day })
      leader = nodes.length - 1
      born.push(leader)
    }
    for (const i of born) for (const a of atts) if (a.killed === Infinity && Math.hypot(nodes[i].x - a.x, nodes[i].y - a.y) < kill) a.killed = day
  }
  const sizes = new Int32Array(nodes.length)
  return { nodes, atts, days, sizes }
}

function sizesAt(t: Tree2, day: number): Int32Array {
  const s = t.sizes
  for (let i = 0; i < t.nodes.length; i++) s[i] = t.nodes[i].birth <= day ? 1 : 0
  for (let i = t.nodes.length - 1; i > 0; i--) if (s[i]) s[t.nodes[i].p] += s[i]
  return s
}

function drawTree(ctx: CanvasRenderingContext2D, t: Tree2, day: number, highlight?: Set<number>): void {
  const s = sizesAt(t, day)
  ctx.lineCap = 'round'
  for (let i = 1; i < t.nodes.length; i++) {
    const n = t.nodes[i]
    if (n.birth > day) continue
    const p = t.nodes[n.p]
    const age = day - n.birth
    const w = Math.min(16, 1.1 * Math.sqrt(s[i])) * Math.min(1, 0.4 + age / 30)
    ctx.strokeStyle = highlight?.has(i) ? ACCENT : INK
    ctx.lineWidth = Math.max(1, w)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(n.x, n.y)
    ctx.stroke()
  }
}

function drawLight(ctx: CanvasRenderingContext2D, t: Tree2, day: number): void {
  for (const a of t.atts) {
    const spent = a.killed <= day
    const unlocked = a.unlock <= day
    ctx.fillStyle = spent ? 'rgba(217,164,65,0.12)' : unlocked ? GOLD : 'rgba(217,164,65,0.35)'
    ctx.beginPath()
    ctx.arc(a.x, a.y, spent ? 2 : 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function ground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = MUTED
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, h - 30)
  ctx.lineTo(w - 40, h - 30)
  ctx.stroke()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = MUTED): void {
  ctx.fillStyle = color
  ctx.font = '500 13px "JetBrains Mono", monospace'
  ctx.fillText(text, x, y)
}

function figLight(): void {
  const c = document.getElementById('fig-light') as HTMLCanvasElement | null
  if (!c) return
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const t = grow2d(7, W, H)
  const slider = document.getElementById('fig-light-day') as HTMLInputElement
  const out = document.getElementById('fig-light-out')!
  let day = 0
  let auto = true
  const draw = () => {
    ctx.clearRect(0, 0, W, H)
    ground(ctx, W, H)
    drawLight(ctx, t, day)
    drawTree(ctx, t, day)
    const alive = t.atts.filter((a) => a.killed > day && a.unlock <= day).length
    label(ctx, `${alive} points of light still pulling`, 40, 36)
    out.textContent = String(Math.floor(day))
    slider.value = String(Math.floor(day))
  }
  slider.addEventListener('input', () => { auto = false; day = Number(slider.value); draw() })
  const tick = () => {
    if (auto) {
      day += 0.35
      if (day > t.days + 25) day = 0
      draw()
    }
    requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { requestAnimationFrame(tick); io.disconnect() } })
  io.observe(c)
  draw()
}

function figPipe(): void {
  const c = document.getElementById('fig-pipe') as HTMLCanvasElement | null
  if (!c) return
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const t = grow2d(21, W, H)
  const out = document.getElementById('fig-pipe-out')!
  const day = t.days + 30
  const sizes = Int32Array.from(sizesAt(t, day))
  const draw = (hi?: Set<number>, pick?: number) => {
    ctx.clearRect(0, 0, W, H)
    ground(ctx, W, H)
    drawTree(ctx, t, day, hi)
    if (pick !== undefined) {
      const n = t.nodes[pick]
      ctx.fillStyle = ACCENT
      ctx.beginPath()
      ctx.arc(n.x, n.y, 5, 0, Math.PI * 2)
      ctx.fill()
      label(ctx, `feeds ${sizes[pick]} segments → width √${sizes[pick]} ≈ ${Math.sqrt(sizes[pick]).toFixed(1)}`, 40, 36, INK)
    } else {
      label(ctx, 'trunk feeds everything, so it is the widest', 40, 36)
    }
  }
  draw()
  c.addEventListener('mousemove', (e) => {
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    let best = -1
    let bd = 14
    for (let i = 1; i < t.nodes.length; i++) {
      const d = Math.hypot(t.nodes[i].x - x, t.nodes[i].y - y)
      if (d < bd) { bd = d; best = i }
    }
    if (best < 0) { draw(); out.textContent = 'Hover a branch'; return }
    const hi = new Set<number>()
    for (let i = t.nodes.length - 1; i >= 1; i--) {
      if (i === best || hi.has(t.nodes[i].p)) hi.add(i)
    }
    draw(hi, best)
    out.textContent = `This branch carries ${sizes[best]} segments above it`
  })
  c.addEventListener('mouseleave', () => { draw(); out.textContent = 'Hover a branch' })
}

function figOrder(): void {
  const c = document.getElementById('fig-order') as HTMLCanvasElement | null
  if (!c) return
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const out = document.getElementById('fig-order-out')!
  const left = W * 0.55
  let seed = 3
  let t = grow2d(seed, left, H)
  let day = 0
  let hold = 0
  const series: number[] = []
  const replant = () => { seed = Math.floor(Math.random() * 1e6); t = grow2d(seed, left, H); day = 0; series.length = 0 }
  document.getElementById('fig-order-replay')!.addEventListener('click', replant)
  const draw = () => {
    ctx.clearRect(0, 0, W, H)
    ground(ctx, left, H)
    drawLight(ctx, t, day)
    drawTree(ctx, t, day)
    const total = t.atts.length
    const spent = t.atts.filter((a) => a.killed <= day).length
    if (series.length < Math.floor(day)) series.push(spent / total)
    const gx = left + 50
    const gy = 60
    const gw = W - gx - 40
    const gh = H - gy - 70
    ctx.strokeStyle = MUTED
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx, gy + gh)
    ctx.lineTo(gx + gw, gy + gh)
    ctx.stroke()
    label(ctx, 'light spent', gx, gy - 14)
    label(ctx, '100%', gx - 44, gy + 4)
    label(ctx, '0', gx - 14, gy + gh + 4)
    label(ctx, `day ${Math.floor(day)}`, gx + gw - 60, gy + gh + 22)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 2.5
    ctx.beginPath()
    series.forEach((v, i) => {
      const x = gx + (i / (t.days + 25)) * gw
      const y = gy + gh - v * gh
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    label(ctx, `seed ${seed}`, 40, 36)
    out.textContent = `${Math.round((spent / total) * 100)}% of the light has become tree`
  }
  const tick = () => {
    if (day < t.days + 25) day += 0.45
    else if (++hold > 150) { hold = 0; replant() }
    draw()
    requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { requestAnimationFrame(tick); io.disconnect() } })
  io.observe(c)
  draw()
}

export function initExplainer(): void {
  figLight()
  figPipe()
  figOrder()
}
