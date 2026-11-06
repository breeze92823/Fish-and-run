import { BoxGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Vector3 } from 'three'
import { HUB, LANE, PLOT } from '../config.js'
import { bake } from '../bake.js'
import { put, solidBox, solidPole } from '../propkit.js'
import { mulberry32 } from '../textures.js'
import { createEmitter } from '../particles.js'
import { paintCaustics, paintStuds, paintWall, paintWood, tex } from '../hub/paint.js'

// Lane scenery for one zone, built from blocky parts like the reference: the river
// (cyan water between raised studded lavender curbs, a dark tunnel through each
// wall), and the Forest farm: red barn with a white gambrel roof, twin silos, hay
// bales, a windmill with a spinning fan, blocky leaf trees, tiered pines, fallen
// logs and red flowers, a fenced wheat field past its last river; then the Tundra:
// a raised snow slab, grey-lavender stone wall facings with snow on top, snow-capped
// trees and pines, snowy rocks. Static parts are baked to one mesh per material.

export const W = HUB.halfWidth
export const box = (x, y, z) => new BoxGeometry(x, y, z)
const mats = new Map()
export function mat(color, extra) {
  const k = color + JSON.stringify(extra ?? {})
  if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color, roughness: 0.75, ...extra }))
  return mats.get(k)
}
export function baked(group, shadows = true) {
  const b = bake(group, shadows)
  b.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  return b
}

// A box stretched between two points (beams, braces).
export function beam(parent, a, b, t, material) {
  const len = a.distanceTo(b)
  const m = new Mesh(box(t, t, len), material)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.lookAt(b)
  m.castShadow = true
  parent.add(m)
  return m
}

// --- River -----------------------------------------------------------------------------
const riverBase = new Map() // water colour -> caustic texture
const riverTexs = [] // one clone per river (own repeat), scrolled together
const fallTexs = [] // waterfall streaks, scrolled down

