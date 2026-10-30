import * as tf from '@tensorflow/tfjs'
import { NCA, SIZE, CH, flowerTarget, stateToImage, hiddenToImage, type Weights } from './nca'
import { SPECIES, type Species } from './species'
import { seedSvg } from './seeds'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

export interface Lab {
  export(): Weights
  species: () => Species
  choose(id: string): Promise<void>
  trainFor(steps: number, onStep?: (n: number, loss: number) => void): Promise<void>
  save(): Promise<string>
  stats(): { steps: number; loss: number | null; ms: number }
  grow(steps: number): void
}

/** The neural blossom lab: train, watch a flower grow from one cell, wound it, hang it on the tree. */
export async function initLab(onHang: (canvas: HTMLCanvasElement, sp: Species) => void, initial: Species): Promise<Lab> {
  await tf.setBackend('webgl')
  await tf.ready()
  const nca = new NCA()
  let sp = initial
  let state: tf.Tensor4D = nca.seed(1)
  let growing = true
  let training = false
  let stepCount = 0
  let stepsPerFrame = 1
  let loaded: 'none' | 'pretrained' | 'trained' = 'none'
  let lastMs = 0

  const targetC = $<HTMLCanvasElement>('lab-target')
  const growC = $<HTMLCanvasElement>('lab-grow')
  const hiddenC = $<HTMLCanvasElement>('lab-hidden')
  const lossC = $<HTMLCanvasElement>('lab-loss')
  const status = $('lab-status')
  const stepEl = $('lab-step')
  const trainBtn = $<HTMLButtonElement>('lab-train')
  const growImg = new ImageData(SIZE, SIZE)
  const hiddenImg = new ImageData(SIZE * 4, SIZE * 3)

  const drawTarget = () => {
    const t = flowerTarget(sp)
    const img = new ImageData(SIZE, SIZE)
    for (let i = 0; i < t.length; i++) img.data[i] = Math.round(t[i] * 255)
    targetC.getContext('2d')!.putImageData(img, 0, 0)
    nca.setTarget(t)
  }

  const restart = () => {
    state.dispose()
    state = nca.seed(1)
    stepCount = 0
  }

  const setStatus = () => {
    const l = nca.losses.length ? nca.losses[nca.losses.length - 1] : null
    const src = loaded === 'pretrained' ? 'weights we trained' : loaded === 'trained' ? 'weights you trained here' : 'untrained network'
    status.textContent = `${src} · ${nca.trainSteps} training steps${l !== null ? ` · loss ${l.toFixed(4)}` : ''}${lastMs ? ` · ${lastMs.toFixed(0)} ms/step` : ''}`
  }

  const drawLoss = () => {
    const ctx = lossC.getContext('2d')!
    const W = lossC.width
    const H = lossC.height
    ctx.clearRect(0, 0, W, H)
    const L = nca.losses
    if (L.length < 2) return
    const max = Math.max(...L.slice(0, 20), 1e-3)
    ctx.strokeStyle = '#d9a441'
    ctx.lineWidth = 2
    ctx.beginPath()
    L.forEach((v, i) => {
      const x = (i / Math.max(60, L.length - 1)) * W
      const y = H - (Math.log10(v + 1e-5) - Math.log10(1e-5)) / (Math.log10(max + 1e-5) - Math.log10(1e-5)) * H
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  const tryPretrained = async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}weights/${sp.id}.json`)
      if (!r.ok) throw new Error()
      const w = (await r.json()) as Weights
      nca.importWeights(w)
      loaded = 'pretrained'
    } catch {
      loaded = 'none'
    }
    setStatus()
  }

  const chooseSpecies = async (s: Species) => {
    sp = s
    training = false
    trainBtn.textContent = 'Train'
    for (const b of document.querySelectorAll<HTMLButtonElement>('#lab-species button')) b.setAttribute('aria-pressed', String(b.dataset.id === s.id))
    drawTarget()
    nca.w2.assign(tf.zeros(nca.w2.shape))
    nca.w1.assign(tf.randomNormal(nca.w1.shape, 0, Math.sqrt(2 / (CH * 3))))
    nca.b1.assign(tf.zeros(nca.b1.shape))
    await tryPretrained()
    restart()
    drawLoss()
  }

  // Species picker
  const picker = $('lab-species')
  for (const s of SPECIES) {
    const b = document.createElement('button')
    b.className = 'seed'
    b.dataset.id = s.id
    b.innerHTML = `<span class="pit">${seedSvg(s)}</span><span>${s.name}</span>`
    b.addEventListener('click', () => chooseSpecies(s))
    picker.appendChild(b)
  }

  $('lab-regrow').addEventListener('click', () => { restart(); growing = true })
  $('lab-pause').addEventListener('click', (e) => {
    growing = !growing
    ;(e.currentTarget as HTMLButtonElement).textContent = growing ? 'Pause' : 'Play'
  })
  $('lab-speed').addEventListener('click', (e) => {
    stepsPerFrame = stepsPerFrame === 1 ? 4 : 1
    ;(e.currentTarget as HTMLButtonElement).textContent = stepsPerFrame === 1 ? 'Faster' : 'Slower'
  })
  const wound = (cx: number, cy: number, r: number) => {
    const next = tf.tidy(() => {
      const m = tf.buffer([1, SIZE, SIZE, 1])
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) m.set((x - cx) ** 2 + (y - cy) ** 2 < r * r ? 0 : 1, 0, y, x, 0)
      return state.mul(m.toTensor()) as tf.Tensor4D
    })
    state.dispose()
    state = next
  }
  growC.addEventListener('click', (e) => {
    const rect = growC.getBoundingClientRect()
    wound(((e.clientX - rect.left) / rect.width) * SIZE, ((e.clientY - rect.top) / rect.height) * SIZE, 5)
    growing = true
  })
  $('lab-wound').addEventListener('click', () => { wound(10 + Math.random() * 12, 10 + Math.random() * 12, 6); growing = true })
  $('lab-reset').addEventListener('click', () => { loaded = 'none'; chooseSpecies(sp) })
  $('lab-hang').addEventListener('click', () => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const small = document.createElement('canvas')
    small.width = SIZE
    small.height = SIZE
    stateToImage(state, growImg)
    small.getContext('2d')!.putImageData(growImg, 0, 0)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(small, 0, 0, 128, 128)
    onHang(c, sp)
  })

  trainBtn.addEventListener('click', async () => {
    training = !training
    trainBtn.textContent = training ? 'Pause training' : 'Train'
    if (!training) return
    while (training) {
      const t0 = performance.now()
      try {
        await nca.trainStep()
      } catch (err) {
        console.error(err)
        training = false
        trainBtn.textContent = 'Train'
        break
      }
      lastMs = performance.now() - t0
      loaded = 'trained'
      setStatus()
      drawLoss()
      if (nca.trainSteps % 40 === 0) restart()
      await new Promise((r) => setTimeout(r, 0))
    }
  })

  // Growth animation
  const tick = () => {
    if (growing) {
      for (let i = 0; i < stepsPerFrame; i++) {
        const n = nca.step(state)
        state.dispose()
        state = n
        stepCount++
      }
      stateToImage(state, growImg)
      growC.getContext('2d')!.putImageData(growImg, 0, 0)
      hiddenToImage(state, hiddenImg)
      hiddenC.getContext('2d')!.putImageData(hiddenImg, 0, 0)
      stepEl.textContent = `step ${stepCount}`
      if (stepCount > 400 && !training) growing = false
    }
    requestAnimationFrame(tick)
  }

  await chooseSpecies(sp)
  requestAnimationFrame(tick)
  return {
    export: () => nca.exportWeights(),
    species: () => sp,
    choose: (id) => chooseSpecies(SPECIES.find((x) => x.id === id) ?? sp),
    trainFor: async (steps, onStep) => {
      training = false
      trainBtn.textContent = 'Train'
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now()
        const l = nca.trainStepSync()
        lastMs = performance.now() - t0
        loaded = 'trained'
        onStep?.(nca.trainSteps, l)
        if (i % 25 === 24) { setStatus(); drawLoss(); await new Promise((r) => setTimeout(r, 0)) }
      }
      setStatus()
      drawLoss()
    },
    save: async () => {
      const r = await fetch(`/__weights/${sp.id}`, { method: 'POST', body: JSON.stringify(nca.exportWeights()) })
      return r.text()
    },
    stats: () => ({ steps: nca.trainSteps, loss: nca.losses.length ? nca.losses[nca.losses.length - 1] : null, ms: lastMs }),
    grow: (steps) => {
      for (let i = 0; i < steps; i++) {
        const n = nca.step(state)
        state.dispose()
        state = n
        stepCount++
      }
      stateToImage(state, growImg)
      growC.getContext('2d')!.putImageData(growImg, 0, 0)
      hiddenToImage(state, hiddenImg)
      hiddenC.getContext('2d')!.putImageData(hiddenImg, 0, 0)
      stepEl.textContent = `step ${stepCount}`
    },
  }
}
