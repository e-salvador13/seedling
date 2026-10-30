import * as THREE from 'three'
import type { LeafShape, PetalShape, BarkStyle } from './species'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 128, h = w): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Tiny deterministic noise so textures look the same on every load. */
function noise(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface LeafForm { widest: number; base: number; tip: number; serr: number; serrDepth: number; wave: number }
const LEAF_FORMS: Record<LeafShape, LeafForm> = {
  magnolia: { widest: 0.62, base: 0.7, tip: 1.6, serr: 0, serrDepth: 0, wave: 0 },
  mango: { widest: 0.38, base: 0.8, tip: 1.1, serr: 0, serrDepth: 0, wave: 0.03 },
  apple: { widest: 0.5, base: 0.75, tip: 1.3, serr: 30, serrDepth: 0.02, wave: 0 },
  cherry: { widest: 0.42, base: 0.8, tip: 1.05, serr: 26, serrDepth: 0.03, wave: 0 },
  strawberry: { widest: 0.55, base: 0.8, tip: 2.2, serr: 14, serrDepth: 0.06, wave: 0 },
}

/** Half-width of a leaf blade at t along its length (0 base, 1 tip), in units of max half-width. */
function blade(f: LeafForm, t: number): number {
  const w = t < f.widest ? Math.pow(t / f.widest, f.base) : Math.pow((1 - t) / (1 - f.widest), f.tip)
  let r = Math.sin(Math.min(1, Math.max(0, w)) * Math.PI / 2)
  if (f.serr > 0) r -= f.serrDepth * (0.5 + 0.5 * Math.sin(t * f.serr * Math.PI * 2)) * (t > 0.08 && t < 0.97 ? 1 : 0)
  if (f.wave > 0) r += f.wave * Math.sin(t * 30)
  return Math.max(0, r)
}

function drawBlade(ctx: CanvasRenderingContext2D, f: LeafForm, cx: number, y0: number, y1: number, halfW: number, veins: number): void {
  ctx.beginPath()
  const n = 90
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = y0 + (y1 - y0) * t
    const x = cx + blade(f, t) * halfW
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n
    const y = y0 + (y1 - y0) * t
    ctx.lineTo(cx - blade(f, t) * halfW, y)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0)
  g.addColorStop(0, '#dcdcdc')
  g.addColorStop(0.45, '#ffffff')
  g.addColorStop(0.55, '#f4f4f4')
  g.addColorStop(1, '#d6d6d6')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = Math.abs(y1 - y0) * 0.012
  ctx.beginPath()
  ctx.moveTo(cx, y0 + (y1 - y0) * 0.02)
  ctx.lineTo(cx, y0 + (y1 - y0) * 0.96)
  ctx.stroke()
  ctx.lineWidth = Math.abs(y1 - y0) * 0.006
  for (let i = 1; i <= veins; i++) {
    const t = 0.12 + (i / (veins + 1)) * 0.78
    const y = y0 + (y1 - y0) * t
    const w = blade(f, t) * halfW
    ctx.beginPath()
    ctx.moveTo(cx, y)
    ctx.quadraticCurveTo(cx + w * 0.5, y + (y1 - y0) * 0.03, cx + w * 0.92, y + (y1 - y0) * 0.09)
    ctx.moveTo(cx, y)
    ctx.quadraticCurveTo(cx - w * 0.5, y + (y1 - y0) * 0.03, cx - w * 0.92, y + (y1 - y0) * 0.09)
    ctx.stroke()
  }
}

/** Leaf silhouette with midrib and veins, white so the instance colour tints it. Portrait: base at the bottom. */
export function leafTexture(shape: LeafShape): THREE.Texture {
  const f = LEAF_FORMS[shape]
  return canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    if (shape === 'strawberry') {
      ctx.strokeStyle = '#cfcfcf'
      ctx.lineWidth = w * 0.035
      ctx.beginPath()
      ctx.moveTo(w * 0.5, h)
      ctx.lineTo(w * 0.5, h * 0.52)
      ctx.stroke()
      const leaflet = (cx: number, cy: number, rot: number, len: number) => {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        drawBlade(ctx, f, 0, 0, -len, len * 0.42, 5)
        ctx.restore()
      }
      leaflet(w * 0.5, h * 0.55, 0, h * 0.5)
      leaflet(w * 0.5, h * 0.58, -0.95, h * 0.46)
      leaflet(w * 0.5, h * 0.58, 0.95, h * 0.46)
      return
    }
    drawBlade(ctx, f, w / 2, h * 0.99, h * 0.01, w * 0.49, shape === 'mango' ? 14 : 7)
  }, 128, 256)
}

