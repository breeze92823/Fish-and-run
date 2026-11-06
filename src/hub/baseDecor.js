// What a plot looks like at each base tier (BASE.tiers in config): the fence, the deck inside
// the front fence, and what each tier adds -- lanterns and lily pads, rocks, a fountain and
// planters, flags and a glowing pond rim, crystals. Everything stays inside the plot's own
// fence line, so a bigger base never reaches a neighbour's plot.
//   buildDecor(tier, dims) -> { group, update(dt, elapsed) }   (dims: plots.js plotDims())
// Static parts are baked to one mesh per material; particles are separate emitters.
import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, MeshStandardMaterial, PlaneGeometry, DoubleSide } from 'three'
import { BASE, PLOT } from '../config.js'
import { neon, put, std } from '../propkit.js'
import { createEmitter } from '../particles.js'
import { bake } from '../bake.js'
import { buildFence, wood } from './props.js'

const box = (x, y, z) => new BoxGeometry(x, y, z)
const cache = new Map()
const once = (key, make) => (cache.has(key) ? cache.get(key) : cache.set(key, make()).get(key))

function fenceMat(f) {
  if (f.kind === 'wood') return wood()
  return once(`fence:${f.color}`, () =>
    new MeshStandardMaterial({
      color: f.color,
      roughness: f.metal ? 0.3 : 0.75,
      metalness: f.metal ? 0.6 : 0,
      ...(f.glow ? { emissive: f.glow, emissiveIntensity: 0.35 } : {}),
    }),
  )
}
function deckMat(d) {
  if (d.kind === 'wood') return wood()
  return once(`deck:${d.color}`, () => std(d.color, { roughness: 0.85 }))
}

