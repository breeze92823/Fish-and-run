import { BackSide, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, SRGBColorSpace } from 'three'
import { createEmitter } from '../particles.js'
import { neon, put, solidBox, solidPole } from '../propkit.js'
import { mulberry32 } from '../textures.js'
import {
  W,
  baked,
  box,
  buildRiver,
  drift,
  leafTree,
  leaves,
  mat,
  pine,
  rock,
  silo,
  snowyLeafTree,
  snowyPine,
  themeSlab,
  wallFacing,
  wheatField,
} from './scenery.js'

// Zones 2+ of the lane, each dressed from its ZONES[i].theme to match the reference:
// a ground slab and wall facings in the zone's colours, its river (water + curb
// colours, tunnels or waterfalls), blocky set dressing (props), raised octagon plates,
// and looping ambient particles. Everything sits in one group per zone so the lane
// can hide zones far from the player.
// buildThemedZone(parent, zone) -> { group, rivers, groundAt(z), update(dt, elapsed) }

// --- Placement helpers ------------------------------------------------------------------------
function scatter(rand, zone, rivers, n, fn, { sides = true, margin = 3, inner = 9 } = {}) {
  const z0 = (zone.theme.from ?? zone.start) - 3
  const z1 = zone.end + 3
  let placed = 0
  for (let tries = 0; placed < n && tries < n * 6; tries++) {
    const z = z0 - rand() * (z0 - z1)
    if (rivers.some((r) => Math.abs(z - r.z) < r.half + margin)) continue
    const x = sides ? (rand() < 0.5 ? -1 : 1) * (inner + rand() * (W - inner - 3)) : -W + 4 + rand() * (W * 2 - 8)
    fn(x, z, placed)
    placed++
  }
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)]

// Raised octagon plate (desert / cave / coral / sakura ground detail): a low 8-sided
// slab in the ground colour with a darker rim and a lighter border ring.
function plate(g, x, z, r, colors) {
  put(g, new CylinderGeometry(r + 0.7, r + 0.9, 0.12, 8), mat(colors[1]), x, 0.06, z, false).rotation.y = Math.PI / 8
  const top = put(g, new CylinderGeometry(r, r, 0.32, 8), mat(colors[0]), x, 0.16, z, false)
  top.rotation.y = Math.PI / 8
  top.receiveShadow = true
  solidPole(r * 0.92, 0.32, x, z)
}

// --- Trees ---------------------------------------------------------------------------------
function palm(g, x, z, s, rand, y = 0) {
  const t = new Group()
  const trunkA = mat('#b8743a')
  const trunkB = mat('#9a5a28')
  const lean = (rand() - 0.5) * 0.6
  for (let i = 0; i < 8; i++) {
    const seg = put(t, box((0.95 - i * 0.04) * s, 1.1 * s, (0.95 - i * 0.04) * s), i % 2 ? trunkA : trunkB, Math.sin(i * 0.22) * lean * 3.2 * s, (0.55 + i * 1.02) * s, 0)
    seg.rotation.z = -lean * 0.35
  }
  const topX = Math.sin(1.6) * lean * 3.2 * s
  const fronds = [mat('#a8d82a'), mat('#86c018'), mat('#c4e84a')]
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const f = new Group()
    f.position.set(topX, 8.3 * s, 0)
    f.rotation.y = a
    for (let k = 0; k < 4; k++) {
      const leaf = put(f, box((1.3 - k * 0.15) * s, 0.16 * s, 1.15 * s), fronds[(i + k) % 3], 0, -k * 0.38 * s, (0.6 + k * 1.05) * s)
      leaf.rotation.x = 0.28 + k * 0.08
    }
    t.add(f)
  }
  for (let i = 0; i < 3; i++) put(t, new SphereGeometry(0.32 * s, 6, 4), mat('#6a4a1a'), topX + Math.cos(i * 2) * 0.4 * s, 7.9 * s, Math.sin(i * 2) * 0.4 * s)
  t.position.set(x, y, z)
  g.add(t)
  solidPole(0.6 * s, 4, x, z)
}