/** Single petal, white with a soft base blush, portrait with the base at the bottom. */
export function petalTexture(shape: PetalShape): THREE.Texture {
  return canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.beginPath()
    const n = 80
    const r = (t: number) => {
      if (shape === 'tepal') return Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.9 + 0.05 * Math.sin(t * Math.PI)
      const base = t < 0.55 ? Math.pow(t / 0.55, 0.65) : Math.pow((1 - t) / 0.45, 0.55)
      let v = Math.sin(base * Math.PI / 2)
      if (shape === 'notched' && t > 0.86) v *= 1 - Math.max(0, (t - 0.86) / 0.14) * 0.35
      return v
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const y = h - t * h
      let x = w / 2 + r(t) * w * 0.48
      if (shape === 'notched' && t > 0.92) x = w / 2 + r(t) * w * 0.48 * (1 - (t - 0.92) / 0.08 * 0.5)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    if (shape === 'notched') ctx.lineTo(w / 2, h * 0.07)
    for (let i = n; i >= 0; i--) {
      const t = i / n
      const y = h - t * h
      let x = w / 2 - r(t) * w * 0.48
      if (shape === 'notched' && t > 0.92) x = w / 2 - r(t) * w * 0.48 * (1 - (t - 0.92) / 0.08 * 0.5)
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    const g = ctx.createLinearGradient(0, h, 0, 0)
    g.addColorStop(0, '#e9d2d8')
    g.addColorStop(0.3, '#fafafa')
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(120,60,80,0.10)'
    ctx.lineWidth = w * 0.015
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(w / 2, h)
      ctx.quadraticCurveTo(w / 2 + i * w * 0.1, h * 0.5, w / 2 + i * w * 0.16, h * 0.15)
      ctx.stroke()
    }
  }, 96, 192)
}

/** Flower center: a ring of stamens around a disc. Tinted by instance colour. */
export function stamenTexture(): THREE.Texture {
  const rnd = noise(9)
  return canvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const cx = s / 2
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cx, s * 0.2, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2
      const r = s * (0.22 + rnd() * 0.2)
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = s * 0.02
      ctx.beginPath()
      ctx.moveTo(cx, cx)
      ctx.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, s * 0.035, 0, Math.PI * 2)
      ctx.fill()
    }
  }, 64)
}

/** Mango panicle: a haze of tiny pale flowers on reddish stems. */
export function panicleTexture(): THREE.Texture {
  const rnd = noise(13)
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = '#c99a8a'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#f5e6c0' : '#fff6dc'
      ctx.beginPath()
      ctx.arc(rnd() * s, rnd() * s, 1 + rnd() * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, 64)
}

/** Bark in three styles, light so the material and instance colours tint it. */
export function barkTexture(style: BarkStyle): THREE.Texture {
  const rnd = noise(7)
  const tex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#d8cdbd'
    ctx.fillRect(0, 0, s, s)
    if (style === 'fissured') {
      for (let i = 0; i < 90; i++) {
        const x = rnd() * s
        const w = 2 + rnd() * 9
        const g = ctx.createLinearGradient(x, 0, x + w, 0)
        const d = 0.08 + rnd() * 0.22
        g.addColorStop(0, 'rgba(40,25,10,0)')
        g.addColorStop(0.5, `rgba(40,25,10,${d})`)
        g.addColorStop(1, 'rgba(40,25,10,0)')
        ctx.fillStyle = g
        ctx.fillRect(x, 0, w, s)
      }
      for (let i = 0; i < 160; i++) {
        const x = rnd() * s
        const y = rnd() * s
        const h = 10 + rnd() * 60
        ctx.fillStyle = `rgba(30,18,8,${0.15 + rnd() * 0.35})`
        ctx.fillRect(x, y, 1 + rnd() * 2, h)
        ctx.fillStyle = `rgba(255,245,225,${rnd() * 0.18})`
        ctx.fillRect(x + 3, y, 1, h * 0.7)
      }
    } else if (style === 'smooth') {
      for (let i = 0; i < 40; i++) {
        const x = rnd() * s
        const w = 10 + rnd() * 30
        const g = ctx.createLinearGradient(x, 0, x + w, 0)
        g.addColorStop(0, 'rgba(60,50,40,0)')
        g.addColorStop(0.5, `rgba(60,50,40,${0.04 + rnd() * 0.08})`)
        g.addColorStop(1, 'rgba(60,50,40,0)')
        ctx.fillStyle = g
        ctx.fillRect(x, 0, w, s)
      }
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.12})`
        ctx.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2)
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, s, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.05)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.08)')
      g.addColorStop(1, 'rgba(0,0,0,0.05)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      for (let i = 0; i < 70; i++) {
        const y = rnd() * s
        const w = 8 + rnd() * 30
        ctx.fillStyle = `rgba(70,45,30,${0.25 + rnd() * 0.35})`
        ctx.fillRect(rnd() * s, y, w, 1.5 + rnd() * 1.5)
        ctx.fillStyle = `rgba(255,240,220,${0.15 + rnd() * 0.2})`
        ctx.fillRect(rnd() * s, y + 2, w * 0.7, 1)
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(20,10,5,${0.06 + rnd() * 0.1})`
        ctx.fillRect(0, rnd() * s, s, 1)
      }
    }
  }, 256)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 3)
  return tex
}

