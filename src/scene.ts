import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { groundTexture, soilTexture, grassTexture, cloudTexture } from './textures'

const GRASS_COUNT = 14000

export class Scene {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  sun: THREE.DirectionalLight
  private targetY = 1
  private targetDist = 7
  private ground: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private soil: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private grass: THREE.InstancedMesh
  private grassTime = { value: 0 }
  private clouds: THREE.Sprite[] = []
  private groundOpacity = 1
  private wantRoots = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    const horizon = new THREE.Color('#e4e3d2')
    this.scene.background = skyGradient()
    this.scene.fog = new THREE.Fog(horizon, 22, 60)

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 140)
    this.camera.position.set(6, 2.4, 7)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.3
    this.controls.maxPolarAngle = Math.PI * 0.485
    this.controls.minDistance = 1.0
    this.controls.maxDistance = 30
    this.controls.enablePan = false
    this.controls.target.set(0, 1, 0)

    const hemi = new THREE.HemisphereLight('#dfeaf5', '#6f6a4a', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#fff3df', 2.2)
    this.sun.position.set(6, 9, 4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -8
    this.sun.shadow.camera.right = 8
    this.sun.shadow.camera.top = 10
    this.sun.shadow.camera.bottom = -2
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 30
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun)

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, transparent: true }),
    )
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.scene.add(this.ground)

    this.soil = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.MeshStandardMaterial({ map: soilTexture(), roughness: 1, transparent: true }),
    )
    this.soil.rotation.x = -Math.PI / 2
    this.soil.position.y = 0.006
    this.soil.receiveShadow = true
    this.scene.add(this.soil)

    this.grass = this.makeGrass()
    this.scene.add(this.grass)

    for (let i = 0; i < 7; i++) {
      const sm = new THREE.SpriteMaterial({ map: cloudTexture(20 + i), transparent: true, opacity: 0.85, depthWrite: false, fog: true })
      const sp = new THREE.Sprite(sm)
      const a = (i / 7) * Math.PI * 2 + 0.4
      const d = 44 + (i % 3) * 5
      sp.position.set(Math.cos(a) * d, 9 + (i % 4) * 2.2, Math.sin(a) * d)
      const sc = 16 + (i % 3) * 5
      sp.scale.set(sc * 1.9, sc, 1)
      this.clouds.push(sp)
      this.scene.add(sp)
    }

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private makeGrass(): THREE.InstancedMesh {
    const geo = new THREE.PlaneGeometry(0.022, 0.13, 1, 3)
    geo.translate(0, 0.065, 0)
    const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: '#ffffff' })
    const time = this.grassTime
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float gy = position.y / 0.13;
        float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
        transformed.x += (sin(uTime * 1.4 + ph) * 0.05 + sin(uTime * 2.9 + ph * 2.0) * 0.015) * gy * gy;`,
      )
    }
    const mesh = new THREE.InstancedMesh(geo, mat, GRASS_COUNT)
    mesh.receiveShadow = true
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRASS_COUNT * 3), 3)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    const a = new THREE.Color('#6a8a3c')
    const b = new THREE.Color('#a9c25c')
    let seed = 1234
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    let n = 0
    while (n < GRASS_COUNT) {
      const r = 1.25 + Math.pow(rnd(), 1.4) * 10
      const ang = rnd() * Math.PI * 2
      p.set(Math.cos(ang) * r, 0, Math.sin(ang) * r)
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI)
      const h = 0.6 + rnd() * 0.9
      s.set(0.8 + rnd() * 0.6, h, 1)
      m.compose(p, q, s)
      mesh.setMatrixAt(n, m)
      c.copy(a).lerp(b, rnd())
      mesh.setColorAt(n, c)
      n++
    }
    return mesh
  }

  resize(): void {
    const c = this.renderer.domElement
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== w || c.height !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
  }

  /** Sun drifts lower and warmer as the year goes on, so shadows and light read as seasons. */
  season(frac: number): void {
    const a = 0.9 + frac * 1.1
    this.sun.position.set(Math.cos(a) * 7, 9.5 - frac * 3.5, Math.sin(a) * 7 + 2)
    this.sun.color.set('#fff3df').lerp(new THREE.Color('#ffd7a3'), Math.max(0, frac - 0.6) * 2.5)
    this.sun.intensity = 2.2 - frac * 0.5
  }

  /** Fade the ground so the root system shows through. */
  setRoots(show: boolean): void {
    this.wantRoots = show
  }

  /** Keep the growing plant framed: target rises with the crown, camera backs away. */
  frame(focusY: number, height: number): void {
    this.targetY = focusY
    this.targetDist = THREE.MathUtils.clamp(height * 1.9 + 1.5, 1.7, 20)
  }

  /** Jump straight to the framing (used right after planting so the new plant is never off screen). */
  snap(): void {
    const t = this.controls.target
    t.y = this.targetY
    const dir = this.camera.position.clone().sub(t).normalize()
    this.camera.position.copy(t).addScaledVector(dir, this.targetDist)
  }

  render(dt: number, t: number): void {
    this.resize()
    const tg = this.controls.target
    tg.y += (this.targetY - tg.y) * Math.min(1, dt * 2.2)
    const dir = this.camera.position.clone().sub(tg)
    const d = dir.length()
    const nd = d + (this.targetDist - d) * Math.min(1, dt * 1.6)
    this.camera.position.copy(tg).addScaledVector(dir.normalize(), nd)
    this.controls.update()

    const want = this.wantRoots ? 0.22 : 1
    this.groundOpacity += (want - this.groundOpacity) * Math.min(1, dt * 4)
    this.ground.material.opacity = this.groundOpacity
    this.soil.material.opacity = Math.min(1, this.groundOpacity + 0.1)
    this.grass.visible = this.groundOpacity > 0.6
    this.grass.frustumCulled = false
    this.grassTime.value = t
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i]
      const a = Math.atan2(c.position.z, c.position.x) + dt * 0.004
      const r = Math.hypot(c.position.x, c.position.z)
      c.position.x = Math.cos(a) * r
      c.position.z = Math.sin(a) * r
    }
    this.renderer.render(this.scene, this.camera)
  }
}

function skyGradient(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 512
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#9fbdd8')
  g.addColorStop(0.35, '#c6d9e3')
  g.addColorStop(0.62, '#e1e5d9')
  g.addColorStop(1, '#ebe4cf')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 2, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
