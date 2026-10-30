import * as tf from '@tensorflow/tfjs'
import type { Species } from './species'

/**
 * Growing Neural Cellular Automaton (after Mordvintsev et al., 2020).
 * Every cell holds 16 numbers: red, green, blue, alpha, and 12 hidden channels.
 * Each step a cell looks at its 3x3 neighbourhood (identity + Sobel x + Sobel y),
 * runs the same tiny network, and nudges its own state. Half the cells update each step.
 */
export const SIZE = 32
export const CH = 16
export const HID = 96
const PERC = CH * 3
export const POOL = 48
export const BATCH = 4

export interface Weights { w1: number[]; b1: number[]; w2: number[] }

function sobel(): tf.Tensor4D {
  const ident = [0, 0, 0, 0, 1, 0, 0, 0, 0]
  const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1].map((v) => v / 8)
  const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1].map((v) => v / 8)
  const f = new Float32Array(9 * CH * 3)
  for (let c = 0; c < CH; c++)
    for (let k = 0; k < 9; k++) {
      f[(k * CH + c) * 3 + 0] = ident[k]
      f[(k * CH + c) * 3 + 1] = sx[k]
      f[(k * CH + c) * 3 + 2] = sy[k]
    }
  return tf.tensor4d(f, [3, 3, CH, 3])
}

export class NCA {
  w1: tf.Variable
  b1: tf.Variable
  w2: tf.Variable
  private kernel: tf.Tensor4D
  private opt = tf.train.adam(2e-3)
  pool: Float32Array[] = []
  target: tf.Tensor4D | null = null
  trainSteps = 0
  losses: number[] = []

  constructor() {
    this.kernel = sobel()
    this.w1 = tf.variable(tf.randomNormal([1, 1, PERC, HID], 0, Math.sqrt(2 / PERC)))
    this.b1 = tf.variable(tf.zeros([HID]))
    this.w2 = tf.variable(tf.zeros([1, 1, HID, CH]))
  }

  dispose(): void {
    this.kernel.dispose()
    this.w1.dispose()
    this.b1.dispose()
    this.w2.dispose()
    this.target?.dispose()
  }

  seed(batch = 1): tf.Tensor4D {
    return tf.tidy(() => {
      const s = tf.buffer([batch, SIZE, SIZE, CH])
      const c = SIZE >> 1
      for (let b = 0; b < batch; b++) for (let ch = 3; ch < CH; ch++) s.set(1, b, c, c, ch)
      return s.toTensor() as tf.Tensor4D
    })
  }

  /** Cells count as alive when any neighbour has alpha > 0.1. A hard threshold has no gradient, so this op passes none back. */
  private aliveOp = tf.customGrad((x, save) => {
    const t = x as tf.Tensor4D
    const alpha = t.slice([0, 0, 0, 3], [-1, -1, -1, 1])
    const value = tf.maxPool(alpha, 3, 1, 'same').greater(0.1).toFloat()
    ;(save as tf.GradSaveFunc)([t])
    return { value, gradFunc: (_dy: tf.Tensor, saved: tf.Tensor[]) => [tf.zerosLike(saved[0])] }
  })

  private alive(x: tf.Tensor4D): tf.Tensor4D {
    return this.aliveOp(x) as tf.Tensor4D
  }

  step(x: tf.Tensor4D, fireRate = 0.5): tf.Tensor4D {
    return tf.tidy(() => {
      const pre = this.alive(x)
      const y = tf.depthwiseConv2d(x, this.kernel, 1, 'same') as tf.Tensor4D
      const h = tf.relu(tf.conv2d(y, this.w1 as tf.Tensor4D, 1, 'same').add(this.b1)) as tf.Tensor4D
      const dx = tf.conv2d(h, this.w2 as tf.Tensor4D, 1, 'same')
      const mask = tf.randomUniform([x.shape[0], SIZE, SIZE, 1]).less(fireRate).toFloat()
      const nx = x.add(dx.mul(mask)) as tf.Tensor4D
      const post = this.alive(nx)
      return nx.mul(pre.mul(post)) as tf.Tensor4D
    })
  }

  run(x: tf.Tensor4D, steps: number): tf.Tensor4D {
    let s = x
    for (let i = 0; i < steps; i++) {
      const n = this.step(s)
      if (s !== x) s.dispose()
      s = n
    }
    return s
  }