// Blocky canopy tree: a trunk with heaped leaf cubes (jungle green / swamp olive).
function canopyTree(g, x, z, s, rand, leafMats, trunk = '#7a4a24', roots = false) {
  const t = new Group()
  const tm = mat(trunk)
  put(t, box(1.1 * s, 7 * s, 1.1 * s), tm, 0, 3.5 * s, 0)
  if (roots) for (const [rx, rz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(t, box(0.4 * s, 1.6 * s, 0.4 * s), tm, rx * 0.9 * s, 0.6 * s, rz * 0.9 * s).rotation.set(rz * 0.6, 0, -rx * 0.6)
  const clumps = [[0, 8.2, 0, 5.4], [-2.4, 7.4, 1, 3.8], [2.2, 7.6, -1, 4], [0.4, 10, 0.4, 3.6], [1.2, 9, 2, 3], [-1.5, 9.2, -1.6, 3]]
  for (const [cx, cy, cz, c] of clumps) {
    const m = put(t, box(c * s, c * 0.62 * s, c * s), pick(rand, leafMats), cx * s, cy * s, cz * s)
    m.rotation.y = rand() * 0.8
  }
  t.position.set(x, 0, z)
  g.add(t)
  solidPole(0.8 * s, 6, x, z)
}

function fern(g, x, z, s, rand, color = '#3aa82a') {
  const f = new Group()
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand()
    const l = put(f, box(0.45 * s, 0.1 * s, 2 * s), mat(color), Math.sin(a) * 0.8 * s, 0.6 * s, Math.cos(a) * 0.8 * s, false)
    l.rotation.set(-0.5, a, 0)
  }
  f.position.set(x, 0, z)
  g.add(f)
}

function blueRock(g, x, z, s, rand, color = '#5a7ad8') {
  put(g, box(1.6 * s, 0.6 * s, 1.2 * s), mat(color), x, 0.3 * s, z).rotation.y = rand()
  put(g, box(1.0 * s, 0.45 * s, 0.9 * s), mat('#7a9af0'), x + 0.2 * s, 0.75 * s, z + 0.1 * s).rotation.y = rand()
}

// --- Desert ----------------------------------------------------------------------------------
function cactus(g, x, z, s, rand) {
  const c = new Group()
  const green = mat('#4aa83a')
  const spot = mat('#e8f8d0')
  put(c, box(1.1 * s, 5.5 * s, 1.1 * s), green, 0, 2.75 * s, 0)
  for (const side of [-1, 1]) {
    if (rand() < 0.3) continue
    const h = (2 + rand() * 1.5) * s
    put(c, box(1.4 * s, 0.75 * s, 0.75 * s), green, side * 0.9 * s, h, 0)
    put(c, box(0.75 * s, 2.2 * s, 0.75 * s), green, side * 1.5 * s, h + 1.1 * s, 0)
  }
  for (let i = 0; i < 10; i++) put(c, box(0.14, 0.14, 0.14), spot, (rand() < 0.5 ? -1 : 1) * 0.56 * s, (0.5 + rand() * 5) * s, (rand() - 0.5) * 0.9 * s, false)
  c.position.set(x, 0, z)
  c.rotation.y = rand() * Math.PI
  g.add(c)
  solidPole(0.6 * s, 4, x, z)
}

// Tall pale sand spire (the desert's termite-mound / bone spikes), banded rings.
function sandSpire(g, x, z, s, rand) {
  const t = new Group()
  const a = mat('#f4dcb0')
  const b = mat('#e2c08a')
  const n = 6
  for (let i = 0; i < n; i++) {
    const r = (1.0 - i * 0.15) * s
    put(t, new CylinderGeometry(r * 0.85, r, 1.4 * s, 6), i % 2 ? a : b, 0, (0.7 + i * 1.35) * s, 0)
  }
  put(t, new ConeGeometry(0.2 * s, 1.6 * s, 6), a, 0, (n * 1.35 + 0.5) * s, 0)
  t.position.set(x, 0, z)
  t.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3)
  g.add(t)
  solidPole(0.9 * s, 4, x, z)
}

// --- Cave ------------------------------------------------------------------------------------------
// A big flat crystal shard (neon, glows with bloom) with a dark outline shell.
const outlineMat = new MeshBasicMaterial({ color: '#101018', side: BackSide })
function crystalShard(g, x, z, s, rand, colors) {
  const c = new Group()
  for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
    const color = pick(rand, colors)
    const geo = new OctahedronGeometry(1, 0)
    const shard = new Mesh(geo, neon(color, 1.5))
    const h = (2.6 + rand() * 1.8) * s
    shard.scale.set((1.0 + rand() * 0.5) * s, h, 0.35 * s)
    shard.position.set((rand() - 0.5) * 2.2 * s, h * 0.85, (rand() - 0.5) * 1.2 * s)
    shard.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.7)
    const edge = new Mesh(geo, outlineMat)
    edge.scale.setScalar(1.08)
    shard.add(edge)
    c.add(shard)
  }
  c.position.set(x, 0, z)
  g.add(c)
  solidPole(1.4 * s, 3, x, z)
}

function stoneSpire(g, x, z, s, rand) {
  put(g, new CylinderGeometry(1.5 * s, 1.8 * s, 0.6 * s, 6), mat('#4a5a82'), x, 0.3 * s, z)
  const sp = put(g, new ConeGeometry(0.9 * s, (8 + rand() * 4) * s, 5), mat('#2c3a64'), x, (4.6 + rand()) * s, z)
  sp.rotation.set((rand() - 0.5) * 0.2, rand(), (rand() - 0.5) * 0.2)
  solidPole(0.9 * s, 4, x, z)
}

