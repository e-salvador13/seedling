import { mulberry32, type Rng } from './rng'
import type { Species } from './species'

export interface GNode {
  x: number
  y: number
  z: number
  parent: number
  birth: number
  death: number
  depth: number
  leafAngle: number
  leafTilt: number
  hasLeaf: boolean
  hasBloom: boolean
  hasFruit: boolean
  bloomDelay: number
}

export interface Attractor {
  x: number
  y: number
  z: number
  unlock: number
  killed: number
}

export interface Lifecycle {
  species: Species
  seed: number
  nodes: GNode[]
  roots: GNode[]
  attractors: Attractor[]
  height: number
}

/** Growth is slow for the first weeks and speeds up as the plant establishes. */
export function vigor(day: number): number {
  const t = Math.min(1, Math.max(0, (day - 12) / 100))
  return 0.1 + 0.9 * t * t * (3 - 2 * t)
}

interface Colony {
  nodes: GNode[]
  attractors: Attractor[]
  influence: number
  kill: number
  step: number
  perDay: number
  bias: number
  wobble: number
  leader: number
}

function makeNode(rng: Rng, sp: Species, x: number, y: number, z: number, parent: number, day: number, depth: number): GNode {
  const n: GNode = {
    x, y, z, parent, birth: day, death: Infinity, depth,
    leafAngle: rng() * Math.PI * 2,
    leafTilt: (rng() - 0.5) * 1.2,
    hasLeaf: rng() < sp.leaf.density,
    hasBloom: sp.bloom ? rng() < sp.bloom.density : false,
    hasFruit: false,
    bloomDelay: rng(),
  }
  if (n.hasBloom && sp.fruit && rng() < sp.fruit.density / (sp.bloom?.density ?? 1)) n.hasFruit = true
  return n
}

/** One day of space colonization for a colony (crown or roots). Returns indices of nodes born today. */
function growDay(c: Colony, rng: Rng, sp: Species, day: number, v: number): number[] {
  const { nodes, attractors } = c
  const cell = c.influence
  const key = (x: number, y: number, z: number) =>
    (Math.floor(x / cell) + 512) + (Math.floor(y / cell) + 512) * 1024 + (Math.floor(z / cell) + 512) * 1048576
  const grid = new Map<number, number[]>()
  for (let i = 0; i < nodes.length; i++) {
    const k = key(nodes[i].x, nodes[i].y, nodes[i].z)
    const b = grid.get(k)
    if (b) b.push(i)
    else grid.set(k, [i])
  }
  const px = new Float32Array(nodes.length)
  const py = new Float32Array(nodes.length)
  const pz = new Float32Array(nodes.length)
  const pc = new Uint16Array(nodes.length)
  for (const a of attractors) {
    if (a.killed !== Infinity || a.unlock > day) continue
    let best = -1
    let bd = c.influence
    const gx = Math.floor(a.x / cell)
    const gy = Math.floor(a.y / cell)
    const gz = Math.floor(a.z / cell)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const b = grid.get((gx + dx + 512) + (gy + dy + 512) * 1024 + (gz + dz + 512) * 1048576)
          if (!b) continue
          for (const i of b) {
            const n = nodes[i]
            const d = Math.hypot(n.x - a.x, n.y - a.y, n.z - a.z)
            if (d < bd) { bd = d; best = i }
          }
        }
    if (best < 0) continue
    const n = nodes[best]
    px[best] += (a.x - n.x) / bd
    py[best] += (a.y - n.y) / bd
    pz[best] += (a.z - n.z) / bd
    pc[best]++
  }
  const cand: number[] = []
  for (let i = 0; i < nodes.length; i++) if (pc[i] > 0) cand.push(i)
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = cand[i]; cand[i] = cand[j]; cand[j] = t
  }
  const born: number[] = []
  const limit = Math.min(cand.length, Math.max(1, Math.round(c.perDay * v)))
  const step = c.step * (0.55 + 0.45 * v)
  for (let k = 0; k < limit; k++) {
    const i = cand[k]
    const n = nodes[i]
    let dx = px[i] / pc[i] + (rng() - 0.5) * c.wobble
    let dy = py[i] / pc[i] + c.bias + (rng() - 0.5) * c.wobble * 0.6
    let dz = pz[i] / pc[i] + (rng() - 0.5) * c.wobble
    const l = Math.hypot(dx, dy, dz) || 1
    dx /= l; dy /= l; dz /= l
    nodes.push(makeNode(rng, sp, n.x + dx * step, n.y + dy * step, n.z + dz * step, i, day, n.depth + 1))
    born.push(nodes.length - 1)
  }
  return born
}