  setTarget(rgba: Float32Array): void {
    this.target?.dispose()
    // premultiplied alpha, like the paper
    const t = new Float32Array(SIZE * SIZE * 4)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const a = rgba[i * 4 + 3]
      t[i * 4] = rgba[i * 4] * a
      t[i * 4 + 1] = rgba[i * 4 + 1] * a
      t[i * 4 + 2] = rgba[i * 4 + 2] * a
      t[i * 4 + 3] = a
    }
    this.target = tf.tensor4d(t, [1, SIZE, SIZE, 4])
    this.resetPool()
  }

  resetPool(): void {
    const seed = this.seed(1)
    const data = seed.dataSync() as Float32Array
    seed.dispose()
    this.pool = Array.from({ length: POOL }, () => new Float32Array(data))
    this.trainSteps = 0
    this.losses = []
  }

  loss(x: tf.Tensor4D): tf.Scalar {
    return tf.tidy(() => {
      const rgba = x.slice([0, 0, 0, 0], [-1, -1, -1, 4])
      return rgba.sub(this.target!).square().mean([1, 2, 3]).mean() as tf.Scalar
    })
  }

  /** One training step on a batch drawn from the sample pool. Returns the loss. */
  async trainStep(): Promise<number> {
    return this.trainStepSync()
  }

  /** Same as trainStep but reads results synchronously, so it keeps running in a background tab where timers are throttled. */
  trainStepSync(): number {
    if (!this.target) throw new Error('no target')
    const idx: number[] = []
    while (idx.length < BATCH) {
      const i = Math.floor(Math.random() * POOL)
      if (!idx.includes(i)) idx.push(i)
    }
    const batchData = new Float32Array(BATCH * SIZE * SIZE * CH)
    for (let b = 0; b < BATCH; b++) batchData.set(this.pool[idx[b]], b * SIZE * SIZE * CH)
    let x0 = tf.tensor4d(batchData, [BATCH, SIZE, SIZE, CH])

    // Keep the pool honest: the worst sample restarts from the seed; sometimes wound one so it learns to heal.
    const per = tf.tidy(() => {
      const rgba = x0.slice([0, 0, 0, 0], [-1, -1, -1, 4])
      return rgba.sub(this.target!).square().mean([1, 2, 3]).dataSync() as Float32Array
    })
    let worst = 0
    for (let b = 1; b < BATCH; b++) if (per[b] > per[worst]) worst = b
    const seedData = this.seed(1).dataSync() as Float32Array
    batchData.set(seedData, worst * SIZE * SIZE * CH)
    if (this.trainSteps > 150) {
      const victim = (worst + 1) % BATCH
      const cx = 8 + Math.random() * (SIZE - 16)
      const cy = 8 + Math.random() * (SIZE - 16)
      const r = 5 + Math.random() * 4
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 < r * r)
            for (let c = 0; c < CH; c++) batchData[((victim * SIZE + y) * SIZE + x) * CH + c] = 0
    }
    x0.dispose()
    x0 = tf.tensor4d(batchData, [BATCH, SIZE, SIZE, CH])

    const steps = 40 + Math.floor(Math.random() * 24)
    let final: tf.Tensor4D | null = null
    const vars = [this.w1, this.b1, this.w2]
    const { value, grads } = tf.variableGrads(() => {
      const x = this.run(x0, steps)
      final = tf.keep(x)
      return this.loss(x)
    }, vars)
    // Normalise each gradient so the step size does not explode through 60 unrolled steps.
    const normed: Record<string, tf.Tensor> = {}
    for (const k of Object.keys(grads)) {
      const g = grads[k]
      normed[k] = tf.tidy(() => g.div(g.norm().add(1e-8)))
      g.dispose()
    }
    this.opt.applyGradients(Object.keys(normed).map((name) => ({ name, tensor: normed[name] })))
    for (const k of Object.keys(normed)) normed[k].dispose()
    const l = (value.dataSync() as Float32Array)[0]
    value.dispose()

    const out = final!.dataSync() as Float32Array
    for (let b = 0; b < BATCH; b++) this.pool[idx[b]] = out.slice(b * SIZE * SIZE * CH, (b + 1) * SIZE * SIZE * CH)
    final!.dispose()
    x0.dispose()
    this.trainSteps++
    this.losses.push(l)
    return l
  }

  exportWeights(): Weights {
    return {
      w1: Array.from(this.w1.dataSync()),
      b1: Array.from(this.b1.dataSync()),
      w2: Array.from(this.w2.dataSync()),
    }
  }

  importWeights(w: Weights): void {
    this.w1.assign(tf.tensor4d(w.w1, [1, 1, PERC, HID]))
    this.b1.assign(tf.tensor1d(w.b1))
    this.w2.assign(tf.tensor4d(w.w2, [1, 1, HID, CH]))
  }
}