export function fruitTexture(shape: 'apple' | 'mango' | 'strawberry'): THREE.Texture {
  const rnd = noise(11)
  const tex = canvasTexture((ctx, s) => {
    if (shape === 'strawberry') {
      ctx.fillStyle = '#d8302b'
      ctx.fillRect(0, 0, s, s)
      const g = ctx.createLinearGradient(0, s, 0, 0)
      g.addColorStop(0, 'rgba(255,120,90,0.35)')
      g.addColorStop(1, 'rgba(120,10,10,0.25)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 7; x++) {
          const px = (x + (y % 2) * 0.5) * (s / 7)
          const py = y * (s / 9) + s * 0.05
          ctx.fillStyle = 'rgba(60,10,10,0.55)'
          ctx.beginPath()
          ctx.ellipse(px, py + 1.5, s * 0.03, s * 0.045, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#f2d36b'
          ctx.beginPath()
          ctx.ellipse(px, py, s * 0.025, s * 0.038, 0, 0, Math.PI * 2)
          ctx.fill()
        }
    } else if (shape === 'mango') {
      const g = ctx.createLinearGradient(0, s, 0, 0)
      g.addColorStop(0, '#f0a93a')
      g.addColorStop(0.45, '#e9b43c')
      g.addColorStop(0.8, '#b7b53a')
      g.addColorStop(1, '#7f9a3a')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      const blush = ctx.createRadialGradient(s * 0.3, s * 0.65, 0, s * 0.3, s * 0.65, s * 0.45)
      blush.addColorStop(0, 'rgba(210,70,40,0.55)')
      blush.addColorStop(1, 'rgba(210,70,40,0)')
      ctx.fillStyle = blush
      ctx.fillRect(0, 0, s, s)
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(90,60,20,${rnd() * 0.25})`
        ctx.fillRect(rnd() * s, rnd() * s, 1, 1)
      }
    } else {
      const g = ctx.createLinearGradient(0, s, 0, 0)
      g.addColorStop(0, '#b8261f')
      g.addColorStop(0.6, '#d3382c')
      g.addColorStop(1, '#c9492a')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      for (let i = 0; i < 60; i++) {
        const x = rnd() * s
        ctx.fillStyle = `rgba(240,200,80,${0.08 + rnd() * 0.18})`
        ctx.fillRect(x, 0, 1 + rnd() * 3, s)
      }
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(255,230,180,${rnd() * 0.3})`
        ctx.fillRect(rnd() * s, rnd() * s, 1, 1)
      }
    }
  })
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

/** Grass ground: mottled greens with faint darker patches, tiled. */
export function groundTexture(): THREE.Texture {
  const rnd = noise(3)
  const tex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#8fa36a'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 1400; i++) {
      const r = 6 + rnd() * 26
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      const dark = rnd() < 0.5
      g.addColorStop(0, dark ? `rgba(70,90,45,${0.1 + rnd() * 0.2})` : `rgba(180,195,120,${0.08 + rnd() * 0.16})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.save()
      ctx.translate(rnd() * s, rnd() * s)
      ctx.fillStyle = g
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.restore()
    }
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(40,60,30,${rnd() * 0.3})`
      ctx.fillRect(rnd() * s, rnd() * s, 1, 1 + rnd() * 3)
    }
  }, 512)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(14, 14)
  return tex
}

/** Dark, crumbly soil: fine grain, a few pale grits. Tiled small. */
export function soilTexture(): THREE.Texture {
  const rnd = noise(5)
  const tex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#4a382b'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 9000; i++) {
      const r = 0.6 + rnd() * 1.6
      const light = rnd() < 0.35
      ctx.fillStyle = light ? `rgba(130,105,78,${0.1 + rnd() * 0.25})` : `rgba(18,10,5,${0.15 + rnd() * 0.35})`
      ctx.beginPath()
      ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(165,150,125,${0.35 + rnd() * 0.3})`
      ctx.beginPath()
      ctx.ellipse(rnd() * s, rnd() * s, 1 + rnd() * 2, 0.8 + rnd() * 1.4, rnd() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, 256)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

/** Grass blade: narrow, slightly translucent tip. Tinted per instance. */
export function grassTexture(): THREE.Texture {
  return canvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const g = ctx.createLinearGradient(0, s, 0, 0)
    g.addColorStop(0, '#b9b9b9')
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(s * 0.35, s)
    ctx.quadraticCurveTo(s * 0.42, s * 0.4, s * 0.5, 0)
    ctx.quadraticCurveTo(s * 0.58, s * 0.4, s * 0.65, s)
    ctx.fill()
  }, 64)
}

/** Soft cumulus blob for distant cloud sprites. */
export function cloudTexture(seed: number): THREE.Texture {
  const rnd = noise(seed)
  return canvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    for (let i = 0; i < 14; i++) {
      const x = s * (0.25 + rnd() * 0.5)
      const y = s * (0.4 + rnd() * 0.3)
      const r = s * (0.1 + rnd() * 0.16)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.7, 'rgba(255,255,255,0.18)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }, 256)
}