function killNear(c: Colony, born: number[], day: number): void {
  for (const i of born) {
    const n = c.nodes[i]
    for (const a of c.attractors) {
      if (a.killed !== Infinity) continue
      if (Math.hypot(n.x - a.x, n.y - a.y, n.z - a.z) < c.kill) a.killed = day
    }
  }
}

/** Deterministically grow a whole lifetime: shoot and roots. Rendering later asks "what exists at day d?" */
export function simulate(sp: Species, seed: number): Lifecycle {
  const rng = mulberry32(seed)
  const rand = (a: number, b: number) => a + (b - a) * rng()

  // Crown light
  const cy = sp.trunkHeight + sp.crown.lift + sp.crown.ry
  const attractors: Attractor[] = []
  const stretch = rand(0.85, 1.15)
  let minY = Infinity
  let maxY = -Infinity
  while (attractors.length < sp.attractors) {
    const x = rand(-1, 1)
    const y = rand(-1, 1)
    const z = rand(-1, 1)
    if (x * x + y * y + z * z > 1) continue
    if (sp.crown.shape === 'dome' && y < -0.55) continue
    const ay = cy + y * sp.crown.ry
    attractors.push({ x: x * sp.crown.rx * stretch, y: ay, z: z * sp.crown.rz / stretch, unlock: 0, killed: Infinity })
    if (ay < minY) minY = ay
    if (ay > maxY) maxY = ay
  }
  const growSpan = sp.calendar.growEnd - 12
  for (const a of attractors) {
    const t = (a.y - minY) / Math.max(0.001, maxY - minY)
    a.unlock = 12 + t * growSpan * 0.85 + rng() * growSpan * 0.12
  }

  // Root volume: a flattened bowl under the seed
  const rootAtts: Attractor[] = []
  const rrx = Math.max(0.5, sp.crown.rx * 0.75)
  const rry = Math.max(0.35, sp.trunkHeight * 0.55 + sp.crown.ry * 0.25)
  while (rootAtts.length < Math.round(sp.attractors * 0.45)) {
    const x = rand(-1, 1)
    const y = rand(-1, 0)
    const z = rand(-1, 1)
    if (x * x + y * y * 2.2 + z * z > 1) continue
    const ay = -0.08 + y * rry
    rootAtts.push({ x: x * rrx, y: ay, z: z * rrx, unlock: 0, killed: Infinity })
  }
  for (const a of rootAtts) {
    const depth = -a.y / rry
    const spread = Math.hypot(a.x, a.z) / rrx
    a.unlock = 4 + (depth * 0.5 + spread * 0.5) * growSpan * 0.95 + rng() * 12
  }

  const crown: Colony = {
    nodes: [makeNode(rng, sp, 0, 0, 0, -1, 0, 0)],
    attractors, influence: sp.influence, kill: sp.kill, step: sp.step, perDay: sp.growthPerDay,
    bias: sp.upBias, wobble: 0.5, leader: 0,
  }
  const roots: Colony = {
    nodes: [makeNode(rng, sp, 0, -0.02, 0, -1, 0, 0)],
    attractors: rootAtts, influence: sp.influence * 0.8, kill: sp.kill * 0.9, step: sp.step * 0.9, perDay: Math.max(2, sp.growthPerDay * 0.6),
    bias: -0.12, wobble: 0.9, leader: 0,
  }
  for (const c of [crown, roots]) for (const n of c.nodes) { n.hasLeaf = false; n.hasBloom = false; n.hasFruit = false }

  let lastShoot = 0
  const W = sp.calendar.winter
  for (let day = 1; day <= sp.days; day++) {
    // Dormant: nothing grows between leaf drop and bud break.
    if (W && day >= W.dropStart + 10 && day < W.end) continue
    const v = vigor(day)

    // Shoot: the leader reaches for the crown, slowly at first.
    const born = growDay(crown, rng, sp, day, v)
    const lead = crown.nodes[crown.leader]
    if (lead.y < cy - sp.crown.ry * 0.6 && (born.length === 0 || lead.y < sp.trunkHeight)) {
      const wob = sp.trunkHeight > 0.5 ? 0.1 : 0.45
      let dx = rand(-wob, wob)
      let dz = rand(-wob, wob)
      let dy = 1
      const l = Math.hypot(dx, dy, dz)
      dx /= l; dy /= l; dz /= l
      const step = sp.step * (0.12 + 0.88 * v)
      crown.nodes.push(makeNode(rng, sp, lead.x + dx * step, lead.y + dy * step, lead.z + dz * step, crown.leader, day, lead.depth + 1))
      crown.leader = crown.nodes.length - 1
      born.push(crown.leader)
      // Sapling side shoots: little leafy twigs on the young stem that drop off as the trunk thickens.
      if (sp.trunkHeight > 0.5 && day > 6 && day - lastShoot >= 5 && lead.y < sp.trunkHeight) {
        lastShoot = day
        const a = rng() * Math.PI * 2
        const r = sp.step * 0.9
        const death = day + 70 + rng() * 30
        const s1 = makeNode(rng, sp, lead.x + Math.cos(a) * r, lead.y + r * 0.5, lead.z + Math.sin(a) * r, crown.leader, day, lead.depth + 2)
        const s2 = makeNode(rng, sp, s1.x + Math.cos(a) * r * 0.9, s1.y + r * 0.6, s1.z + Math.sin(a) * r * 0.9, crown.nodes.length, day + 2, lead.depth + 3)
        for (const sh of [s1, s2]) { sh.death = death; sh.hasBloom = false; sh.hasFruit = false; sh.hasLeaf = true }
        crown.nodes.push(s1, s2)
        born.push(crown.nodes.length - 2)
      }
    }
    killNear(crown, born, day)

    // Roots: the radicle goes down first, then the colony fills the bowl.
    const rb = growDay(roots, rng, sp, day, v)
    const rl = roots.nodes[roots.leader]
    if (rl.y > -rry * 0.9 && (rb.length === 0 || day < 12)) {
      let dx = rand(-0.3, 0.3)
      let dz = rand(-0.3, 0.3)
      let dy = -1
      const l = Math.hypot(dx, dy, dz)
      dx /= l; dy /= l; dz /= l
      const step = roots.step * (0.5 + 0.5 * v)
      roots.nodes.push(makeNode(rng, sp, rl.x + dx * step, rl.y + dy * step, rl.z + dz * step, roots.leader, day, rl.depth + 1))
      roots.leader = roots.nodes.length - 1
      rb.push(roots.leader)
    }
    killNear(roots, rb, day)
  }

  let height = 0
  for (const n of crown.nodes) if (n.y > height) height = n.y
  return { species: sp, seed, nodes: crown.nodes, roots: roots.nodes, attractors, height }
}