export function buildDecor(tierIndex, dims) {
  const T = BASE.tiers[Math.max(0, Math.min(BASE.tiers.length - 1, tierIndex))]
  const { L, W, D, b, gate } = dims
  const group = new Group()
  const st = new Group() // static, baked below
  const front = W / 2 // inner face of the front fence
  const waterZ0 = -W / 2 // the pond runs from the back fence ...
  const waterZ1 = W / 2 - D // ... to the deck
  const fm = fenceMat(T.fence)

  buildFence(st, L, W, { gate, material: fm })

  // Deck: the walkway inside the front fence, and a threshold through the gate.
  const dm = deckMat(T.deck)
  put(st, box(L, 0.08, D), dm, 0, 0.04, (waterZ1 + front) / 2, false).receiveShadow = true
  put(st, box(gate.width, 0.08, b + 0.02), dm, gate.x, 0.04, front + b / 2, false).receiveShadow = true
  // The pond's edge: a low kerb between the deck and the water.
  put(st, box(L, 0.16, 0.22), fm, 0, 0.08, waterZ1 + 0.11)

  // Corner posts get lanterns.
  const corners = [
    [-(L / 2 + b / 2), -(W / 2 + b / 2)],
    [L / 2 + b / 2, -(W / 2 + b / 2)],
    [-(L / 2 + b / 2), W / 2 + b / 2],
    [L / 2 + b / 2, W / 2 + b / 2],
  ]
  const H = PLOT.fence.height
  if (T.lanterns) {
    const cap = once('lantern:cap', () => std('#2a2a30', { roughness: 0.5 }))
    const light = once(`lantern:${T.lanterns}`, () => neon(T.lanterns, 2.4))
    for (const [x, z] of corners) {
      put(st, box(0.42, 0.06, 0.42), cap, x, H + 0.12, z)
      put(st, box(0.3, 0.34, 0.3), light, x, H + 0.32, z, false)
      put(st, box(0.42, 0.06, 0.42), cap, x, H + 0.52, z)
    }
  }

  // Lily pads floating near the pond's edges.
  if (T.lily) {
    const pad = once('lily', () => std('#3cc83a', { roughness: 0.6, side: DoubleSide }))
    const flower = once('lily:flower', () => std('#ff8ac8', { roughness: 0.5 }))
    const spots = [[-L * 0.38, waterZ0 + 0.9], [L * 0.31, waterZ0 + 1.3], [-L * 0.12, waterZ1 - 0.8], [L * 0.42, waterZ1 - 1.2], [-L * 0.44, waterZ1 - 1.6]]
    spots.forEach(([x, z], i) => {
      const m = put(st, new CylinderGeometry(0.55 + (i % 2) * 0.15, 0.55 + (i % 2) * 0.15, 0.03, 12), pad, x, 0.17, z, false)
      m.rotation.y = i
      if (i % 2 === 0) put(st, new ConeGeometry(0.16, 0.22, 6), flower, x + 0.15, 0.28, z - 0.1, false)
    })
  }

  // Rocks in the pond's back corners.
  if (T.rocks) {
    const rock = once('rock', () => std('#8a8f9a', { roughness: 0.95, flatShading: true }))
    const rockD = once('rock:d', () => std('#6c717c', { roughness: 0.95, flatShading: true }))
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - 0.9)
      put(st, new DodecahedronGeometry(0.75, 0), rock, x, 0.25, waterZ0 + 0.9)
      put(st, new DodecahedronGeometry(0.5, 0), rockD, x - sx * 0.9, 0.18, waterZ0 + 0.6)
      put(st, new DodecahedronGeometry(0.42, 0), rock, x, 0.15, waterZ0 + 1.9)
    }
  }

  // A fountain against the back fence: basin, column, bowl, spray.
  if (T.fountain) {
    const stone = once('fountain', () => std('#e8e8f0', { roughness: 0.6 }))
    const z = waterZ0 + 1.1
    put(st, new CylinderGeometry(1.0, 1.1, 0.4, 16), stone, 0, 0.2, z)
    put(st, new CylinderGeometry(0.18, 0.24, 1.3, 10), stone, 0, 0.9, z)
    put(st, new CylinderGeometry(0.55, 0.3, 0.2, 14), stone, 0, 1.55, z)
    createEmitter(group, { boxes: [{ x: 0, y: 1.7, z, sx: 0.08, sy: 0.05, sz: 0.08 }], count: 26, life: 0.9, velocity: [0, 2.2, 0], spread: [0.6, 0.4, 0.6], size: 0.22, color: '#bff4ff', intensity: 1.6, seed: 31 })
  }

  // Flower planters at both ends of the deck.
  if (T.planters) {
    const crate = once('planter', () => std('#8a5a2a', { roughness: 0.9 }))
    const leaf = once('planter:leaf', () => std('#2fa83a', { roughness: 0.8 }))
    const petals = ['#ff5a8a', '#ffd23a', '#ffffff', '#c070ff'].map((c) => once(`petal:${c}`, () => std(c, { roughness: 0.6 })))
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - 0.75)
      const z = (waterZ1 + front) / 2
      put(st, box(1.0, 0.5, 1.8), crate, x, 0.25, z)
      put(st, box(0.9, 0.12, 1.7), leaf, x, 0.54, z)
      for (let i = 0; i < 6; i++) put(st, box(0.2, 0.2, 0.2), petals[i % petals.length], x + ((i % 2) - 0.5) * 0.45, 0.68, z - 0.65 + i * 0.26)
    }
  }

  // Flags on tall poles at the back corners.
  if (T.flags) {
    const pole = once('flag:pole', () => std('#e8e8f0', { roughness: 0.4, metalness: 0.3 }))
    const cloth = once(`flag:${T.flags}`, () => std(T.flags, { roughness: 0.7, side: DoubleSide }))
    for (const [x, z] of corners.slice(0, 2)) {
      put(st, new CylinderGeometry(0.06, 0.06, 3.6, 8), pole, x, 1.8, z)
      const f = put(st, new PlaneGeometry(1.1, 0.7), cloth, x + Math.sign(-x) * 0.6, 3.2, z, false)
      f.rotation.y = 0
    }
  }

  // A glowing rim round the pond.
  if (T.rim) {
    const rim = once(`rim:${T.rim}`, () => neon(T.rim, 2.2))
    const zMid = (waterZ0 + waterZ1) / 2
    const depth = waterZ1 - waterZ0
    put(st, box(L, 0.05, 0.08), rim, 0, 0.18, waterZ1 - 0.02, false)
    put(st, box(L, 0.05, 0.08), rim, 0, 0.18, waterZ0 + 0.02, false)
    for (const sx of [-1, 1]) put(st, box(0.08, 0.05, depth), rim, sx * (L / 2 - 0.02), 0.18, zMid, false)
  }

  // Crystal clusters on the deck corners, with sparkles.
  if (T.crystals) {
    const c = once(`crystal:${T.crystals}`, () => neon(T.crystals, 2.0))
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - 0.45)
      const z = front - 0.45
      for (const [dx, dz, h] of [[0, 0, 1.3], [0.25, -0.2, 0.8], [-0.2, 0.15, 0.7]]) {
        const m = put(st, new ConeGeometry(0.18, h, 5), c, x + dx * -sx, h / 2, z + dz, false)
        m.rotation.z = dx * 0.6
      }
    }
    createEmitter(group, { boxes: [{ x: 0, y: 1.2, z: (waterZ0 + waterZ1) / 2, sx: L / 2, sy: 0.8, sz: (waterZ1 - waterZ0) / 2 }], count: 22, life: 1.4, velocity: [0, 0.3, 0], spread: [0.1, 0.2, 0.1], size: 0.35, color: T.crystals, intensity: 3, sprite: 'sparkle', twinkle: 7, seed: 57 })
  }

  const baked = bake(st, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)
  return { group, tier: tierIndex }
}