// --- Coral -------------------------------------------------------------------------------------------
function coralBranch(g, x, z, s, rand, color) {
  const c = new Group()
  const m = mat(color)
  const grow = (px, py, pz, h, d) => {
    put(c, box(0.5 * s, h * s, 0.5 * s), m, px, py + (h * s) / 2, pz)
    if (d > 0) for (const sgn of [-1, 1]) grow(px + sgn * 0.75 * s, py + h * s * 0.7, pz + (rand() - 0.5) * 0.8 * s, h * 0.72, d - 1)
  }
  grow(0, 0, 0, 3.2, 2)
  c.position.set(x, 0, z)
  c.rotation.y = rand() * Math.PI
  g.add(c)
  solidPole(0.9 * s, 3, x, z)
}
function seaweed(g, x, z, s, rand) {
  const c = mat(pick(rand, ['#c8f020', '#a8e018', '#d8f84a']))
  for (let i = 0; i < 7; i++) put(g, box(0.5 * s, 1.0 * s, 0.5 * s), c, x + Math.sin(i * 0.7) * 0.4 * s, (0.5 + i) * s, z + Math.cos(i * 0.5) * 0.2 * s)
}
function barrelSponge(g, x, z, s, rand) {
  const color = pick(rand, ['#ff8a2a', '#ffd23a', '#3a8aff', '#5ad83a', '#b05aff', '#ff4a6a'])
  put(g, new CylinderGeometry(1.0 * s, 0.8 * s, 1.6 * s, 10, 1, true), mat(color, { side: 2 }), x, 0.8 * s, z)
  put(g, new CylinderGeometry(0.75 * s, 0.75 * s, 0.05, 10), mat('#3a2010'), x, 1.35 * s, z, false)
  solidPole(0.9 * s, 1.6, x, z)
}
function brainCoral(g, x, z, s, color) {
  const m = put(g, new SphereGeometry(1.3 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(color), x, 0, z)
  m.scale.y = 0.75
}
function starfish(g, x, z, rand) {
  const c = pick(rand, ['#ff7a3a', '#ffd23a', '#ff5a8a'])
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    put(g, box(0.25, 0.12, 0.9), mat(c), x + Math.sin(a) * 0.4, 0.06, z + Math.cos(a) * 0.4, false).rotation.y = a
  }
}

// --- Mushroom ----------------------------------------------------------------------------------------
// Giant voxel-ish mushroom: a cream stem and a stepped dome cap with white spots.
function giantMushroom(g, x, z, s, rand, color) {
  const t = new Group()
  const stem = mat('#f4ead0')
  put(t, box(1.3 * s, 5 * s, 1.3 * s), stem, 0, 2.5 * s, 0)
  const cap = mat(color)
  const dot = mat('#ffffff')
  const tiers = [[6.2, 0.9], [5.4, 0.8], [4.2, 0.7], [2.6, 0.6]]
  let y = 5 * s
  for (const [w, h] of tiers) {
    put(t, box(w * s, h * s, w * s), cap, 0, y + (h * s) / 2, 0)
    y += h * s
  }
  for (let i = 0; i < 12; i++) {
    const tier = Math.floor(rand() * 3)
    const w = tiers[tier][0] * s
    const ty = 5 * s + tiers.slice(0, tier).reduce((a, [, h]) => a + h * s, 0)
    const side = Math.floor(rand() * 4)
    const k = (rand() - 0.5) * w * 0.7
    const px = side === 0 ? w / 2 : side === 1 ? -w / 2 : k
    const pz = side === 2 ? w / 2 : side === 3 ? -w / 2 : k
    put(t, box(0.6 * s, 0.5 * s, 0.6 * s), dot, px, ty + 0.4 * s, pz, false)
  }
  for (let i = 0; i < 4; i++) put(t, box(0.7 * s, 0.2 * s, 0.7 * s), dot, (rand() - 0.5) * 2 * s, y + 0.05, (rand() - 0.5) * 2 * s, false)
  t.position.set(x, 0, z)
  t.rotation.y = rand() * Math.PI
  g.add(t)
  solidPole(0.9 * s, 4, x, z)
}
function mushroomHouse(g, x, z, s, rand, color) {
  const t = new Group()
  put(t, new CylinderGeometry(2.2 * s, 2.5 * s, 4 * s, 12), mat('#f6ecd4'), 0, 2 * s, 0)
  put(t, box(1.1 * s, 2 * s, 0.3 * s), mat('#8a4a24'), 0, 1 * s, 2.35 * s) // door
  const win = new Mesh(new CylinderGeometry(0.45 * s, 0.45 * s, 0.2, 10), neon('#ffd88a', 1.8))
  win.rotation.x = Math.PI / 2
  win.position.set(1.1 * s, 2.8 * s, 2.05 * s)
  t.add(win)
  const cap = new Mesh(new SphereGeometry(3.4 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(color))
  cap.position.y = 3.8 * s
  cap.scale.y = 0.7
  cap.castShadow = true
  t.add(cap)
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2
    put(t, box(0.6 * s, 0.25 * s, 0.6 * s), mat('#ffffff'), Math.sin(a) * 2.2 * s, 5.3 * s, Math.cos(a) * 2.2 * s, false)
  }
  t.position.set(x, 0, z)
  t.rotation.y = Math.atan2(-x, 0) // doors face the lane
  g.add(t)
  solidPole(2.3 * s, 4, x, z)
}
// Bent wooden lamp post with a glowing lantern.
function lampPost(g, x, z) {
  const wood = mat('#8a5a2a')
  put(g, box(0.3, 4, 0.3), wood, x, 2, z)
  put(g, box(1.4, 0.25, 0.25), wood, x + 0.6, 3.9, z)
  const lamp = new Mesh(box(0.45, 0.6, 0.45), neon('#ffd88a', 2.6))
  lamp.position.set(x + 1.2, 3.35, z)
  g.add(lamp)
  solidPole(0.25, 3, x, z)
}

