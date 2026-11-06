import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  RingGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three'
import { paintSoftDot, paintSparkle } from './textures.js'

// One-shot effects: particle bursts (water droplets, sparkles, dust puffs) and
// expanding water rings. Each pool is one Points draw call updated on the CPU
// (a few hundred particles at most), so bursts cost nothing when idle.
// fx.burst(pos, { count, color, speed, up, spread, life, size, gravity, drag, kind })
// kind: 'spark' (additive sparkle star), 'glow' (additive soft dot), 'puff' (soft, normal blend)

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float uViewport;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = alpha;
    vTint = tint;
    gl_PointSize = size * projectionMatrix[1][1] * 0.5 * uViewport / max(-mv.z, 0.1);
  }`
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uIntensity;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vTint * t.rgb * uIntensity, t.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

const viewport = { value: 800 }
const tmp = new Color()

function pool(scene, map, blending, intensity, capacity) {
  const pos = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage)
  const tint = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage)
  const size = new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage)
  const alpha = new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage)
  const geo = new BufferGeometry()
  geo.setAttribute('position', pos)
  geo.setAttribute('tint', tint)
  geo.setAttribute('size', size)
  geo.setAttribute('alpha', alpha)
  const mat = new ShaderMaterial({
    uniforms: { map: { value: map }, uIntensity: { value: intensity }, uViewport: viewport },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 4
  scene.add(points)
  const P = Array.from({ length: capacity }, () => ({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 0.2, grow: 1, g: 0, drag: 0, r: 1, gr: 1, b: 1 }))
  let next = 0
  return {
    emit(o) {
      const p = P[next]
      next = (next + 1) % capacity
      Object.assign(p, o, { live: true, age: 0 })
    },
    update(dt) {
      let any = false
      for (let i = 0; i < capacity; i++) {
        const p = P[i]
        if (!p.live) {
          alpha.array[i] = 0
          continue
        }
        any = true
        p.age += dt
        if (p.age >= p.life) {
          p.live = false
          alpha.array[i] = 0
          continue
        }
        const k = 1 - Math.min(1, p.drag * dt)
        p.vx *= k
        p.vz *= k
        p.vy = p.vy * k - p.g * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        const t = p.age / p.life
        pos.array[i * 3] = p.x
        pos.array[i * 3 + 1] = p.y
        pos.array[i * 3 + 2] = p.z
        tint.array[i * 3] = p.r
        tint.array[i * 3 + 1] = p.gr
        tint.array[i * 3 + 2] = p.b
        size.array[i] = p.size * (1 + (p.grow - 1) * t)
        alpha.array[i] = Math.min(1, t * 8) * (1 - t * t)
      }
      if (any || points.visible) {
        pos.needsUpdate = tint.needsUpdate = size.needsUpdate = alpha.needsUpdate = true
      }
      points.visible = any
    },
  }
}

export function createFx(scene) {
  const make = (c) => {
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }
  const dot = make(paintSoftDot())
  const star = make(paintSparkle())
  const pools = {
    spark: pool(scene, star, AdditiveBlending, 2.4, 260),
    glow: pool(scene, dot, AdditiveBlending, 1.8, 260),
    puff: pool(scene, dot, NormalBlending, 1, 200),
  }
  // Water rings
  const rings = []
  const ringGeo = new RingGeometry(0.85, 1, 32)
  for (let i = 0; i < 10; i++) {
    const m = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
    m.rotation.x = -Math.PI / 2
    m.visible = false
    m.renderOrder = 3
    scene.add(m)
    rings.push({ m, age: 0, life: 1, max: 1 })
  }
  let ringNext = 0

  return {
    burst(at, o = {}) {
      const p = pools[o.kind ?? 'glow']
      const n = o.count ?? 12
      tmp.set(o.color ?? '#ffffff')
      const speed = o.speed ?? 3
      const up = o.up ?? 2
      const spread = o.spread ?? 0.2
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const s = speed * (0.4 + Math.random() * 0.6)
        p.emit({
          x: at.x + (Math.random() - 0.5) * spread,
          y: at.y + (Math.random() - 0.5) * spread * 0.5,
          z: at.z + (Math.random() - 0.5) * spread,
          vx: Math.cos(a) * s,
          vz: Math.sin(a) * s,
          vy: up * (0.5 + Math.random() * 0.7),
          life: (o.life ?? 0.8) * (0.7 + Math.random() * 0.5),
          size: (o.size ?? 0.25) * (0.7 + Math.random() * 0.6),
          grow: o.grow ?? 1,
          g: o.gravity ?? 9,
          drag: o.drag ?? 1,
          r: tmp.r,
          gr: tmp.g,
          b: tmp.b,
        })
      }
    },
    ring(at, { size = 1.6, life = 0.9, color = '#ffffff' } = {}) {
      const r = rings[ringNext]
      ringNext = (ringNext + 1) % rings.length
      r.m.position.set(at.x, at.y, at.z)
      r.m.material.color.set(color)
      r.age = 0
      r.life = life
      r.max = size
      r.m.visible = true
    },
    update(dt, viewportHeight) {
      viewport.value = viewportHeight
      for (const k in pools) pools[k].update(dt)
      for (const r of rings) {
        if (!r.m.visible) continue
        r.age += dt
        const t = r.age / r.life
        if (t >= 1) {
          r.m.visible = false
          continue
        }
        const s = 0.2 + r.max * t
        r.m.scale.set(s, s, s)
        r.m.material.opacity = 0.75 * (1 - t)
      }
    },
  }
}
