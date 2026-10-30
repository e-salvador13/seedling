import { Scene } from './scene'
import { Tree3D } from './tree3d'
import { simulate, phaseAt, type Lifecycle } from './growth'
import { SPECIES, speciesById, type Species } from './species'
import { seedSvg } from './seeds'
import { randomSeed } from './rng'
import { initExplainer } from './explainer'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const canvas = $<HTMLCanvasElement>('view')
const scene = new Scene(canvas)

const params = new URLSearchParams(location.search)
let species: Species = speciesById(params.get('s'))
let seed = Number(params.get('seed')) || randomSeed()
let life: Lifecycle
let tree: Tree3D | null = null
let day = 0
let playing = true
let speed = 8
let showMotes = true
let showRoots = false
let dropping = false

const scrub = $<HTMLInputElement>('scrub')
const dayEl = $('day')
const phaseEl = $('phase')
const latinEl = $('latin')
const playBtn = $('play')
const dropEl = $('drop')

function writeUrl(): void {
  const u = new URL(location.href)
  u.searchParams.set('s', species.id)
  u.searchParams.set('seed', String(seed))
  history.replaceState(null, '', u)
}

function plant(sp: Species, s: number, animate = true): void {
  species = sp
  seed = s
  if (tree) {
    scene.scene.remove(tree.group)
    tree.dispose()
  }
  life = simulate(sp, s)
  tree = new Tree3D(life)
  tree.showMotes = showMotes
  scene.scene.add(tree.group)
  day = 0
  scrub.max = String(sp.days)
  scrub.value = '0'
  latinEl.textContent = sp.latin
  for (const b of document.querySelectorAll<HTMLButtonElement>('.seed')) b.setAttribute('aria-pressed', String(b.dataset.id === sp.id))
  writeUrl()
  playing = true
  setPlayIcon()
  tree.update(0, 0, 1, showRoots)
  scene.frame(tree.focusHeight(), tree.top)
  scene.snap()
  if (animate) {
    dropping = true
    dropEl.innerHTML = seedSvg(sp)
    dropEl.classList.remove('go')
    void dropEl.offsetWidth
    dropEl.classList.add('go')
    setTimeout(() => { dropping = false }, 820)
  }
}

function setPlayIcon(): void {
  playBtn.innerHTML = playing ? '<span class="ico-pause"></span>' : '<span class="ico-play"></span>'
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play')
}

// Seed shelf
const shelf = $('shelf')
for (const sp of SPECIES) {
  const b = document.createElement('button')
  b.className = 'seed'
  b.dataset.id = sp.id
  b.setAttribute('aria-pressed', String(sp.id === species.id))
  b.title = sp.seed.label
  b.innerHTML = `<span class="pit">${seedSvg(sp)}</span><span>${sp.name}</span>`
  b.addEventListener('click', () => plant(sp, randomSeed()))
  shelf.appendChild(b)
}

playBtn.addEventListener('click', () => {
  if (day >= species.days) day = 0
  playing = !playing
  setPlayIcon()
})
scrub.addEventListener('input', () => {
  day = Number(scrub.value)
})
for (const b of document.querySelectorAll<HTMLButtonElement>('.speeds button')) {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed)
    for (const o of document.querySelectorAll('.speeds button')) o.classList.toggle('on', o === b)
  })
}
$('reroll').addEventListener('click', () => plant(species, randomSeed()))
const motesBtn = $('motes')
motesBtn.addEventListener('click', () => {
  showMotes = !showMotes
  if (tree) tree.showMotes = showMotes
  motesBtn.textContent = showMotes ? 'Hide the light' : 'Show the light'
  motesBtn.setAttribute('aria-pressed', String(showMotes))
})
const rootsBtn = $('roots')
rootsBtn.addEventListener('click', () => {
  showRoots = !showRoots
  scene.setRoots(showRoots)
  rootsBtn.textContent = showRoots ? 'Hide roots' : 'Show roots'
  rootsBtn.setAttribute('aria-pressed', String(showRoots))
})
const toast = document.createElement('div')
toast.className = 'toast'
toast.textContent = 'Link copied'
$('hero').appendChild(toast)
$('share').addEventListener('click', async () => {
  writeUrl()
  try {
    await navigator.clipboard.writeText(location.href)
    toast.classList.add('show')
    setTimeout(() => toast.classList.remove('show'), 1600)
  } catch {
    prompt('Copy this link', location.href)
  }
})
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault()
    playBtn.click()
  }
})

// Species cards
const cards = $('cards')
for (const sp of SPECIES) {
  const c = document.createElement('article')
  c.className = 'card'
  c.innerHTML = `<div class="pit">${seedSvg(sp)}</div><h3>${sp.name}</h3><span class="lat">${sp.latin}</span><p>${sp.blurb}</p>
    <dl class="facts"><dt>Habit</dt><dd>${sp.facts.habit}</dd><dt>Leaves</dt><dd>${sp.facts.leaves}</dd><dt>Flowers</dt><dd>${sp.facts.flowers}</dd><dt>Fruit</dt><dd>${sp.facts.fruit}</dd></dl>
    <button class="ghost dark">Plant one</button>`
  c.querySelector('button')!.addEventListener('click', () => {
    plant(sp, randomSeed())
    document.getElementById('hero')!.scrollIntoView({ behavior: 'smooth' })
  })
  cards.appendChild(c)
}

// Main loop
let last = performance.now()
function frame(now: number): void {
  const raw = (now - last) / 1000
  const dt = Math.min(0.05, raw)
  last = now
  if (playing && !dropping) {
    day += speed * dt
    if (day >= species.days) {
      day = species.days
      playing = false
      setPlayIcon()
    }
    scrub.value = String(day)
  }
  if (tree) {
    tree.update(day, now / 1000, 1, showRoots)
    scene.frame(tree.focusHeight(), tree.top)
    scene.season(day / species.days)
  }
  dayEl.textContent = `DAY ${String(Math.floor(day)).padStart(3, '0')}`
  phaseEl.textContent = phaseAt(species, day)
  scene.render(Math.min(1, raw), now / 1000)
  requestAnimationFrame(frame)
}

plant(species, seed, true)
;(window as any).seedling = { get tree() { return tree }, get day() { return day }, get life() { return life }, scene }
initExplainer()
requestAnimationFrame(frame)
