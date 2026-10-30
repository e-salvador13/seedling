import * as THREE from 'three'
import type { Lifecycle, GNode } from './growth'
import { subtreeSizes, vigor } from './growth'
import { leafTexture, petalTexture, stamenTexture, panicleTexture, barkTexture, fruitTexture } from './textures'

const MAX = 7000
const MAX_PETALS = 40000
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _qF = new THREE.Quaternion()
const _qK = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _dir = new THREE.Vector3()
const _tip = new THREE.Vector3()
const _c = new THREE.Color()
const _c2 = new THREE.Color()
const _c3 = new THREE.Color()
const _e = new THREE.Euler()

const GROUND = 0.02

function lathe(points: [number, number][]): THREE.LatheGeometry {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 18)
}

const FRUIT_PROFILES: Record<'apple' | 'mango' | 'strawberry', [number, number][]> = {
  apple: [[0, 0.06], [0.22, 0.0], [0.42, 0.12], [0.5, 0.42], [0.47, 0.75], [0.36, 0.95], [0.2, 1.0], [0.1, 0.93], [0, 0.9]],
  mango: [[0, 0.0], [0.26, 0.05], [0.42, 0.22], [0.47, 0.48], [0.42, 0.74], [0.28, 0.92], [0.12, 1.0], [0, 1.0]],
  strawberry: [[0, 0.0], [0.1, 0.08], [0.26, 0.3], [0.4, 0.55], [0.47, 0.78], [0.44, 0.95], [0.3, 1.0], [0, 1.0]],
}

/** A unit blade (width 1, length `len`) with its base at the origin, cupped across and drooping along its length. */
function bladeGeometry(len: number, cup: number, droop: number, segW = 3, segL = 6): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, len, segW, segL)
  g.translate(0, len / 2, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const t = pos.getY(i) / len
    pos.setZ(i, cup * (2 * x) * (2 * x) * 0.5 * len - droop * t * t * len)
  }
  g.computeVertexNormals()
  return g
}

/** Instanced renderer for one lifecycle. Call update(day, t, wind, showRoots) each frame. */
export class Tree3D {
  group = new THREE.Group()
  private branches: THREE.InstancedMesh
  private joints: THREE.InstancedMesh
  private roots: THREE.InstancedMesh
  private leaves: THREE.InstancedMesh
  private petals: THREE.InstancedMesh | null = null
  private centers: THREE.InstancedMesh | null = null
  private buds: THREE.InstancedMesh | null = null
  private panicles: THREE.InstancedMesh | null = null
  private fruit: THREE.InstancedMesh | null = null
  private stalks: THREE.InstancedMesh | null = null
  private calyx: THREE.InstancedMesh | null = null
  private flare: THREE.Mesh
  private seedMesh: THREE.Mesh
  private motes: THREE.Points
  private moteAlpha: Float32Array
  private sizes: Int32Array
  private rootSizes: Int32Array
  private life: Lifecycle
  showMotes = true
  /** Highest visible point after the last update, for camera framing. */
  top = 0