// --- Sakura -------------------------------------------------------------------------------------------
function sakuraTree(g, x, z, s, rand) {
  const t = new Group()
  const trunk = mat('#c8783a')
  put(t, box(1.0 * s, 5 * s, 1.0 * s), trunk, 0, 2.5 * s, 0)
  for (const sg of [-1, 1]) put(t, box(0.55 * s, 3 * s, 0.55 * s), trunk, sg * 1.0 * s, 5.1 * s, 0).rotation.z = -sg * 0.6
  const pinks = [mat('#fbe4ee'), mat('#f8d4e4'), mat('#ffeef4')]
  for (const [cx, cy, cz, c] of [[0, 7, 0, 5.2], [-2.6, 6.2, 0.8, 3.8], [2.6, 6.4, -0.6, 4], [0.3, 8.6, 0.2, 3.4], [-0.8, 5.8, -2.2, 3.2], [1.4, 6, 2.2, 3]]) {
    const m = put(t, box(c * s, c * 0.72 * s, c * s), pick(rand, pinks), cx * s, cy * s, cz * s)
    m.rotation.y = rand()
  }
  t.position.set(x, 0, z)
  t.rotation.y = rand() * Math.PI
  g.add(t)
  solidPole(0.6 * s, 4, x, z)
}
function torii(g, z) {
  const red = mat('#d8261a')
  const black = mat('#1e1a1a')
  for (const s of [-1, 1]) {
    put(g, box(0.9, 9, 0.9), red, s * 7, 4.5, z)
    put(g, box(1.3, 0.6, 1.3), black, s * 7, 0.3, z)
    solidBox(0.45, 4.5, 0.45, s * 7, 4.5, z)
    // hanging lanterns
    put(g, box(0.06, 1, 0.06), black, s * 4, 7.6, z)
    const l = new Mesh(new SphereGeometry(0.45, 8, 6), neon('#ff3a2a', 1.8))
    l.position.set(s * 4, 6.8, z)
    l.scale.y = 1.25
    g.add(l)
  }
  const top = put(g, box(18, 0.9, 1.3), black, 0, 9.4, z)
  top.rotation.z = 0
  for (const s of [-1, 1]) put(g, box(1.6, 0.7, 1.3), black, s * 9.4, 9.7, z) // upturned ends
  put(g, box(16, 0.7, 1.0), red, 0, 8.6, z)
  put(g, box(14, 0.5, 0.8), red, 0, 7.0, z)
  put(g, box(0.6, 1.6, 0.6), red, 0, 7.8, z)
}
function pagoda(g, x, z, s) {
  const red = mat('#d8261a')
  const roof = mat('#2e9a5a')
  const trim = mat('#ffd23a')
  let y = 0
  for (let i = 0; i < 3; i++) {
    const w = (4.2 - i * 0.9) * s
    put(g, box(w, 2.2 * s, w), red, x, y + 1.1 * s, z)
    for (let k = 0; k < 4; k++) put(g, box(0.18 * s, 1.8 * s, w * 0.9), mat('#7a1410'), x + (k - 1.5) * w * 0.25, y + 1.1 * s, z + w / 2 + 0.05, false)
    put(g, box(w + 2.4 * s, 0.5 * s, w + 2.4 * s), roof, x, y + 2.45 * s, z)
    put(g, box(w + 2.6 * s, 0.15 * s, w + 2.6 * s), trim, x, y + 2.2 * s, z, false)
    y += 2.7 * s
  }
  put(g, new ConeGeometry(0.4 * s, 1.6 * s, 6), trim, x, y + 0.8 * s, z)
  const lantern = new Mesh(new SphereGeometry(0.4 * s, 8, 6), neon('#ff3a2a', 1.8))
  lantern.position.set(x + 2.6 * s, 1.8 * s, z + 2.6 * s)
  g.add(lantern)
  solidBox(2.1 * s, 3, 2.1 * s, x, 3, z)
}
function stoneLantern(g, x, z) {
  const stone = mat('#b8b4a8')
  put(g, box(0.8, 0.3, 0.8), stone, x, 0.15, z)
  put(g, box(0.35, 1.4, 0.35), stone, x, 1, z)
  put(g, box(0.9, 0.8, 0.9), stone, x, 2.1, z)
  const light = new Mesh(box(0.55, 0.45, 0.95), neon('#ffd88a', 2.4))
  light.position.set(x, 2.1, z)
  g.add(light)
  put(g, new ConeGeometry(0.85, 0.6, 4), stone, x, 2.8, z).rotation.y = Math.PI / 4
  solidPole(0.45, 2.5, x, z)
}
function bamboo(g, x, z, rand) {
  for (let i = 0; i < 5; i++) {
    const h = 6 + rand() * 4
    const bx = x + (rand() - 0.5) * 1.6
    const bz = z + (rand() - 0.5) * 1.6
    for (let k = 0; k < h; k += 1.2) put(g, box(0.28, 1.1, 0.28), mat(k % 2.4 < 1.2 ? '#4ab82a' : '#3a9a22'), bx, k + 0.55, bz, false)
  }
  solidPole(0.9, 4, x, z)
}