/** Paint the species' flower as a 32x32 RGBA target (0..1, straight alpha). */
export function flowerTarget(sp: Species): Float32Array {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const B = sp.bloom
  if (!B) return new Float32Array(SIZE * SIZE * 4)
  if (B.kind === 'panicle') {
    ctx.fillStyle = '#c99a8a'
    ctx.beginPath()
    ctx.moveTo(cx, 3)
    ctx.lineTo(cx + 9, SIZE - 4)
    ctx.lineTo(cx - 9, SIZE - 4)
    ctx.closePath()
    ctx.fill()
    for (let i = 0; i < 70; i++) {
      const t = Math.random()
      const w = 1 + t * 8
      ctx.fillStyle = Math.random() < 0.5 ? '#f5e6c0' : '#fff6dc'
      ctx.beginPath()
      ctx.arc(cx + (Math.random() * 2 - 1) * w, 3 + t * (SIZE - 8), 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const n = B.petals
    const len = n >= 9 ? 11 : 10
    const wid = n >= 9 ? 4.2 : 5.2
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(a) * len * 0.55
      const py = cy + Math.sin(a) * len * 0.55
      const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len)
      g.addColorStop(0, B.color)
      g.addColorStop(1, B.outer)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(px, py, len * 0.5, wid * 0.5, a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = B.center
    ctx.beginPath()
    ctx.arc(cx, cy, n >= 9 ? 2.2 : 3, 0, Math.PI * 2)
    ctx.fill()
  }
  const img = ctx.getImageData(0, 0, SIZE, SIZE).data
  const out = new Float32Array(SIZE * SIZE * 4)
  for (let i = 0; i < out.length; i++) out[i] = img[i] / 255
  return out
}

/** Read the visible RGBA of a state into an ImageData (un-premultiplied, clamped). */
export function stateToImage(x: tf.Tensor4D, img: ImageData): void {
  const d = x.dataSync() as Float32Array
  for (let i = 0; i < SIZE * SIZE; i++) {
    const o = i * CH
    const a = Math.min(1, Math.max(0, d[o + 3]))
    const r = Math.min(1, Math.max(0, d[o])) 
    const g = Math.min(1, Math.max(0, d[o + 1]))
    const b = Math.min(1, Math.max(0, d[o + 2]))
    img.data[i * 4] = Math.round((a > 0.001 ? Math.min(1, r / Math.max(a, 1e-3)) : 0) * 255)
    img.data[i * 4 + 1] = Math.round((a > 0.001 ? Math.min(1, g / Math.max(a, 1e-3)) : 0) * 255)
    img.data[i * 4 + 2] = Math.round((a > 0.001 ? Math.min(1, b / Math.max(a, 1e-3)) : 0) * 255)
    img.data[i * 4 + 3] = Math.round(a * 255)
  }
}

/** Hidden channels 4..15 as 12 grayscale tiles in a 4x3 grid, each SIZE px. */
export function hiddenToImage(x: tf.Tensor4D, img: ImageData): void {
  const d = x.dataSync() as Float32Array
  const cols = 4
  for (let ch = 4; ch < CH; ch++) {
    const k = ch - 4
    const ox = (k % cols) * SIZE
    const oy = Math.floor(k / cols) * SIZE
    for (let y = 0; y < SIZE; y++)
      for (let xx = 0; xx < SIZE; xx++) {
        const v = d[((y * SIZE) + xx) * CH + ch]
        const g = Math.round(Math.min(255, Math.max(0, 128 + v * 90)))
        const p = ((oy + y) * (cols * SIZE) + ox + xx) * 4
        img.data[p] = g
        img.data[p + 1] = g
        img.data[p + 2] = g
        img.data[p + 3] = 255
      }
  }
}
