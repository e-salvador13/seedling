export type SeedShape = 'kidney' | 'oval' | 'teardrop' | 'round' | 'speck'
export type LeafShape = 'magnolia' | 'mango' | 'apple' | 'cherry' | 'strawberry'
export type PetalShape = 'notched' | 'round' | 'tepal'
export type BarkStyle = 'fissured' | 'smooth' | 'lenticel'

export interface Species {
  id: string
  name: string
  latin: string
  blurb: string
  days: number
  trunkHeight: number
  crown: { rx: number; ry: number; rz: number; lift: number; shape: 'ellipsoid' | 'dome' | 'flat' }
  attractors: number
  influence: number
  kill: number
  step: number
  growthPerDay: number
  upBias: number
  radiusK: number
  maxRadius: number
  bark: string
  barkStyle: BarkStyle
  leaf: {
    shape: LeafShape
    size: number
    aspect: number
    cup: number
    droop: number
    gloss: number
    young: string
    color: string
    color2: string
    autumn: [string, string, string] | null
    dropStart: number | null
    density: number
    start?: number
    pairs?: boolean
  }
  bloom: {
    kind: 'petal' | 'panicle'
    petalShape: PetalShape
    petals: number
    tilt: number
    length: number
    width: number
    cup: number
    color: string
    outer: string
    bud: string
    center: string
    centerSize: number
    axisUp: number
    cluster: number
    start: number
    end: number
    life: number
    density: number
    budDays?: number
  } | null
  fruit: { color: string; start: number; ripenDays: number; size: number; density: number; shape: 'apple' | 'mango' | 'strawberry'; stalk: number } | null
  calendar: { growEnd: number; winter: { dropStart: number; start: number; end: number } | null }
  seed: { shape: SeedShape; color: string; size: number; label: string }
  facts: { habit: string; leaves: string; flowers: string; fruit: string }
}