// --- Candy -----------------------------------------------------------------------------------------------
const swirlTex = new Map()
function swirl(color) {
  if (!swirlTex.has(color)) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = color
    for (let i = 0; i < 8; i += 2) {
      g.beginPath()
      g.moveTo(64, 64)
      for (let a = 0; a <= Math.PI * 2.2; a += 0.08) {
        const r = a * 9
        g.lineTo(64 + Math.cos(a + (i * Math.PI) / 4) * r, 64 + Math.sin(a + (i * Math.PI) / 4) * r)
      }
      for (let a = Math.PI * 2.2; a >= 0; a -= 0.08) {
        const r = a * 9
        g.lineTo(64 + Math.cos(a + ((i + 1) * Math.PI) / 4) * r, 64 + Math.sin(a + ((i + 1) * Math.PI) / 4) * r)
      }
      g.fill()
    }
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    swirlTex.set(color, new MeshStandardMaterial({ map: t, roughness: 0.3 }))
  }
  return swirlTex.get(color)
}
function lollipop(g, x, z, s, rand) {
  const color = pick(rand, ['#ff2a3a', '#2a8aff', '#ffd21a', '#a83aff', '#3ac83a'])
  put(g, box(0.28 * s, 6.5 * s, 0.28 * s), mat('#ffffff'), x, 3.25 * s, z)
  const disc = new Mesh(new CylinderGeometry(2.1 * s, 2.1 * s, 0.5 * s, 24), [mat(color), swirl(color), swirl(color)])
  disc.rotation.set(Math.PI / 2, 0, rand() * Math.PI)
  disc.position.set(x, 7.4 * s, z)
  disc.castShadow = true
  g.add(disc)
  solidPole(0.4 * s, 4, x, z)
}
function candyCane(g, x, z, s, rand) {
  const a = mat(pick(rand, ['#ff2a3a', '#3ac83a', '#ffd21a']))
  const white = mat('#ffffff')
  for (let i = 0; i < 7; i++) put(g, box(0.6 * s, 1 * s, 0.6 * s), i % 2 ? a : white, x, (0.5 + i) * s, z)
  for (let i = 0; i < 5; i++) {
    const t = (i / 4) * Math.PI
    put(g, box(0.6 * s, 0.6 * s, 0.6 * s), i % 2 ? white : a, x + (1 - Math.cos(t)) * 0.9 * s, (7 + Math.sin(t) * 0.9) * s, z)
  }
  solidPole(0.4 * s, 4, x, z)
}
function gumdrop(g, x, z, s, rand) {
  const m = new Mesh(new SphereGeometry(1.2 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(pick(rand, ['#ff3a6a', '#3ad8ff', '#a8ff3a', '#ffd23a', '#ff8a2a', '#c86aff']), { roughness: 0.25 }))
  m.position.set(x, 0, z)
  m.scale.y = 1.2
  m.castShadow = true
  g.add(m)
}
// Tiered "cake tree": stacked purple frosting layers with white rims.
function cakeTree(g, x, z, s) {
  const purple = mat('#b88ae8')
  const white = mat('#fff4ff')
  for (let i = 0; i < 5; i++) {
    const r = (2.2 - i * 0.38) * s
    put(g, new CylinderGeometry(r * 0.9, r, 0.9 * s, 12), purple, x, (0.5 + i * 1.0) * s, z)
    put(g, new CylinderGeometry(r * 0.92, r * 0.92, 0.18 * s, 12), white, x, (0.98 + i * 1.0) * s, z, false)
  }
  put(g, new SphereGeometry(0.4 * s, 8, 6), mat('#ff3a6a'), x, 5.4 * s, z)
  solidPole(1.8 * s, 3, x, z)
}
function iceCream(g, x, z, s, rand) {
  const cone = new Mesh(new ConeGeometry(1.1 * s, 3.4 * s, 10), mat('#e8b060'))
  cone.rotation.x = Math.PI
  cone.position.set(x, 1.7 * s, z)
  cone.castShadow = true
  g.add(cone)
  put(g, new SphereGeometry(1.2 * s, 10, 8), mat(pick(rand, ['#ffb0d8', '#fff4d8', '#a8ffd0', '#8a4a2a'])), x, 3.9 * s, z)
  solidPole(0.9 * s, 3, x, z)
}
function gingerbreadHouse(g, x, z, s, rand) {
  const t = new Group()
  const gb = mat('#b8602a')
  const icing = mat('#ffffff')
  const roofMat = mat(pick(rand, ['#ff6ab0', '#e83a5a', '#ff8ad0']))
  put(t, box(5 * s, 3.4 * s, 4.2 * s), gb, 0, 1.7 * s, 0)
  for (const sg of [-1, 1]) {
    const r = put(t, box(3.1 * s, 0.4 * s, 4.8 * s), roofMat, sg * 1.25 * s, 4.25 * s, 0)
    r.rotation.z = -sg * 0.62
    put(t, box(3.2 * s, 0.25 * s, 0.25 * s), icing, sg * 1.25 * s, 4.0 * s, 2.45 * s).rotation.z = -sg * 0.62
  }
  put(t, box(1.2 * s, 2 * s, 0.2 * s), mat('#ff4a6a'), 0, 1 * s, 2.15 * s) // door
  for (let i = 0; i < 6; i++) put(t, new SphereGeometry(0.28 * s, 6, 4), mat(pick(rand, ['#ff3a6a', '#3ad8ff', '#ffd23a', '#a8ff3a'])), (rand() - 0.5) * 4 * s, (0.6 + rand() * 2.4) * s, 2.15 * s, false)
  put(t, box(5.1 * s, 0.25 * s, 4.3 * s), icing, 0, 3.4 * s, 0)
  t.position.set(x, 0, z)
  t.rotation.y = Math.atan2(-x, 0)
  g.add(t)
  solidBox(2.6 * s, 2, 2.2 * s, x, 2, z, t.rotation.y)
}
function chocolateBar(g, x, z, s, rand) {
  const c = new Group()
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) put(c, box(1.1 * s, 0.4 * s, 1.1 * s), mat('#6a3a1a'), (i - 1) * 1.2 * s, 0.3 * s, (k - 0.5) * 1.2 * s)
  put(c, box(3.8 * s, 0.2 * s, 2.6 * s), mat('#4a2810'), 0, 0.1 * s, 0)
  c.position.set(x, 0, z)
  c.rotation.set(0.3, rand() * Math.PI, 0)
  g.add(c)
}