  constructor(life: Lifecycle) {
    this.life = life
    const sp = life.species
    this.sizes = new Int32Array(life.nodes.length)
    this.rootSizes = new Int32Array(life.roots.length)

    const bark = barkTexture(sp.barkStyle)
    const barkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: sp.barkStyle === 'fissured' ? 0.95 : 0.7, map: bark })
    const cyl = new THREE.CylinderGeometry(0.84, 1, 1, 8, 1, false)
    cyl.translate(0, 0.5, 0)
    this.branches = new THREE.InstancedMesh(cyl, barkMat, MAX)
    this.branches.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3)
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), barkMat, MAX)
    this.joints.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3)
    for (const m of [this.branches, this.joints]) {
      m.castShadow = true
      m.receiveShadow = true
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }
    const rootMat = new THREE.MeshStandardMaterial({ color: '#d2c1a0', roughness: 1 })
    this.roots = new THREE.InstancedMesh(cyl, rootMat, MAX)
    this.roots.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.roots.visible = false

    const flareGeo = new THREE.ConeGeometry(1, 1, 10, 1, true)
    flareGeo.translate(0, 0.5, 0)
    this.flare = new THREE.Mesh(flareGeo, new THREE.MeshStandardMaterial({ color: sp.bark, roughness: 1, map: bark }))
    this.flare.castShadow = true
    this.flare.receiveShadow = true

    const leafGeo = bladeGeometry(1 / sp.leaf.aspect, sp.leaf.cup, sp.leaf.droop)
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTexture(sp.leaf.shape), alphaTest: 0.5, side: THREE.DoubleSide, roughness: sp.leaf.gloss, color: '#ffffff',
    })
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMat, MAX)
    this.leaves.castShadow = true
    this.leaves.receiveShadow = true
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3)

    if (sp.bloom && sp.bloom.kind === 'petal') {
      const b = sp.bloom
      const petalGeo = bladeGeometry(1, b.cup, -0.25, 2, 3)
      const petalMat = new THREE.MeshStandardMaterial({
        map: petalTexture(b.petalShape), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55, color: '#ffffff',
        emissive: b.outer, emissiveIntensity: 0.12,
      })
      this.petals = new THREE.InstancedMesh(petalGeo, petalMat, MAX_PETALS)
      this.petals.castShadow = false
      this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.petals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PETALS * 3), 3)
      const centerMat = new THREE.MeshStandardMaterial({ map: stamenTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, color: b.center })
      this.centers = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7), centerMat, 9000)
      this.centers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.buds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: b.bud, roughness: 0.7 }), 9000)
      this.buds.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    } else if (sp.bloom && sp.bloom.kind === 'panicle') {
      const cone = new THREE.ConeGeometry(0.42, 1, 9, 1)
      cone.translate(0, 0.5, 0)
      const mat = new THREE.MeshStandardMaterial({ map: panicleTexture(), roughness: 0.8, color: '#ffffff', emissive: '#f3e3b8', emissiveIntensity: 0.25 })
      this.panicles = new THREE.InstancedMesh(cone, mat, 3000)
      this.panicles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }

    if (sp.fruit) {
      const geo = lathe(FRUIT_PROFILES[sp.fruit.shape])
      const mat = new THREE.MeshStandardMaterial({ map: fruitTexture(sp.fruit.shape), roughness: sp.fruit.shape === 'strawberry' ? 0.55 : 0.4, color: '#ffffff' })
      this.fruit = new THREE.InstancedMesh(geo, mat, 2000)
      this.fruit.castShadow = true
      this.fruit.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.fruit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3)
      this.stalks = new THREE.InstancedMesh(cyl, new THREE.MeshStandardMaterial({ color: '#6f6a3a', roughness: 1 }), 2000)
      this.stalks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (sp.fruit.shape === 'strawberry') {
        const cg = new THREE.ConeGeometry(0.75, 0.22, 5, 1)
        cg.translate(0, 0.08, 0)
        this.calyx = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: '#4f7f2e', roughness: 0.9 }), 2000)
        this.calyx.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      }
    }

    this.seedMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: sp.seed.color, roughness: 0.7 }),
    )
    this.seedMesh.castShadow = true
    const ss = 0.012 + sp.seed.size * 0.0035
    this.seedMesh.scale.set(ss * 1.2, ss * 0.8, ss)

    const pos = new Float32Array(life.attractors.length * 3)
    this.moteAlpha = new Float32Array(life.attractors.length)
    life.attractors.forEach((a, i) => { pos[i * 3] = a.x; pos[i * 3 + 1] = a.y; pos[i * 3 + 2] = a.z })
    const mg = new THREE.BufferGeometry()
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    mg.setAttribute('alpha', new THREE.BufferAttribute(this.moteAlpha, 1))
    const moteMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#fff2c4') } },
      vertexShader: `attribute float alpha; varying float vA; uniform float uTime;
        void main(){ vA = alpha; vec3 p = position; p.y += sin(uTime*0.7 + position.x*3.1 + position.z*2.3)*0.03;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = 90.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; uniform vec3 uColor;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d) * vA * 0.55; gl_FragColor = vec4(uColor, a); }`,
    })
    this.motes = new THREE.Points(mg, moteMat)

    this.group.add(this.branches, this.joints, this.roots, this.flare, this.leaves, this.seedMesh, this.motes)
    for (const m of [this.petals, this.centers, this.buds, this.panicles, this.fruit, this.stalks, this.calyx]) if (m) this.group.add(m)
    // Instances are placed every frame, so never let three.js cull on a stale bounding sphere.
    for (const o of this.group.children) o.frustumCulled = false
  }

  dispose(): void {
    const meshes: (THREE.Mesh | null)[] = [this.branches, this.joints, this.roots, this.flare, this.leaves, this.petals, this.centers, this.buds, this.panicles, this.fruit, this.stalks, this.calyx, this.seedMesh]
    for (const m of meshes) {
      if (!m) continue
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.motes.geometry.dispose()
    ;(this.motes.material as THREE.Material).dispose()
  }

  focusHeight(): number {
    return Math.max(0.18, this.top * 0.52)
  }

  /** Compose a unit cylinder (y 0..1) from a to b with the given radius into _m. */
  private segment(a: THREE.Vector3, b: THREE.Vector3, r: number): void {
    _dir.subVectors(b, a)
    const len = _dir.length() || 0.0001
    _dir.normalize()
    _q.setFromUnitVectors(_up, _dir)
    _s.set(r, len, r)
    _m.compose(a, _q, _s)
  }

  /** Place a sprite that detaches at `from` on day `startDay` and drifts to the ground, then lies there. Returns ground age or -1. */
  private fall(from: THREE.Vector3, day: number, startDay: number, speed: number, i: number, k: number, lieDays: number, sx: number, sy: number): number {
    const t = day - startDay
    if (t < 0) return -1
    const timeToLand = Math.max(0, (from.y - GROUND) / speed)
    const landed = t >= timeToLand
    const drift = landed ? timeToLand : t
    const groundAge = landed ? t - timeToLand : 0
    const fade = landed ? THREE.MathUtils.clamp(1 - (groundAge - lieDays) / 12, 0, 1) : 1
    if (fade <= 0) return -1
    _p.set(
      from.x + Math.sin(drift * 1.1 + i + k * 2.1) * 0.26 + k * 0.08,
      landed ? GROUND + k * 0.004 : from.y - t * speed,
      from.z + Math.cos(drift * 0.8 + i * 0.7 + k) * 0.26,
    )
    if (landed) _e.set(-Math.PI / 2, 0, i * 0.7 + k)
    else _e.set(t * 1.6 + i, t * 0.9 + k, 0.4)
    _q.setFromEuler(_e)
    _s.set(sx * fade, sy * fade, sy * fade)
    _m.compose(_p, _q, _s)
    return groundAge
  }

  private radius(nodes: GNode[], sizes: Int32Array, i: number, day: number, k: number, max: number): number {
    const n = nodes[i]
    const thick = Math.min(1, (day - n.birth) / 45)
    const establish = 0.3 + 0.7 * vigor(day)
    return Math.min(max, (k * Math.sqrt(sizes[i]) * (0.35 + 0.65 * thick) + 0.004) * establish)
  }

  private updateRoots(day: number): void {
    const { roots, species: sp } = this.life
    subtreeSizes(roots, day, this.rootSizes)
    let ri = 0
    for (let i = 1; i < roots.length; i++) {
      const n = roots[i]
      if (n.birth > day) continue
      const p = roots[n.parent]
      const grow = Math.min(1, (day - n.birth) / 2.5)
      const pr = this.radius(roots, this.rootSizes, n.parent, day, sp.radiusK * 0.8, sp.maxRadius * 0.8)
      _p.set(p.x, p.y, p.z)
      _p2.set(n.x, n.y, n.z).sub(_p).multiplyScalar(grow).add(_p)
      this.segment(_p, _p2, pr)
      this.roots.setMatrixAt(ri++, _m)
    }
    this.roots.count = ri
    this.roots.instanceMatrix.needsUpdate = true
  }

  /** Leaf colour for one leaf on one day: flush, mature, autumn path. */
  private leafColor(out: THREE.Color, n: GNode, i: number, day: number, leafAge: number, fallStart: number, groundAge: number): void {
    const sp = this.life.species
    const L = sp.leaf
    const mix = (i % 7) / 7
    out.set(L.color).lerp(_c2.set(L.color2), mix * 0.8)
    const flush = THREE.MathUtils.clamp(leafAge / 22, 0, 1)
    out.lerp(_c2.set(L.young), 1 - flush * flush)
    if (L.autumn) {
      let u = -1
      if (L.dropStart !== null) {
        u = (day - (fallStart - 30 - n.bloomDelay * 10)) / 30
      } else if (n.bloomDelay < 0.3) {
        u = (day - sp.days * 0.8 - n.bloomDelay * 60) / 40
      }
      if (u > 0) {
        u = Math.min(1, u)
        if (u < 0.5) out.lerp(_c2.set(L.autumn[0]), u * 2)
        else out.set(L.autumn[0]).lerp(_c2.set(L.autumn[1]), (u - 0.5) * 2)
      }
      if (groundAge >= 0) out.set(L.autumn[1]).lerp(_c2.set(L.autumn[2]), Math.min(1, groundAge / 18))
    }
    const shade = 0.9 + ((i * 53) % 10) * 0.02
    out.multiplyScalar(shade)
  }

  update(day: number, t: number, wind: number, showRoots: boolean): void {
    const { nodes, species: sp } = this.life
    subtreeSizes(nodes, day, this.sizes)
    let bi = 0, ji = 0, li = 0, pi = 0, ci = 0, ui = 0, ni = 0, ri = 0
    const sway = Math.sin(t * 0.9) * 0.012 * wind + Math.sin(t * 2.3) * 0.004 * wind
    this.group.rotation.z = sway
    this.group.rotation.x = Math.cos(t * 0.7) * 0.006 * wind

    const L = sp.leaf
    const leafDrop = L.dropStart
    const barkC = new THREE.Color(sp.bark)
    const youngC = new THREE.Color('#7f8f4e')
    const B = sp.bloom
    const leafLen = 1 / L.aspect
    let top = 0
    let topIdx = 0
    let baseR = 0.01

    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i]
      if (n.birth > day || n.death <= day) continue
      const p = nodes[n.parent]
      const age = day - n.birth
      const grow = Math.min(1, age / 2.5)
      const dying = n.death < Infinity ? THREE.MathUtils.clamp((n.death - day) / 12, 0, 1) : 1
      const r = this.radius(nodes, this.sizes, i, day, sp.radiusK, sp.maxRadius)
      const pr = n.parent === 0 ? r : this.radius(nodes, this.sizes, n.parent, day, sp.radiusK, sp.maxRadius)
      if (n.parent === 0 && r > baseR) baseR = r

      _p.set(p.x, p.y, p.z)
      _tip.set(n.x, n.y, n.z).sub(_p).multiplyScalar(grow).add(_p)
      this.segment(_p, _tip, pr * dying)
      this.branches.setMatrixAt(bi, _m)
      const shade = 0.82 + ((i * 37) % 10) * 0.03
      _c.copy(barkC).multiplyScalar(shade)
      if (age < 60) _c.lerp(youngC, (1 - age / 60) * 0.7)
      this.branches.setColorAt(bi, _c)
      bi++
      if (_tip.y > top) { top = _tip.y; topIdx = i }

      if (grow >= 1 && this.sizes[i] > 1) {
        _s.set(r * 0.95, r * 0.95, r * 0.95)
        _q.identity()
        _m.compose(_tip, _q, _s)
        this.joints.setMatrixAt(ji, _m)
        this.joints.setColorAt(ji, _c)
        ji++
      }

      // A twig keeps its leaves and flowers only while it is thin; they thin out gradually as it becomes a branch.
      const twigK = THREE.MathUtils.clamp((11 - this.sizes[i]) / 4, 0, 1) * dying
      if (twigK <= 0 && this.sizes[i] > 26) continue

      // Leaves: first-year foliage drops in the first autumn; after winter a fresh flush opens (after the flowers on magnolia and cherry).
      const W = sp.calendar.winter
      const second = W !== null && day >= W.end - 2
      const leafStart = second ? (L.start ?? W!.end) + n.bloomDelay * 12 : 0
      const leafAge = day - Math.max(n.birth, leafStart)
      if (n.hasLeaf && twigK > 0 && second && W) {
        // leaves from the first year still lying on the ground
        const g1 = this.fall(_tip, day, W.dropStart + n.bloomDelay * 30, 0.28, i, 0, 20, L.size, L.size)
        if (g1 >= 0 && n.birth < W.dropStart) {
          this.leaves.setMatrixAt(li, _m)
          this.leafColor(_c, n, i, day, 40, W.dropStart + n.bloomDelay * 30, g1)
          this.leaves.setColorAt(li, _c)
          li++
        }
      }
      if (n.hasLeaf && leafAge > 1 && twigK > 0) {
        const fallStart = !second && W ? W.dropStart + n.bloomDelay * 30 : leafDrop !== null ? leafDrop + n.bloomDelay * 40 : Infinity
        const sc = L.size * Math.min(1, (leafAge - 1) / 16) * twigK
        let groundAge = -1
        let drawn = false
        if (day < fallStart) {
          const flop = (1 - Math.min(1, leafAge / 14)) * 0.5
          _e.set(n.leafTilt + Math.sin(t * 1.7 + i) * 0.08 * wind + flop, n.leafAngle, 0.9 + Math.sin(t * 1.3 + i * 0.7) * 0.05 * wind)
          _q.setFromEuler(_e)
          _s.set(sc, sc, sc)
          _m.compose(_tip, _q, _s)
          drawn = true
          // Second leaf a little down the twig, opposite side, so canopies read full with true-to-life leaf sizes.
          if (L.pairs && this.sizes[i] <= 3) {
            _e.set(-n.leafTilt * 0.8 + flop, n.leafAngle + 2.6, 0.95)
            _q.setFromEuler(_e)
            _p2.copy(_p).lerp(_tip, 0.55)
            _s.set(sc * 0.9, sc * 0.9, sc * 0.9)
            _m.compose(_p2, _q, _s)
            this.leaves.setMatrixAt(li, _m)
            this.leafColor(_c, n, i + 1, day, leafAge - 1, fallStart, -1)
            this.leaves.setColorAt(li, _c)
            li++
            _s.set(sc, sc, sc)
            _q.setFromEuler(_e.set(n.leafTilt + Math.sin(t * 1.7 + i) * 0.08 * wind + flop, n.leafAngle, 0.9 + Math.sin(t * 1.3 + i * 0.7) * 0.05 * wind))
            _m.compose(_tip, _q, _s)
          }
        } else {
          groundAge = this.fall(_tip, day, fallStart, 0.28, i, 0, second ? 50 : 20, L.size, L.size)
          drawn = groundAge >= 0
        }
        if (drawn) {
          this.leaves.setMatrixAt(li, _m)
          this.leafColor(_c, n, i, day, leafAge, fallStart, groundAge)
          this.leaves.setColorAt(li, _c)
          li++
        }
      }

      // Flowers: bud, open petal by petal, hold, then shed single petals. Spurs along older wood flower too.
      const flowerK = THREE.MathUtils.clamp((26 - this.sizes[i]) / 8, 0, 1) * dying
      if (B && n.hasBloom && flowerK > 0 && B.kind === 'petal' && this.petals && this.centers && this.buds) {
        const yaw = n.leafAngle
        const horiz = Math.sqrt(Math.max(0, 1 - B.axisUp * B.axisUp))
        _axis.set(Math.cos(yaw) * horiz, B.axisUp, Math.sin(yaw) * horiz).normalize()
        for (let j = 0; j < B.cluster; j++) {
          const start = B.start + n.bloomDelay * 8 + j * 1.3
          const end = Math.min(start + B.life + n.bloomDelay * 4, B.end + 6)
          const budDays = B.budDays ?? 9
          if (day < start - budDays || day > end + 60) continue
          _pos.copy(_tip)
          if (B.cluster > 1) _pos.add(_p2.set(Math.cos(yaw + j * 2.1) * 0.6, 0.25, Math.sin(yaw + j * 2.1) * 0.6).multiplyScalar(B.length * 0.45))
          _qF.setFromUnitVectors(_up, _axis)
          _qK.setFromAxisAngle(_up, j * 1.7 + i * 0.3)
          _qF.multiply(_qK)
          if (day < start) {
            if (ui >= 9000) continue
            // bud swelling
            const g = THREE.MathUtils.clamp((day - (start - budDays)) / budDays, 0, 1)
            _s.set(B.width * 0.55 * (0.4 + 0.6 * g), B.length * 0.5 * (0.4 + 0.6 * g), B.width * 0.55 * (0.4 + 0.6 * g))
            _m.compose(_pos, _qF, _s)
            this.buds.setMatrixAt(ui++, _m)
            continue
          }
          if (day <= end) {
            const open = Math.min(1, (day - start) / 4)
            const sc = (0.45 + 0.55 * open) * (0.6 + 0.4 * flowerK)
            if (open < 0.6 && ui < 9000) {
              const g = 1 - open / 0.6
              _s.set(B.width * 0.55 * g, B.length * 0.5 * g, B.width * 0.55 * g)
              _m.compose(_pos, _qF, _s)
              this.buds.setMatrixAt(ui++, _m)
            }
            const n9 = B.petals
            if (pi + n9 > MAX_PETALS) continue
            for (let k = 0; k < n9; k++) {
              const whorl = n9 >= 9 ? (k < 6 ? 0 : 1) : (n9 > 6 ? k % 2 : 0)
              const tilt = (B.tilt + whorl * 0.3) * (0.1 + 0.9 * open)
              _qK.setFromAxisAngle(_up, (k / n9) * Math.PI * 2 + whorl * 0.3)
              _q.copy(_qF).multiply(_qK)
              _qK.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt)
              _q.multiply(_qK)
              const pl = B.length * sc * (whorl ? 0.85 : 1)
              _s.set(B.width * sc * (whorl ? 0.85 : 1), pl, pl)
              _m.compose(_pos, _q, _s)
              this.petals.setMatrixAt(pi, _m)
              _c.set(B.outer).lerp(_c2.set(B.color), open * open)
              if (whorl) _c.lerp(_c3.set(B.outer), 0.5)
              this.petals.setColorAt(pi, _c)
              pi++
            }
            if (open > 0.3 && ci < 9000) {
              _qK.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
              _q.copy(_qF).multiply(_qK)
              _p2.copy(_axis).multiplyScalar(B.length * 0.08).add(_pos)
              const cs = B.centerSize * Math.min(1, (open - 0.3) / 0.5)
              _s.set(cs, cs, cs)
              _m.compose(_p2, _q, _s)
              this.centers.setMatrixAt(ci++, _m)
            }
          } else {
            for (let k = 0; k < Math.min(3, B.petals) && pi < MAX_PETALS; k++) {
              if (this.fall(_pos, day, end + k * 1.6, 0.3, i * 3 + j, k, 24, B.width, B.length) >= 0) {
                this.petals.setMatrixAt(pi, _m)
                this.petals.setColorAt(pi, _c.set(B.color).lerp(_c2.set(B.outer), 0.4))
                pi++
              }
            }
          }
        }
      } else if (B && n.hasBloom && B.kind === 'panicle' && this.panicles) {
        const start = B.start + n.bloomDelay * 12
        const end = Math.min(start + B.life, B.end + 8)
        if (day >= start - 4 && day <= end + 8) {
          const g = THREE.MathUtils.clamp((day - (start - 4)) / 10, 0, 1)
          const fade = day > end ? Math.max(0, 1 - (day - end) / 8) : 1
          _axis.set(Math.cos(n.leafAngle) * 0.25, 1, Math.sin(n.leafAngle) * 0.25).normalize()
          _qF.setFromUnitVectors(_up, _axis)
          _s.set(B.width * g * fade, B.length * g * fade, B.width * g * fade)
          _m.compose(_tip, _qF, _s)
          this.panicles.setMatrixAt(ni++, _m)
        }
      }

      // Fruit: species-shaped, on a stalk, ripening from green.
      if (sp.fruit && this.fruit && this.stalks && n.hasFruit && flowerK > 0 && day >= sp.fruit.start + n.bloomDelay * 12) {
        const f = sp.fruit
        const ripen = Math.min(1, (day - f.start - n.bloomDelay * 12) / f.ripenDays)
        const sc = f.size * (0.18 + 0.82 * Math.sqrt(ripen))
        const swing = Math.sin(t * 1.4 + i) * 0.01 * wind
        if (f.shape === 'strawberry') {
          const out = Math.hypot(n.x, n.z) || 1
          _p2.set(n.x + (n.x / out) * 0.05, GROUND + sc * 0.42, n.z + (n.z / out) * 0.05)
          _e.set(0, Math.atan2(n.x, n.z), 1.25)
          _q.setFromEuler(_e)
          _s.set(sc, sc, sc)
          _p.copy(_p2).sub(_p2.clone().set(0, sc, 0).applyQuaternion(_q).multiplyScalar(0.5))
          _m.compose(_p, _q, _s)
          this.fruit.setMatrixAt(ri, _m)
          _p2.copy(_p).add(new THREE.Vector3(0, sc, 0).applyQuaternion(_q))
          this.segment(_tip, _p2, 0.0025)
          this.stalks.setMatrixAt(ri, _m)
          if (this.calyx) {
            _s.set(sc, sc, sc)
            _m.compose(_p2, _q, _s)
            this.calyx.setMatrixAt(ri, _m)
          }
        } else {
          _p2.set(_tip.x + swing, _tip.y - f.stalk - sc, _tip.z)
          _q.identity()
          if (f.shape === 'mango') _s.set(sc * 0.8, sc * 1.25, sc * 0.62)
          else _s.set(sc, sc, sc)
          _m.compose(_p2, _q, _s)
          this.fruit.setMatrixAt(ri, _m)
          _p.set(_p2.x, _p2.y + sc, _p2.z)
          this.segment(_tip, _p, 0.0035)
          this.stalks.setMatrixAt(ri, _m)
        }
        _c.set('#8fae4a').lerp(_c2.set('#ffffff'), ripen * ripen)
        this.fruit.setColorAt(ri, _c)
        ri++
      }
    }

    // Trunk flare where the stem meets the soil.
    this.flare.visible = baseR > 0.012 && sp.trunkHeight > 0.5
    this.flare.scale.set(baseR * 1.75, baseR * 2.4, baseR * 1.75)
    this.flare.position.y = -0.01

    // Sprout: the seed sinks into the soil, then two seed leaves open at the tip and wither as true leaves take over.
    this.seedMesh.visible = day < 9
    this.seedMesh.position.y = 0.03 - Math.min(1, day / 6) * 0.07
    if (day > 1.5 && day < 40 && nodes.length > 1) {
      const n = nodes[topIdx]
      const ramp = Math.min(1, (day - 1.5) / 7)
      const wither = day > 30 ? Math.max(0, 1 - (day - 30) / 9) : 1
      const sc = L.size * 0.6 * ramp * wither
      for (let k = 0; k < 2; k++) {
        _e.set(0.35 + Math.sin(t * 1.5 + k) * 0.05 * wind, n.leafAngle + k * Math.PI, 1.15 - ramp * 0.35)
        _q.setFromEuler(_e)
        _s.set(sc * 1.2, sc * 0.8 * L.aspect * leafLen, sc)
        _p.set(n.x, n.y, n.z)
        _m.compose(_p, _q, _s)
        this.leaves.setMatrixAt(li, _m)
        this.leaves.setColorAt(li, _c.set(L.young).lerp(_c2.set(L.color2), 0.4))
        li++
      }
    }
    this.top = Math.max(top, 0.1)

    this.branches.count = bi
    this.joints.count = ji
    this.leaves.count = li
    this.branches.instanceMatrix.needsUpdate = true
    this.branches.instanceColor!.needsUpdate = true
    this.joints.instanceMatrix.needsUpdate = true
    this.joints.instanceColor!.needsUpdate = true
    this.leaves.instanceMatrix.needsUpdate = true
    this.leaves.instanceColor!.needsUpdate = true
    if (this.petals && this.centers && this.buds) {
      this.petals.count = pi
      this.centers.count = ci
      this.buds.count = ui
      this.petals.instanceMatrix.needsUpdate = true
      this.petals.instanceColor!.needsUpdate = true
      this.centers.instanceMatrix.needsUpdate = true
      this.buds.instanceMatrix.needsUpdate = true
    }
    if (this.panicles) {
      this.panicles.count = ni
      this.panicles.instanceMatrix.needsUpdate = true
    }
    if (this.fruit && this.stalks) {
      this.fruit.count = ri
      this.stalks.count = ri
      this.fruit.instanceMatrix.needsUpdate = true
      this.fruit.instanceColor!.needsUpdate = true
      this.stalks.instanceMatrix.needsUpdate = true
      if (this.calyx) { this.calyx.count = ri; this.calyx.instanceMatrix.needsUpdate = true }
    }

    this.roots.visible = showRoots
    if (showRoots) this.updateRoots(day)

    const atts = this.life.attractors
    for (let i = 0; i < atts.length; i++) {
      const a = atts[i]
      let v = 0
      if (this.showMotes && a.killed > day) {
        const since = day - a.unlock
        v = since < -25 ? 0 : since < 0 ? (since + 25) / 25 * 0.35 : 1
      } else if (this.showMotes && a.killed <= day && day - a.killed < 3) {
        v = 1 - (day - a.killed) / 3
      }
      this.moteAlpha[i] = v
    }
    ;(this.motes.geometry.getAttribute('alpha') as THREE.BufferAttribute).needsUpdate = true
    ;(this.motes.material as THREE.ShaderMaterial).uniforms.uTime.value = t
    this.motes.visible = this.showMotes
  }
}