export const SPECIES: Species[] = [
  {
    id: 'magnolia',
    name: 'Magnolia',
    latin: 'Magnolia × soulangeana',
    blurb: 'Saucer magnolia. Goblets of nine tepals, rosy outside and white within, open on bare silver-gray wood before a single leaf.',
    days: 440,
    trunkHeight: 0.6,
    crown: { rx: 2.9, ry: 1.7, rz: 2.9, lift: 0.2, shape: 'ellipsoid' },
    attractors: 720,
    influence: 1.1,
    kill: 0.26,
    step: 0.13,
    growthPerDay: 9,
    upBias: 0.12,
    radiusK: 0.0105,
    maxRadius: 0.16,
    bark: '#9a9a92',
    barkStyle: 'smooth',
    leaf: { shape: 'magnolia', size: 0.2, aspect: 0.52, cup: 0.12, droop: 0.22, gloss: 0.5, young: '#9a7a52', color: '#3d6a2a', color2: '#557f36', autumn: ['#c9b24a', '#a9783a', '#6e4e2c'], dropStart: 395, density: 0.95, start: 250, pairs: true },
    bloom: {
      kind: 'petal', petalShape: 'tepal', petals: 9, tilt: 0.38, length: 0.15, width: 0.08, cup: 0.5,
      color: '#fcf3f6', outer: '#d279a7', bud: '#8c7f74', center: '#e8d8a0', centerSize: 0.022, axisUp: 0.92, cluster: 1,
      start: 228, end: 258, life: 13, density: 0.6, budDays: 36,
    },
    fruit: null,
    calendar: { growEnd: 150, winter: { dropStart: 160, start: 192, end: 224 } },
    seed: { shape: 'kidney', color: '#d2452f', size: 14, label: 'A red seed, 5 to 9 mm, hanging from a knobby cone' },
    facts: {
      habit: 'Multi-stemmed, low-branched, 4.5 to 10 m tall and nearly as wide. Smooth silver-gray bark.',
      leaves: 'Obovate, 8 to 18 cm, entire margin. Emerge reddish-bronze just after the flowers, go dull yellow-brown in autumn.',
      flowers: 'Nine tepals, 12 to 25 cm across, goblet opening to saucer. White inside, pink-purple outside. About two weeks.',
      fruit: 'A knobby cone of follicles that splits to drop red seeds on silk threads. Few most years.',
    },
  },
  {
    id: 'mango',
    name: 'Mango',
    latin: 'Mangifera indica',
    blurb: 'A broad evergreen dome. New leaves flush coppery and hang limp before they green; fruit swings on long cords.',
    days: 360,
    trunkHeight: 1.5,
    crown: { rx: 2.5, ry: 2.3, rz: 2.5, lift: 0.3, shape: 'ellipsoid' },
    attractors: 800,
    influence: 1.0,
    kill: 0.25,
    step: 0.13,
    growthPerDay: 10,
    upBias: 0.3,
    radiusK: 0.011,
    maxRadius: 0.2,
    bark: '#4f4740',
    barkStyle: 'fissured',
    leaf: { shape: 'mango', size: 0.28, aspect: 0.24, cup: 0.06, droop: 0.5, gloss: 0.35, young: '#a0503a', color: '#28522a', color2: '#3f7334', autumn: null, dropStart: null, density: 1, pairs: true },
    bloom: {
      kind: 'panicle', petalShape: 'round', petals: 0, tilt: 0, length: 0.42, width: 0.24, cup: 0,
      color: '#f1e2b4', outer: '#e9c9a0', bud: '#d9b48a', center: '#d9a441', centerSize: 0, axisUp: 1, cluster: 1,
      start: 200, end: 240, life: 30, density: 0.45,
    },
    fruit: { color: '#e9a23a', start: 238, ripenDays: 105, size: 0.2, density: 0.22, shape: 'mango', stalk: 0.3 },
    calendar: { growEnd: 185, winter: null },
    seed: { shape: 'oval', color: '#d7c7a1', size: 22, label: 'A flat, fibrous stone, 4 to 7 cm' },
    facts: {
      habit: 'Evergreen, 10 to 30 m, rounded dome. Gray-brown bark, smooth when young, scaly with age.',
      leaves: 'Lanceolate, 10 to 32 cm, leathery and glossy. Flushes emerge coppery-red and limp, then harden dark green.',
      flowers: 'Pyramidal panicles 6 to 40 cm with hundreds of 5 mm cream flowers on reddish stems, 20 to 46 days.',
      fruit: 'A drupe, 6 to 25 cm, on a long pendulous stalk. Green to yellow-orange with a blush, 13 to 20 weeks after bloom.',
    },
  },
  {
    id: 'apple',
    name: 'Apple',
    latin: 'Malus domestica',
    blurb: 'Pink buds open with the leaves to white five-petal flowers, five to a cluster with a king bloom in the middle.',
    days: 450,
    trunkHeight: 1.0,
    crown: { rx: 2.3, ry: 1.9, rz: 2.3, lift: 0.1, shape: 'ellipsoid' },
    attractors: 700,
    influence: 1.0,
    kill: 0.25,
    step: 0.12,
    growthPerDay: 9,
    upBias: 0.15,
    radiusK: 0.0105,
    maxRadius: 0.17,
    bark: '#7a6a5c',
    barkStyle: 'fissured',
    leaf: { shape: 'apple', size: 0.13, aspect: 0.58, cup: 0.18, droop: 0.2, gloss: 0.7, young: '#a8c966', color: '#467a2c', color2: '#62953c', autumn: ['#d8c54a', '#c6a23a', '#8c6a34'], dropStart: 402, density: 0.95, start: 232, pairs: true },
    bloom: {
      kind: 'petal', petalShape: 'round', petals: 5, tilt: 1.15, length: 0.058, width: 0.046, cup: 0.35,
      color: '#fdf7f8', outer: '#f0a9bf', bud: '#e0628a', center: '#f0c84a', centerSize: 0.015, axisUp: 0.55, cluster: 8,
      start: 236, end: 254, life: 9, density: 0.65,
    },
    fruit: { color: '#c8322e', start: 252, ripenDays: 115, size: 0.08, density: 0.3, shape: 'apple', stalk: 0.025 },
    calendar: { growEnd: 150, winter: { dropStart: 165, start: 196, end: 230 } },
    seed: { shape: 'teardrop', color: '#4a2e1c', size: 10, label: 'A glossy brown pip, 6 to 8 mm' },
    facts: {
      habit: 'Rounded, dense, 4.5 to 9 m on its own roots. Smooth gray bark with lenticels, flaking into plates with age.',
      leaves: 'Elliptic, 7.5 to 15 cm, serrated, downy and pale beneath. Yellow in autumn, dropping late.',
      flowers: 'Clusters of 5, the king bloom first. Deep pink buds open rose and fade to white, 3 to 4 cm. About 10 days.',
      fruit: 'A pome on a short spur, green and fuzzy at set, ripe about 143 days after bloom.',
    },
  },
  {
    id: 'cherry',
    name: 'Cherry blossom',
    latin: 'Prunus × yedoensis',
    blurb: 'Yoshino cherry. Pink buds open pale and turn white on bare mahogany wood, then let go all at once in a petal snow.',
    days: 430,
    trunkHeight: 1.3,
    crown: { rx: 2.9, ry: 1.6, rz: 2.9, lift: 0.1, shape: 'dome' },
    attractors: 760,
    influence: 1.1,
    kill: 0.26,
    step: 0.13,
    growthPerDay: 9,
    upBias: 0.02,
    radiusK: 0.0095,
    maxRadius: 0.15,
    bark: '#6b4034',
    barkStyle: 'lenticel',
    leaf: { shape: 'cherry', size: 0.12, aspect: 0.5, cup: 0.1, droop: 0.3, gloss: 0.55, young: '#9c6a3e', color: '#497a30', color2: '#6a9a45', autumn: ['#d9c04a', '#d08a2e', '#a0522a'], dropStart: 388, density: 0.95, start: 240, pairs: true },
    bloom: {
      kind: 'petal', petalShape: 'notched', petals: 5, tilt: 1.05, length: 0.06, width: 0.047, cup: 0.3,
      color: '#fdf3f6', outer: '#f2bfd2', bud: '#e38fae', center: '#e4b24a', centerSize: 0.015, axisUp: -0.3, cluster: 8,
      start: 224, end: 244, life: 10, density: 0.95,
    },
    fruit: null,
    calendar: { growEnd: 150, winter: { dropStart: 160, start: 192, end: 222 } },
    seed: { shape: 'round', color: '#8a5a3c', size: 12, label: 'A small tan stone, 5 to 7 mm' },
    facts: {
      habit: 'Broad and arching, 5 to 12 m, wider than tall. Glossy reddish-brown bark banded with horizontal lenticels.',
      leaves: 'Ovate, 6 to 15 cm, sharply serrated. Bronze-tinged when new, gold-yellow in autumn.',
      flowers: 'Before the leaves. Single, 5 notched petals, 3 cm, pink in bud opening to white, clusters of 5 or 6. Peak lasts days.',
      fruit: 'Tiny black drupes in summer, for the birds.',
    },
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    latin: 'Fragaria × ananassa',
    blurb: 'A low rosette of three-part leaves. White flowers with a yellow eye on short trusses, then berries that ripen on the soil.',
    days: 200,
    trunkHeight: 0.02,
    crown: { rx: 0.6, ry: 0.16, rz: 0.6, lift: 0.0, shape: 'flat' },
    attractors: 260,
    influence: 0.32,
    kill: 0.07,
    step: 0.035,
    growthPerDay: 6,
    upBias: 0.08,
    radiusK: 0.0035,
    maxRadius: 0.012,
    bark: '#6d8a3a',
    barkStyle: 'smooth',
    leaf: { shape: 'strawberry', size: 0.12, aspect: 0.95, cup: 0.1, droop: 0.15, gloss: 0.55, young: '#9ec45a', color: '#2f6a2b', color2: '#4b8c3b', autumn: ['#b8a23a', '#b23a2c', '#6e1f24'], dropStart: null, density: 1 },
    bloom: {
      kind: 'petal', petalShape: 'round', petals: 5, tilt: 1.35, length: 0.022, width: 0.019, cup: 0.15,
      color: '#ffffff', outer: '#f6f2ea', bud: '#a9c27a', center: '#f0c43a', centerSize: 0.011, axisUp: 0.85, cluster: 2,
      start: 70, end: 140, life: 5, density: 0.5,
    },
    fruit: { color: '#d8302b', start: 78, ripenDays: 30, size: 0.05, density: 0.45, shape: 'strawberry', stalk: 0.0 },
    calendar: { growEnd: 120, winter: null },
    seed: { shape: 'speck', color: '#c9a53c', size: 6, label: 'An achene, 1 mm, from the skin of a berry' },
    facts: {
      habit: 'Rosette 15 to 30 cm tall from a short crown at the soil line. Runners walk outward after fruiting.',
      leaves: 'Trifoliate on long petioles, leaflets 2.5 to 7.5 cm, coarsely toothed. Old leaves turn maroon in cold.',
      flowers: 'Trusses open primary first, then secondary and tertiary. Five white petals, 2.6 to 4 cm, yellow center.',
      fruit: 'A swollen receptacle studded with achenes. Green to white to pink to red in about 30 days.',
    },
  },
]

export function speciesById(id: string | null): Species {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0]
}