// --- Ambient particles ----------------------------------------------------------------------
const AMBIENT = {
  snow: { colors: ['#ffffff'], velocity: [0.35, -1.5, 0.1], spread: [0.5, 0.3, 0.5], life: 8, size: 0.22, intensity: 1.2, count: 280, y: [1, 15] },
  fireflies: { colors: ['#d8ff5a', '#fff07a'], velocity: [0, 0.25, 0], spread: [0.5, 0.4, 0.5], life: 4, size: 0.2, intensity: 3, twinkle: 6, count: 150, y: [0.5, 4] },
  dust: { colors: ['#fff0b0'], velocity: [2.4, 0.15, 0], spread: [1, 0.3, 0.6], life: 6, size: 0.4, intensity: 0.7, opacity: 0.6, count: 150, y: [0.3, 5] },
  crystal: { colors: ['#8ae8ff', '#ff8af0', '#b0ff8a'], sprite: 'sparkle', velocity: [0, 0.45, 0], spread: [0.2, 0.2, 0.2], life: 4, size: 0.32, intensity: 3, twinkle: 4, count: 170, y: [0.5, 8] },
  bubbles: { colors: ['#c8f8ff'], velocity: [0, 1.1, 0], spread: [0.3, 0.3, 0.3], life: 6, size: 0.26, intensity: 1.4, count: 170, y: [0.2, 4] },
  spores: { colors: ['#e8a8ff', '#a8ffd0', '#ffd0f0'], velocity: [0, 0.4, 0], spread: [0.4, 0.2, 0.4], life: 6, size: 0.22, intensity: 2.6, twinkle: 3, count: 220, y: [0.3, 7] },
  petals: { colors: ['#ffc0dc', '#ffe0ee', '#ffb0d0'], velocity: [0.8, -1.0, 0.3], spread: [0.6, 0.3, 0.6], life: 9, size: 0.3, intensity: 1.2, count: 260, y: [2, 12] },
  sprinkles: { colors: ['#ff3a6a', '#3ad8ff', '#a8ff3a', '#ffd23a', '#c86aff'], sprite: 'sparkle', velocity: [0, -0.8, 0], spread: [0.3, 0.2, 0.3], life: 8, size: 0.26, intensity: 2.2, twinkle: 6, count: 240, y: [2, 12] },
}