// A waterfall's streaky face: the water colour with lighter falling streaks.
function paintFall(color) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 64, 128)
  const rand = mulberry32(color.length * 97)
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.45})`
    const x = rand() * 64
    const y = rand() * 128
    const h = 20 + rand() * 50
    g.fillRect(x, y, 2 + rand() * 4, h)
    if (y + h > 128) g.fillRect(x, y - 128, 2 + rand() * 4, h)
  }
  return c
}

// inset: how far the tunnels sit in from the wall face (a wall facing covers the face).
// curb: [colour, dark] of the raised banks. waterfall: the river pours down each side
// wall (a scrolling cascade framed in the curb colour, foam at the bottom) instead of
// running through tunnels.
export function buildRiver(root, z, { inset = 0, color = LANE.river.color, curb = null, waterfall = false } = {}) {
  const R = LANE.river
  const g = new Group()
  if (!riverBase.has(color)) riverBase.set(color, tex(paintCaustics(color, PLOT.water.light, PLOT.water.deep, 256, 6, 77), 1, 1, 8))
  const t = riverBase.get(color).clone()
  t.repeat.set((W * 2 + 4) / 8, R.width / 8)
  t.needsUpdate = true
  riverTexs.push(t)
  const water = new Mesh(new PlaneGeometry(W * 2 + 4, R.width), new MeshStandardMaterial({ map: t, roughness: 0.1, emissive: color, emissiveIntensity: 0.22 }))
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.06, z)
  water.receiveShadow = true
  root.add(water)

  // Raised studded curbs along both banks.
  const curbTex = tex(paintStuds(curb?.[0] ?? R.bank, curb?.[1] ?? R.bankDark, '#ffffff', 4), (W * 2) / (HUB.studSize * 4), 1)
  const curbMat = new MeshStandardMaterial({ map: curbTex, roughness: 0.8 })
  for (const s of [-1, 1]) {
    const cz = z + s * (R.width / 2 + R.curbWidth / 2)
    put(g, box(W * 2, R.curbHeight, R.curbWidth), curbMat, 0, R.curbHeight / 2, cz)
  }
  if (waterfall) {
    const H = HUB.wall.height + HUB.wall.grassLip
    const ft = tex(paintFall(color), 1, 3, 4)
    fallTexs.push(ft)
    const fallMat = new MeshBasicMaterial({ map: ft })
    const frame = mat(curb?.[0] ?? R.bank)
    for (const sx of [-1, 1]) {
      const x = sx * (W - 0.32 - inset)
      const face = new Mesh(new PlaneGeometry(R.width + 0.4, H), fallMat)
      face.position.set(x, H / 2, z)
      face.rotation.y = -sx * (Math.PI / 2)
      root.add(face)
      for (const s of [-1, 1]) put(g, box(0.9, H + 0.4, 0.8), frame, x - sx * 0.2, (H + 0.4) / 2, z + s * (R.width / 2 + 0.6))
      put(g, box(1.0, 0.7, R.width + 2), frame, x - sx * 0.25, H + 0.1, z)
      createEmitter(root, { boxes: [{ x: x - sx * 1.2, y: 0.4, z, sx: 0.8, sy: 0.1, sz: R.width / 2 - 0.4 }], count: 40, life: 0.9, velocity: [-sx * 1.2, 2.4, 0], spread: [0.8, 0.8, 0.8], gravity: 6, size: 0.45, grow: 1.6, color: '#ffffff', intensity: 1.6, seed: Math.round(z) + sx })
    }
  }
  // Tunnels: a studded purple arch of blocks round a black mouth in each wall.
  const archMat = mat(R.tunnel)
  const archDark = mat(R.tunnelDark)
  const r = R.width * 0.68
  for (const sx of waterfall ? [] : [-1, 1]) {
    const x = sx * (W - 0.35 - inset)
    const n = 15
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1)) * Math.PI
      const bx = Math.cos(a) * (r + 0.8)
      const by = Math.sin(a) * (r + 0.8)
      const blk = put(g, box(1.6, 1.4, 1.9), i % 2 ? archMat : archDark, x, by, z + bx)
      blk.rotation.x = -(a - Math.PI / 2)
    }
    const hole = new Mesh(new CircleGeometry(r, 24, 0, Math.PI), new MeshBasicMaterial({ color: '#04030a' }))
    hole.position.set(sx * (W - 0.05 - inset), 0, z)
    hole.rotation.y = -sx * (Math.PI / 2)
    root.add(hole)
  }
  // Reeds: tall thin cattails leaning a little.
  const rand = mulberry32(z * 7)
  const reedMat = mat('#3f9a2a')
  const headMat = mat('#6a4a22')
  for (let i = 0; i < 16; i++) {
    const x = -W + 3 + rand() * (W * 2 - 6)
    const rz = z + (rand() - 0.5) * (R.width - 1.5)
    const h = 1.6 + rand() * 1.8
    const reed = new Group()
    put(reed, box(0.09, h, 0.09), reedMat, 0, h / 2, 0)
    put(reed, box(0.16, 0.45, 0.16), headMat, 0, h - 0.2, 0)
    reed.position.set(x, 0, rz)
    reed.rotation.set((rand() - 0.5) * 0.35, 0, (rand() - 0.5) * 0.35)
    g.add(reed)
  }
  // Lily pads with pink flowers.
  const padMat = mat('#4fbf3a')
  const petal = mat('#e88ad8')
  for (let i = 0; i < 9; i++) {
    const x = -W + 4 + rand() * (W * 2 - 8)
    const pz = z + (rand() - 0.5) * (R.width - 2)
    const pad = put(g, new CylinderGeometry(0.55, 0.55, 0.06, 10), padMat, x, 0.1, pz, false)
    pad.rotation.y = rand() * Math.PI
    put(g, box(0.34, 0.16, 0.34), petal, x, 0.2, pz, false).rotation.y = 0.4
    put(g, box(0.16, 0.12, 0.16), mat('#ffe060'), x, 0.3, pz, false)
  }
  root.add(baked(g))
  return { z, half: R.width / 2 }
}

// --- Trees --------------------------------------------------------------------------------
let leafMat = null
export function leaves() {
  if (!leafMat) {
    const t = tex(paintStuds('#3cbf2c', '#2a9a20', '#6ae050', 4), 1, 1, 4)
    leafMat = new MeshStandardMaterial({ map: t, roughness: 0.85 })
  }
  return leafMat
}
const trunkMat = () => mat('#8a5a30')

// Blocky leaf tree: a trunk with a few overlapping tilted leaf cubes.
export function leafTree(parent, x, z, s, rand) {
  const g = new Group()
  put(g, box(0.8 * s, 4.5 * s, 0.8 * s), trunkMat(), 0, 2.25 * s, 0)
  const lm = leaves()
  const clumps = [[0, 5.6, 0, 3.6], [-1.4, 5.0, 0.6, 2.6], [1.3, 5.2, -0.5, 2.8], [0.2, 6.9, 0.3, 2.4]]
  for (const [cx, cy, cz, c] of clumps) {
    const m = put(g, box(c * s, c * 0.85 * s, c * s), lm, cx * s, cy * s, cz * s)
    m.rotation.set((rand() - 0.5) * 0.5, rand() * 1.5, (rand() - 0.5) * 0.5)
  }
  g.position.set(x, 0, z)
  g.rotation.y = rand() * Math.PI
  parent.add(g)
  solidPole(0.5 * s, 4, x, z)
}

// Tiered pine: stacked square tiers getting smaller, on a short trunk.
export function pine(parent, x, z, s, rand) {
  const g = new Group()
  put(g, box(0.6 * s, 1.4 * s, 0.6 * s), trunkMat(), 0, 0.7 * s, 0)
  const lm = leaves()
  const tiers = 5
  for (let i = 0; i < tiers; i++) {
    const w = (3.2 - i * 0.55) * s
    const m = put(g, box(w, 1.3 * s, w), lm, 0, (1.4 + i * 1.15 + 0.65) * s, 0)
    m.rotation.y = i * 0.35
  }
  g.position.set(x, 0, z)
  g.rotation.y = rand() * Math.PI
  parent.add(g)
  solidPole(0.6 * s, 4, x, z)
}

// --- Farm buildings ---------------------------------------------------------------------------
let barnTex = null
function barnWall() {
  if (!barnTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#d42a1e'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#c02218' : '#de3324'
      g.fillRect(i * 16, 0, 14, 128)
      g.fillStyle = '#8e1810'
      g.fillRect(i * 16 + 14, 0, 2, 128)
    }
    barnTex = tex(c, 3, 1, 8)
  }
  return new MeshStandardMaterial({ map: barnTex, roughness: 0.8 })
}

// Barn: red planked body, white gambrel roof, white-framed X doors, a lean-to shed.
function barn(parent, x, z, yaw) {
  const g = new Group()
  const Wd = 11
  const D = 15
  const H = 7
  const red = barnWall()
  const white = mat('#f4f4f0')
  put(g, box(Wd, H, D), red, 0, H / 2, 0)
  // Gambrel roof: lower steep panels then upper shallow panels, along the length.
  const roof = (sx, rx, w, y, rot) => {
    const m = put(g, box(w, 0.5, D + 0.8), white, sx * rx, y, 0)
    m.rotation.z = sx * rot
  }
  for (const s of [-1, 1]) {
    roof(s, Wd / 2 - 0.9, 3.4, H + 1.4, 1.05)
    roof(s, 1.9, 4.2, H + 3.5, 0.38)
  }
  // Gable ends (red) filling the roof shape at front and back.
  for (const fz of [-1, 1]) {
    put(g, box(Wd - 1.6, 2.6, 0.3), red, 0, H + 1.3, fz * (D / 2 - 0.15))
    put(g, box(5.4, 1.6, 0.3), red, 0, H + 3.2, fz * (D / 2 - 0.15))
  }
  // Big doors on the front (+Z): white frame with an X.
  const fz = D / 2 + 0.06
  put(g, box(5.2, 5.2, 0.1), mat('#b41c12'), 0, 2.6, fz)
  for (const [w, h, px, py] of [[5.6, 0.35, 0, 5.2], [5.6, 0.35, 0, 0.18], [0.35, 5.2, -2.75, 2.6], [0.35, 5.2, 2.75, 2.6], [0.35, 5.2, 0, 2.6]]) put(g, box(w, h, 0.2), white, px, py, fz + 0.05)
  for (const sx of [-1, 1]) {
    for (const s of [-1, 1]) {
      const m = put(g, box(0.3, 3.4, 0.16), white, sx * 1.35, 2.6, fz + 0.1)
      m.rotation.z = s * 0.72
    }
  }
  // Hay loft window.
  put(g, box(2.4, 2.0, 0.12), mat('#2a1a10'), 0, H + 1.5, fz)
  put(g, box(2.8, 0.3, 0.2), white, 0, H + 2.6, fz + 0.05)
  // Corner trim
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.35, H, 0.35), white, sx * (Wd / 2), H / 2, sz * (D / 2))
  // Lean-to shed on the east side.
  put(g, box(4, 3.6, 8), red, Wd / 2 + 2, 1.8, 2)
  const lean = put(g, box(4.8, 0.35, 8.6), white, Wd / 2 + 2.1, 3.9, 2)
  lean.rotation.z = -0.3
  const k = 1.35 // the reference barn towers over the players
  g.scale.setScalar(k)
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  parent.add(g)
  solidBox((Wd / 2 + 4) * k, 6, (D / 2) * k, x, 6, z, yaw)
}

// Silo: red cylinder with white bands and a white dome cap.
export function silo(parent, x, z, r, h) {
  const g = new Group()
  const red = mat('#d42a1e')
  const white = mat('#f4f4f0')
  put(g, new CylinderGeometry(r, r, h, 12), red, 0, h / 2, 0)
  for (let i = 1; i < 4; i++) put(g, new CylinderGeometry(r + 0.06, r + 0.06, 0.35, 12), white, 0, (h * i) / 4, 0)
  const cap = put(g, new SphereGeometry(r * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, h, 0)
  cap.scale.y = 0.75
  g.position.set(x, 0, z)
  parent.add(g)
  solidPole(r, h, x, z)
}

// Round hay bale lying on its side (orange with a spiral face) and square bales.
let baleMats = null
function baleMaterials() {
  if (!baleMats) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#f2a23a'
    g.fillRect(0, 0, 64, 64)
    g.strokeStyle = '#c87818'
    g.lineWidth = 3
    g.beginPath()
    for (let a = 0; a < Math.PI * 8; a += 0.2) g.lineTo(32 + Math.cos(a) * a * 1.15, 32 + Math.sin(a) * a * 1.15)
    g.stroke()
    const face = new MeshStandardMaterial({ map: tex(c, 1, 1, 4), roughness: 0.9 })
    const side = new MeshStandardMaterial({ map: tex(paintWood('#f0a034', '#c87818', '#ffc060', 64, 11), 3, 1, 4), roughness: 0.95 })
    baleMats = [side, face, face]
  }
  return baleMats
}
export function roundBale(parent, x, y, z, yaw) {
  const m = new Mesh(new CylinderGeometry(0.9, 0.9, 1.3, 14), baleMaterials())
  m.rotation.set(Math.PI / 2, 0, yaw)
  m.position.set(x, y + 0.9, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
}
export function squareBale(parent, x, y, z, yaw) {
  const m = put(parent, box(1.6, 0.8, 0.9), mat('#f0a83a'), x, y + 0.4, z)
  m.rotation.y = yaw
}

// Windmill: a red lattice tower, a fan of lavender and white blades (spins), a tail vane.
function windmill(parent, x, z) {
  const g = new Group()
  const red = mat('#e8481e')
  const H = 13
  const base = 2.2
  const top = 0.5
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(g, new Vector3(sx * base, 0, sz * base), new Vector3(sx * top, H, sz * top), 0.3, red)
  for (let i = 1; i <= 4; i++) {
    const y = (H * i) / 5
    const w = base + (top - base) * (y / H)
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) beam(g, new Vector3(a[0] * w, y, a[1] * w), new Vector3(b[0] * w, y, b[1] * w), 0.18, red)
  }
  put(g, box(1.4, 1.0, 1.6), red, 0, H + 0.3, 0)
  const tail = put(g, box(0.15, 1.6, 3.2), mat('#f4f4f0'), 0, H + 0.6, -2.4)
  tail.castShadow = true
  const fan = new Group()
  fan.position.set(0, H + 0.5, 1.0)
  const bladeA = mat('#b8a6f6')
  const bladeB = mat('#f4f0ff')
  for (let i = 0; i < 18; i++) {
    const b = new Mesh(box(0.5, 3.3, 0.08), i % 2 ? bladeA : bladeB)
    const a = (i / 18) * Math.PI * 2
    b.position.set(Math.sin(a) * 2.1, Math.cos(a) * 2.1, 0)
    b.rotation.set(0, 0.35, -a)
    b.castShadow = true
    fan.add(b)
  }
  const hub = new Mesh(new CylinderGeometry(0.6, 0.6, 0.4, 12), mat('#e8481e'))
  hub.rotation.x = Math.PI / 2
  fan.add(hub)
  const tower = baked(g) // bake keeps g's children relative to g: place the result
  tower.position.set(x, 0, z)
  parent.add(tower)
  // the fan stays live so it can spin
  const fanRoot = new Group()
  fanRoot.position.set(x, 0, z)
  fanRoot.add(fan)
  parent.add(fanRoot)
  solidBox(1.4, 3, 1.4, x, 3, z)
  return fan
}

// Fallen log: a lying cylinder with pale cut ends.
export function log(parent, x, z, yaw, len = 4) {
  const end = mat('#e2b27a')
  const bark = mat('#8a5a2c')
  const m = new Mesh(new CylinderGeometry(0.55, 0.55, len, 10), [bark, end, end])
  m.rotation.set(0, yaw, Math.PI / 2)
  m.position.set(x, 0.55, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
}

// Scattered little red flowers.
export function flowers(parent, rand, area, count) {
  const g = new Group()
  const red = mat('#e8321e')
  const geo = box(0.32, 0.08, 0.12)
  for (let i = 0; i < count; i++) {
    const x = area.x0 + rand() * (area.x1 - area.x0)
    const z = area.z0 + rand() * (area.z1 - area.z0)
    const a = put(g, geo, red, x, 0.05, z, false)
    a.rotation.y = rand() * Math.PI
    const b = put(g, geo, red, x, 0.05, z, false)
    b.rotation.y = a.rotation.y + Math.PI / 2
  }
  parent.add(baked(g, false))
}

// --- The Forest zone ------------------------------------------------------------------
export function buildForest(root, zone) {
  const rand = mulberry32(31)
  const g = new Group()
  const rivers = zone.rivers.map((z) => buildRiver(root, z))
  const rz = zone.rivers[0]
  // Props stay on dry land inside the zone.
  const clear = (z) => z > zone.end + 3 && !rivers.some((r) => Math.abs(z - r.z) < r.half + 3)

  // Farm north of the river on the west side.
  barn(g, -22, rz - 22, 0.12)
  silo(g, -35.5, rz - 15, 2.7, 15)
  silo(g, -39.5, rz - 21, 2.5, 14)
  for (const [x, y, z, yaw] of [[-19, 0, rz - 13, 0.3], [-17, 0, rz - 14.5, 0.1], [-18, 1.7, rz - 13.8, 0.2], [-27, 0, rz - 12.5, 1.2], [-29, 0, rz - 14, 1.4], [-12, 0, rz - 18, 0.5]]) roundBale(g, x, y, z, yaw)
  for (const [x, y, z, yaw] of [[-21.5, 0, rz - 11.8, 0.2], [-21.5, 0.8, rz - 11.8, 0.25], [-14, 0, rz - 16, 1.1]]) squareBale(g, x, y, z, yaw)

  // Trees and pines: along both walls, round the farm and across the river.
  const leafSpots = [[-39, -9, 1.1], [-38, rz + 6, 1.3], [39, rz + 4, 1.2], [36, rz - 9, 1.2], [-6, rz - 30, 1.0], [10, rz - 42, 1.1], [32, rz - 30, 1.0], [-39, rz - 40, 1.0], [-30, rz - 52, 1.2], [26, rz - 55, 1.0]]
  for (const [x, z, s] of leafSpots) if (clear(z)) leafTree(g, x, z, s, rand)
  const pineSpots = [[-30, rz - 9, 1.0], [-14, rz - 9, 0.9], [-9, rz - 20, 1.0], [-32, rz - 35, 1.1], [38, rz - 6, 1.1], [30, rz - 14, 1.0], [20, rz - 18, 0.9], [-2, rz - 46, 1.0], [16, rz - 60, 1.1], [-20, rz - 48, 1.0], [37, rz - 42, 1.1]]
  for (const [x, z, s] of pineSpots) if (clear(z)) pine(g, x, z, s, rand)

  log(g, -37, -6, 0.3, 4.5)
  log(g, 34, rz + 7, 1.2, 3.5)
  flowers(g, rand, { x0: -W + 2, x1: W - 2, z0: zone.end + 4, z1: -3 }, 70)

  root.add(baked(g))
  const fan = windmill(root, 24, rz - 16)
  return {
    rivers,
    update(dt, elapsed) {
      fan.rotation.z = elapsed * 1.6
    },
  }
}

// --- Wheat field: a fenced plot of tall golden stalks ---------------------------------------
export function wheatField(parent, x, z, w, d, rand) {
  const g = new Group()
  const wm = mat('#8a5a2c')
  for (const s of [-1, 1]) {
    put(g, box(w, 0.16, 0.16), wm, 0, 0.75, s * (d / 2))
    put(g, box(w, 0.16, 0.16), wm, 0, 0.4, s * (d / 2))
    put(g, box(0.16, 0.16, d), wm, s * (w / 2), 0.75, 0)
    put(g, box(0.16, 0.16, d), wm, s * (w / 2), 0.4, 0)
  }
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) put(g, box(0.25, 1.1, 0.25), wm, -w / 2 + (i / 6) * w, 0.55, s * (d / 2))
  put(g, box(w - 0.4, 0.12, d - 0.4), mat('#7a4a20'), 0, 0.06, 0, false) // tilled soil
  const stalk = box(0.12, 1, 0.12)
  const head = box(0.2, 0.42, 0.2)
  const gold = mat('#f0b030')
  const goldDark = mat('#d88a18')
  for (let ix = 0; ix < Math.floor(w / 0.55); ix++) {
    for (let iz = 0; iz < Math.floor(d / 0.7); iz++) {
      const h = 0.9 + rand() * 0.6
      const sx = -w / 2 + 0.45 + ix * 0.55 + (rand() - 0.5) * 0.15
      const sz = -d / 2 + 0.45 + iz * 0.7 + (rand() - 0.5) * 0.15
      const st = put(g, stalk, rand() < 0.5 ? gold : goldDark, sx, h / 2, sz, false)
      st.scale.y = h
      st.rotation.z = (rand() - 0.5) * 0.3
      put(g, head, gold, sx, h + 0.15, sz, false)
    }
  }
  const b = baked(g)
  b.position.set(x, 0, z)
  parent.add(b)
  solidBox(w / 2, 0.8, d / 2, x, 0.8, z)
}

// --- Zone themes: ground slab, wall facings, snowy/flat props (used by themes.js) -------------
const slabMats = new Map()
function slabMat(ground) {
  const key = ground.join()
  if (!slabMats.has(key)) slabMats.set(key, new MeshStandardMaterial({ map: tex(paintStuds(ground[0], ground[1], ground[2], 4), 1, 1, 8), roughness: 0.9 }))
  return slabMats.get(key)
}

// A themed ground slab from z0 (south) to z1 (north), `step` m thick (0 = a flat skin
// just over the grass), cut open where rivers cross it.
export function themeSlab(root, z0, z1, rivers, ground, step) {
  const h = Math.max(step, 0.02)
  const cuts = rivers.map((r) => [r.z + r.half + LANE.river.curbWidth, r.z - r.half - LANE.river.curbWidth]).sort((a, b) => b[0] - a[0])
  let from = z0
  const pieces = []
  for (const [south, north] of cuts) {
    if (south < from && south > z1) pieces.push([from, south])
    from = Math.min(from, north)
  }
  pieces.push([from, z1])
  for (const [a, b] of pieces) {
    const len = a - b
    if (len <= 0.1) continue
    const m = slabMat(ground).clone()
    m.map = slabMat(ground).map.clone()
    m.map.repeat.set((W * 2) / (HUB.studSize * 4), len / (HUB.studSize * 4))
    m.map.needsUpdate = true
    const slab = new Mesh(box(W * 2, h, len), m)
    slab.position.set(0, h / 2, (a + b) / 2)
    slab.receiveShadow = true
    root.add(slab)
    if (step > 0.05) solidBox(W, step / 2, len / 2, 0, step / 2, (a + b) / 2)
  }
}

// Facings over the inner faces of both side walls, with a cap along the top.
// wall = [base, dark, light, cap].
export function wallFacing(root, z0, z1, wall) {
  const H = HUB.wall.height
  const len = z0 - z1
  const face = new MeshStandardMaterial({ map: tex(paintWall(wall[0], wall[1], wall[2], 256, 21), len / 6, H / 6), roughness: 0.9 })
  const cap = new MeshStandardMaterial({ color: wall[3], roughness: 0.85 })
  const t = HUB.wall.thick
  for (const s of [-1, 1]) {
    const f = new Mesh(box(0.24, H + 0.02, len), face)
    f.position.set(s * (W - 0.12), H / 2, (z0 + z1) / 2)
    f.receiveShadow = true
    root.add(f)
    const top = new Mesh(box(t + HUB.wall.overhang * 2 + 0.3, HUB.wall.grassLip + 0.12, len), cap)
    top.position.set(s * (W + t / 2 - 0.12), H + HUB.wall.grassLip / 2, (z0 + z1) / 2)
    top.receiveShadow = true
    root.add(top)
  }
}

// Snow-capped trees and pines, snowy rocks and drifts (standing on a slab `y` high).
export function snowyLeafTree(parent, x, z, s, rand, y = 0) {
  leafTree(parent, x, z, s, rand)
  const tree = parent.children[parent.children.length - 1]
  const cap = mat('#ffffff')
  for (const [cx, cy, cz, c] of [[0, 7.35, 0, 3.7], [0.2, 8.15, 0.3, 2.5], [-1.4, 6.35, 0.6, 2.6]]) {
    const m = put(tree, box(c * s, 0.5 * s, c * s), cap, cx * s, cy * s, cz * s)
    m.rotation.y = rand() * 0.6
  }
  tree.position.y = y
}
export function snowyPine(parent, x, z, s, rand, y = 0) {
  pine(parent, x, z, s, rand)
  const tree = parent.children[parent.children.length - 1]
  const cap = mat('#ffffff')
  for (let i = 0; i < 5; i++) {
    const w = (3.2 - i * 0.55) * s
    const m = put(tree, box(w * 0.92, 0.28 * s, w * 0.92), cap, 0, (1.4 + i * 1.15 + 1.32) * s, 0)
    m.rotation.y = i * 0.35
  }
  tree.position.y = y
}
export function rock(parent, x, z, s, rand, y = 0, colors = ['#8e8aa0', '#a6a2b8'], top = '#ffffff') {
  const g = new Group()
  const r1 = put(g, box(2.2 * s, 1.4 * s, 1.8 * s), mat(colors[0]), 0, 0.7 * s, 0)
  r1.rotation.y = rand()
  const r2 = put(g, box(1.4 * s, 1.0 * s, 1.3 * s), mat(colors[1]), 0.9 * s, 0.5 * s, 0.6 * s)
  r2.rotation.y = rand()
  if (top) put(g, box(2.0 * s, 0.3 * s, 1.6 * s), mat(top), 0, 1.5 * s, 0).rotation.y = r1.rotation.y
  g.position.set(x, y, z)
  parent.add(g)
  solidBox(1.1 * s, 1, 1 * s, x, 1, z)
}
export function drift(parent, x, z, s, y = 0, color = '#ffffff') {
  const m = put(parent, new SphereGeometry(1.6 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(color), x, y - 0.05, z)
  m.scale.y = 0.45
}

export function updateRivers(elapsed) {
  for (const t of riverTexs) t.offset.set(elapsed * 0.04, elapsed * 0.012)
  for (const t of fallTexs) t.offset.y = (elapsed * 1.2) % 1
}