/** Number of descendants (plus self) alive at `day`, for every node. */
export function subtreeSizes(nodes: GNode[], day: number, out: Int32Array): void {
  for (let i = 0; i < nodes.length; i++) out[i] = nodes[i].birth <= day && nodes[i].death > day ? 1 : 0
  for (let i = nodes.length - 1; i > 0; i--) {
    if (out[i] === 0) continue
    out[nodes[i].parent] += out[i]
  }
}

export type Phase = 'germinating' | 'seedling' | 'growing' | 'first autumn' | 'winter' | 'bud break' | 'in bloom' | 'fruiting' | 'autumn' | 'resting'

export function phaseAt(sp: Species, day: number): Phase {
  if (day < 6) return 'germinating'
  if (day < 40) return 'seedling'
  const W = sp.calendar.winter
  if (W && day >= W.dropStart && day < W.start) return 'first autumn'
  if (W && day >= W.start && day < W.end) return 'winter'
  if (W && sp.bloom && day >= W.end && day < sp.bloom.start) return 'bud break'
  if (sp.leaf.dropStart !== null && day >= sp.leaf.dropStart) return 'autumn'
  if (sp.fruit && day >= sp.fruit.start) return 'fruiting'
  if (sp.bloom && day >= sp.bloom.start && day <= sp.bloom.end) return 'in bloom'
  if (day >= sp.days * 0.62 && !sp.fruit && (!sp.bloom || day > sp.bloom.end)) return 'resting'
  return 'growing'
}