function ambient(group, zone, kind) {
  const A = AMBIENT[kind]
  if (!A) return
  const z0 = zone.theme.from ?? zone.start
  const z1 = zone.end
  const boxes = A.colors.map((color) => ({ x: 0, y: (A.y[0] + A.y[1]) / 2, z: (z0 + z1) / 2, sx: W - 2, sy: (A.y[1] - A.y[0]) / 2, sz: (z0 - z1) / 2, color }))
  createEmitter(group, { boxes, count: A.count, life: A.life, velocity: A.velocity, spread: A.spread, size: A.size, color: A.colors[0], intensity: A.intensity, opacity: A.opacity ?? 1, twinkle: A.twinkle ?? 0, sprite: A.sprite ?? 'dot', seed: Math.abs(zone.start) })
}

// --- Per-zone set dressing ------------------------------------------------------------------------
const PROPS = {
  winter(g, zone, rivers, rand, T) {
    const y = T.step
    // The grass strip past the Forest: a fenced wheat field, a silo, a few trees.
    wheatField(g, -20, zone.start - 12, 13, 9, rand)
    silo(g, -32, zone.start - 14, 2.2, 12)
    for (const [x, z] of [[-39, zone.start - 6], [38, zone.start - 10], [5, zone.start - 22]]) leafTree(g, x, z, 1.0, rand)
    for (const [x, z] of [[-10, zone.start - 22], [26, zone.start - 18]]) pine(g, x, z, 1.0, rand)
    scatter(rand, zone, rivers, 20, (x, z) => (rand() < 0.6 ? snowyPine(g, x, z, 0.9 + rand() * 0.4, rand, y) : snowyLeafTree(g, x, z, 0.9 + rand() * 0.3, rand, y)))
    scatter(rand, zone, rivers, 5, (x, z) => rock(g, x, z, 0.9 + rand() * 0.4, rand, y))
    scatter(rand, zone, rivers, 10, (x, z) => drift(g, x, z, 0.6 + rand() * 0.8, y), { sides: false })
  },
  jungle(g, zone, rivers, rand) {
    const lm = [leaves(), mat('#2e9a1a'), mat('#3cb024')]
    scatter(rand, zone, rivers, 10, (x, z) => canopyTree(g, x, z, 0.9 + rand() * 0.4, rand, lm))
    scatter(rand, zone, rivers, 12, (x, z) => palm(g, x, z, 0.9 + rand() * 0.3, rand))
    scatter(rand, zone, rivers, 8, (x, z) => pine(g, x, z, 1 + rand() * 0.3, rand))
    scatter(rand, zone, rivers, 24, (x, z) => fern(g, x, z, 0.8 + rand() * 0.6, rand), { sides: false })
    scatter(rand, zone, rivers, 5, (x, z) => plate(g, x, z, 3 + rand() * 2, ['#5cd61c', '#8a2a1a']), { inner: 14 })
  },
  desert(g, zone, rivers, rand, T) {
    scatter(rand, zone, rivers, 9, (x, z) => plate(g, x, z, 3.5 + rand() * 3, T.plate), { sides: false, margin: 6 })
    scatter(rand, zone, rivers, 14, (x, z) => palm(g, x, z, 0.9 + rand() * 0.3, rand))
    scatter(rand, zone, rivers, 10, (x, z) => sandSpire(g, x, z, 0.9 + rand() * 0.5, rand))
    scatter(rand, zone, rivers, 12, (x, z) => cactus(g, x, z, 0.7 + rand() * 0.4, rand))
  },
  swamp(g, zone, rivers, rand) {
    const lm = [mat('#7a7a1a'), mat('#8a8a24'), mat('#6a6a14')]
    scatter(rand, zone, rivers, 16, (x, z) => canopyTree(g, x, z, 0.9 + rand() * 0.4, rand, lm, '#6a4a24', true))
    scatter(rand, zone, rivers, 10, (x, z) => blueRock(g, x, z, 0.8 + rand() * 0.5, rand), { sides: false })
    scatter(rand, zone, rivers, 20, (x, z) => fern(g, x, z, 0.7 + rand() * 0.5, rand, '#6a7a1a'), { sides: false })
    scatter(rand, zone, rivers, 30, (x, z) => {
      const h = 1.4 + rand() * 1.4
      put(g, box(0.09, h, 0.09), mat('#4a7a2a'), x, h / 2, z, false)
      put(g, box(0.18, 0.5, 0.18), mat('#6a3a1a'), x, h - 0.2, z, false)
    }, { sides: false, margin: 1 })
  },
  cave(g, zone, rivers, rand, T) {
    scatter(rand, zone, rivers, 8, (x, z) => plate(g, x, z, 3.5 + rand() * 3, T.plate), { sides: false, margin: 6 })
    scatter(rand, zone, rivers, 12, (x, z) => crystalShard(g, x, z, 1 + rand() * 0.8, rand, ['#3aff4a', '#ff2a9a', '#ffa21a', '#ffe21a', '#2a8aff', '#b03aff']))
    scatter(rand, zone, rivers, 14, (x, z) => stoneSpire(g, x, z, 0.8 + rand() * 0.6, rand))
    scatter(rand, zone, rivers, 6, (x, z) => blueRock(g, x, z, 1 + rand() * 0.6, rand, '#4a5a8a'), { sides: false })
  },
  coral(g, zone, rivers, rand, T) {
    scatter(rand, zone, rivers, 8, (x, z) => plate(g, x, z, 3.5 + rand() * 3, T.plate), { sides: false, margin: 6 })
    const colors = ['#ff3a3a', '#ff6ab0', '#c8f020', '#b05aff', '#3a8aff', '#ff9a6a']
    scatter(rand, zone, rivers, 18, (x, z) => coralBranch(g, x, z, 0.9 + rand() * 0.6, rand, pick(rand, colors)))
    scatter(rand, zone, rivers, 14, (x, z) => seaweed(g, x, z, 0.8 + rand() * 0.5, rand))
    scatter(rand, zone, rivers, 12, (x, z) => barrelSponge(g, x, z, 0.8 + rand() * 0.6, rand))
    scatter(rand, zone, rivers, 6, (x, z) => brainCoral(g, x, z, 0.8 + rand() * 0.6, pick(rand, colors)), { sides: false })
    scatter(rand, zone, rivers, 12, (x, z) => starfish(g, x, z, rand), { sides: false, margin: 1 })
    scatter(rand, zone, rivers, 8, (x, z) => blueRock(g, x, z, 0.7 + rand() * 0.5, rand), { sides: false })
  },
  mushroom(g, zone, rivers, rand) {
    const caps = ['#e8221a', '#a83ae8', '#2a7aff', '#ff8a1a', '#ffd21a']
    scatter(rand, zone, rivers, 16, (x, z) => giantMushroom(g, x, z, 0.8 + rand() * 0.7, rand, pick(rand, caps)))
    scatter(rand, zone, rivers, 5, (x, z) => mushroomHouse(g, x, z, 0.9 + rand() * 0.3, rand, pick(rand, caps)), { inner: 16 })
    scatter(rand, zone, rivers, 8, (x, z) => lampPost(g, x, z), { inner: 7 })
    scatter(rand, zone, rivers, 10, (x, z) => blueRock(g, x, z, 0.7, rand), { sides: false })
    scatter(rand, zone, rivers, 16, (x, z) => fern(g, x, z, 0.7, rand, '#4aa83a'), { sides: false })
  },
  sakura(g, zone, rivers, rand, T) {
    scatter(rand, zone, rivers, 6, (x, z) => plate(g, x, z, 4 + rand() * 3, T.plate), { inner: 12 })
    scatter(rand, zone, rivers, 16, (x, z) => sakuraTree(g, x, z, 0.9 + rand() * 0.4, rand))
    torii(g, zone.start - 10)
    torii(g, zone.start - 52)
    scatter(rand, zone, rivers, 3, (x, z) => pagoda(g, x, z, 1 + rand() * 0.2), { inner: 18 })
    for (const z of [zone.start - 18, zone.start - 36, zone.start - 66]) for (const s of [-1, 1]) stoneLantern(g, s * 9, z)
    scatter(rand, zone, rivers, 6, (x, z) => bamboo(g, x, z, rand))
  },
  candy(g, zone, rivers, rand) {
    scatter(rand, zone, rivers, 6, (x, z) => gingerbreadHouse(g, x, z, 1 + rand() * 0.3, rand), { inner: 16 })
    scatter(rand, zone, rivers, 12, (x, z) => lollipop(g, x, z, 0.9 + rand() * 0.4, rand))
    scatter(rand, zone, rivers, 8, (x, z) => candyCane(g, x, z, 0.9 + rand() * 0.4, rand))
    scatter(rand, zone, rivers, 10, (x, z) => cakeTree(g, x, z, 0.8 + rand() * 0.5))
    scatter(rand, zone, rivers, 16, (x, z) => gumdrop(g, x, z, 0.6 + rand() * 0.6, rand), { sides: false })
    scatter(rand, zone, rivers, 5, (x, z) => iceCream(g, x, z, 1, rand))
    scatter(rand, zone, rivers, 5, (x, z) => chocolateBar(g, x, z, 1, rand), { sides: false })
    scatter(rand, zone, rivers, 6, (x, z) => lampPost(g, x, z), { inner: 7 })
  },
}

export function buildThemedZone(parent, zone) {
  const T = zone.theme
  const group = new Group()
  group.name = `zone-${zone.id}`
  parent.add(group)
  const rand = mulberry32(Math.abs(zone.start) * 13 + 5)
  const rivers = zone.rivers.map((z) => buildRiver(group, z, { inset: 0.3, color: T.water, curb: T.curb, waterfall: T.waterfall }))
  const from = T.from ?? zone.start
  themeSlab(group, from, zone.end, rivers, T.ground, T.step)
  wallFacing(group, from, zone.end, T.wall)
  const g = new Group()
  PROPS[T.props]?.(g, zone, rivers, rand, T)
  group.add(baked(g))
  ambient(group, zone, T.ambient)
  return {
    group,
    rivers,
    groundAt: (z) => (z <= from && z >= zone.end ? T.step : 0),
    update() {},
  }
}
