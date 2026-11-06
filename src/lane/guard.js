import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { GUARD, HUB } from '../config.js'
import { voxelGeometry, rainbowAt } from '../hub/voxel.js'
import { createEmitter } from '../particles.js'
import { mulberry32 } from '../textures.js'

// Zone guards: blocky voxel animals built from two recipes in GUARD[kind].build —
// a quadruped (bear, wolf, tiger, lion, panther, ankylosaurus, dragon, unicorn: body
// size, legs, head type, ears, tail, coat, mane, horn(s), wings, back plates, glowing
// eyes) and a bird (flamingo walking on long legs, phoenix flying on flapping wings
// with a fire trail). A guard roams its patch; told to chase (lane/index.js decides
// when) it rears / roars, then runs at the player, wading rivers, inside its z range,
// until it catches them or is told to give up. Nose along +Z, like the player.
// createGuard(parent, fx, def, range) -> { group, kind, state, chasing, position,
//   chase(), giveUp(), update(dt, elapsed, target, rivers, groundAt) -> 'caught' | null }

const sq = (v) => v * v
const VS = 0.2 // m per voxel before the model is scaled to its length
const mats = new Map()
const mat = (color, extra) => {
  const k = color + JSON.stringify(extra ?? {})
  if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color, roughness: 0.9, ...extra }))
  return mats.get(k)
}
function box(parent, sx, sy, sz, material, x, y, z) {
  const m = new Mesh(new BoxGeometry(sx, sy, sz), material)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}

function coat(C, b, x, y, z, bx, by, bz) {
  if (b.pattern === 'stripes' && (z + Math.floor(y / 3)) % 4 === 0 && y > 1) return C.dark
  if (b.pattern === 'spots' && (x * 5 + y * 7 + z * 3) % 7 === 0) return C.dark
  if (b.pattern === 'saddle' && y > by - 3) return C.dark
  if (b.pattern === 'armour' && y > by - 4) return (x + z) % 3 === 0 ? C.dark : C.body
  if (y < 2 || (b.chest && z > bz - 5 && y < 5)) return C.light
  return (x * 3 + y * 5 + z * 7) % 11 === 0 ? C.light : C.body
}

// --- Four legs --------------------------------------------------------------------------------
function quadruped(kind) {
  const C = GUARD[kind]
  const b = C.build
  const g = new Group()
  const fur = new MeshStandardMaterial(b.gummy ? { vertexColors: true, roughness: 0.15, transparent: true, opacity: 0.88, emissive: C.body, emissiveIntensity: 0.25 } : { vertexColors: true, roughness: 0.95 })
  const [bx, by, bz] = b.body
  const legH = b.legH
  const bodyY = legH + (by * VS) / 2 - 0.1
  const front = (bz * VS) / 2

  const body = voxelGeometry(
    bx,
    by,
    bz,
    (x, y, z) => {
      const dx = (x + 0.5 - bx / 2) / (bx / 2)
      const dy = (y + 0.5 - by / 2) / (by / 2 - 0.2)
      const dz = (z + 0.5 - bz / 2) / (bz / 2)
      if (sq(dx) + sq(dy) + sq(dz) * 0.9 > 1) return null
      if (b.mane && b.mane !== 'rainbow' && z > bz - 6) return C.mane
      return coat(C, b, x, y, z, bx, by, bz)
    },
    { size: VS, jitter: b.gummy ? 0.04 : 0.14, seed: bz * 3 + bx, centerY: true },
  )
  const bodyMesh = new Mesh(body, fur)
  bodyMesh.position.set(0, bodyY, 0)
  bodyMesh.castShadow = true
  g.add(bodyMesh)

  // Back plates (ankylosaurus) or a ridge of spikes (dragon).
  if (b.plates) {
    for (let i = 0; i < 9; i++) {
      for (const s of [-1, 0, 1]) {
        const p = new Mesh(new ConeGeometry(0.16, 0.42, 4), mat(i % 2 ? C.dark : b.plates))
        p.position.set(s * 0.55, bodyY + (by * VS) / 2 - 0.05 - Math.abs(s) * 0.25, -front + 0.4 + i * ((front * 2 - 0.8) / 8))
        p.rotation.z = -s * 0.6
        p.castShadow = true
        g.add(p)
      }
    }
  }
  if (b.ridge) for (let i = 0; i < 7; i++) {
    const p = new Mesh(new ConeGeometry(0.14, 0.45, 4), mat(b.ridge))
    p.position.set(0, bodyY + (by * VS) / 2 + 0.1, -front + 0.6 + i * ((front * 2 - 1.2) / 6))
    g.add(p)
  }

  // Head (on a raised neck for horse-like builds)
  const neck = new Group()
  neck.position.set(0, bodyY + (b.neck ? 0.4 : by * VS * 0.3), front + (b.neck ? -0.2 : 0.05))
  g.add(neck)
  if (b.neck) {
    const n = box(neck, bx * VS * 0.5, 1.6, 0.8, b.gummy ? fur : mat(C.body), 0, 0.7, 0.3) // plain box: no vertex colours, so not the fur material
    n.rotation.x = 0.45
  }
  const head = new Group()
  head.position.set(0, b.neck ? 1.5 : 0, b.neck ? 0.9 : 0)
  neck.add(head)
  const snout = b.head === 'snout'
  const [hx, hy, hz] = snout ? [6, 6, 10] : [7, 7, 8]
  const hg = voxelGeometry(
    hx,
    hy,
    hz,
    (x, y, z) => {
      if (snout) {
        const skull = sq((x + 0.5 - 3) / 3) + sq((y + 0.5 - 3.3) / 2.8) + sq((z + 0.5 - 3) / 3) <= 1
        const muzzle = z >= 4 && z <= 9 && y >= 1 && y <= 3 && x >= 1 && x <= 4
        if (!skull && !muzzle) return null
        if (muzzle) {
          if (b.teeth && y === 1 && z > 5 && (x === 1 || x === 4) && z % 2 === 0) return '#ffffff'
          return z === 9 && y >= 2 && (x === 2 || x === 3) ? C.nose : y <= 1 || z > 6 ? C.light : C.body
        }
        if (z >= 4 && y === 4 && (x === 0 || x === 5)) return b.eyes ?? '#1a1a20'
        return y < 2 ? C.light : C.body
      }
      const dx = (x + 0.5 - 3.5) / 3.5
      const dy = (y + 0.5 - 3.4) / 3.2
      const dz = (z + 0.5 - 3.4) / 3.4
      const inHead = sq(dx) + sq(dy) + sq(dz) <= 1
      const muzzle = z >= 5 && z <= 7 && y >= 1 && y <= 3 && x >= 2 && x <= 4
      if (!inHead && !muzzle) return null
      if (muzzle) return z === 7 && y >= 2 && x === 3 ? C.nose : C.light
      if (z >= 5 && y === 4 && (x === 1 || x === 5)) return b.eyes ?? '#101010'
      if (b.mane && b.mane !== 'rainbow' && z < 3) return C.mane
      if (b.pattern === 'stripes' && y > 4 && (x === 2 || x === 4)) return C.dark
      return C.body
    },
    { size: VS, jitter: b.gummy ? 0.04 : 0.12, seed: hz * 5, centerY: true },
  )
  const headMesh = new Mesh(hg, fur)
  headMesh.castShadow = true
  head.add(headMesh)
  if (b.ears && b.ears !== 'none') {
    for (const s of [-1, 1]) {
      const pointed = b.ears === 'pointed'
      box(head, pointed ? 0.26 : 0.34, pointed ? 0.5 : 0.34, pointed ? 0.18 : 0.2, mat(C.dark), s * (pointed ? 0.36 : 0.5), pointed ? 0.75 : 0.72, pointed ? -0.25 : -0.1)
    }
  }
  if (b.horn) {
    // Unicorn horn: a twisted golden spike.
    const h = new Mesh(new ConeGeometry(0.16, 1.1, 6), mat(b.horn, { emissive: b.horn, emissiveIntensity: 0.4 }))
    h.position.set(0, 0.9, 0.45)
    h.rotation.x = 0.5
    head.add(h)
  }
  if (b.horns) {
    for (const s of [-1, 1]) {
      const h = new Mesh(new ConeGeometry(0.14, 0.8, 5), mat(b.horns))
      h.position.set(s * 0.35, 0.85, -0.45)
      h.rotation.set(-0.7, 0, s * 0.3)
      head.add(h)
    }
  }
  if (b.mane === 'rainbow') {
    // Rainbow mane down the neck and over the forehead.
    for (let i = 0; i < 7; i++) box(neck, 0.3, 0.42, 0.42, mat(rainbowAt(i / 7)), 0, 0.2 + i * 0.22, -0.15 + i * 0.13)
    box(head, 0.5, 0.25, 0.35, mat(rainbowAt(0.1)), 0, 0.72, -0.2)
  } else if (b.mane) {
    const ring = box(head, 1.9, 1.9, 0.7, mat(C.mane, { roughness: 1 }), 0, 0.05, -0.55)
    ring.castShadow = true
  }
  if (b.eyes && b.eyes !== '#101010') {
    const glowMat = new MeshStandardMaterial({ color: b.eyes, emissive: b.eyes, emissiveIntensity: 3 })
    for (const s of [-1, 1]) {
      const e = new Mesh(new BoxGeometry(0.16, 0.12, 0.06), glowMat)
      e.position.set(s * 0.62, 0.15, 0.55)
      head.add(e)
    }
  }

  // Wings (dragon): two folded bat wings that open when it roars.
  const wings = []
  if (b.wings) {
    for (const s of [-1, 1]) {
      const w = new Group()
      w.position.set(s * (bx * VS) / 2, bodyY + 0.5, 0.4)
      box(w, 0.2, 0.2, 2.6, mat(C.dark), s * 0.2, 0.4, -0.6).rotation.x = -0.4
      const membrane = box(w, 0.08, 2.2, 2.4, mat(b.wings), s * 0.25, 1.1, -0.7)
      membrane.rotation.x = -0.4
      w.rotation.z = s * 0.25
      g.add(w)
      wings.push({ w, s })
    }
  }

  // Tail
  let tail = null
  if (b.tail && b.tail !== 'none') {
    tail = new Group()
    tail.position.set(0, bodyY + 0.2, -front + 0.1)
    if (b.tail === 'thick' || b.tail === 'club' || b.tail === 'long') {
      const n = b.tail === 'long' ? 6 : 4
      for (let i = 0; i < n; i++) {
        const w = (b.tail === 'long' ? 0.55 : 0.75) - i * (b.tail === 'long' ? 0.07 : 0.15)
        box(tail, w, w * 0.8, 0.85, mat(i % 2 ? C.dark : C.body), 0, -0.15 - i * 0.05, -0.45 - i * 0.8)
      }
      if (b.tail === 'club') box(tail, 0.9, 0.7, 0.8, mat(C.dark), 0, -0.4, -3.6)
      if (b.tail === 'long') box(tail, 0.5, 0.15, 0.6, mat(b.ridge ?? C.dark), 0, -0.45, -5.1).rotation.y = Math.PI / 4
    } else if (b.tail === 'bushy') {
      const t1 = box(tail, 0.42, 0.42, 1.1, mat(C.body), 0, -0.25, -0.5)
      t1.rotation.x = 0.55
      const t2 = box(tail, 0.36, 0.36, 0.4, mat(C.light), 0, -0.62, -1.02)
      t2.rotation.x = 0.55
    } else if (b.tail === 'rainbow') {
      for (let i = 0; i < 6; i++) {
        const t = box(tail, 0.22, 1.3, 0.22, mat(rainbowAt(i / 6)), (i - 2.5) * 0.12, -0.6, -0.35)
        t.rotation.x = 0.5
      }
    } else {
      const t1 = box(tail, 0.16, 0.16, 1.5, mat(C.dark), 0, 0.1, -0.7)
      t1.rotation.x = -0.35
      if (b.tuft) box(tail, 0.32, 0.32, 0.32, mat(C.mane ?? C.dark), 0, 0.35, -1.45)
    }
    g.add(tail)
  }

  // Legs: pivots at hips and shoulders.
  const legMat = b.gummy ? fur : mat(b.legs ?? C.body, { roughness: 0.95 })
  const legW = b.legW
  const legGeo = new BoxGeometry(legW, legH, legW * 1.1)
  legGeo.translate(0, -legH / 2, 0)
  const pawGeo = new BoxGeometry(legW * 1.15, 0.2, legW * 1.4)
  pawGeo.translate(0, -legH + 0.03, 0.06)
  const pawMat = b.gummy ? fur : mat(b.paws ?? C.dark, { roughness: 0.95 })
  const legs = []
  const lx = (bx * VS) / 2 - legW / 2
  const lz = front * 0.62
  for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const pivot = new Group()
    pivot.position.set(x, legH + 0.05, z)
    const leg = new Mesh(legGeo, legMat)
    const paw = new Mesh(pawGeo, pawMat)
    leg.castShadow = paw.castShadow = true
    pivot.add(leg, paw)
    g.add(pivot)
    legs.push(pivot)
  }
  const scale = C.length / (bz * VS + (b.tail === 'long' ? 3 : 0.8))
  g.scale.setScalar(scale)
  const root = new Group()
  root.add(g)
  return { root, body: g, head: neck, legs, tail, wings, biped: false, flying: false }
}

// --- Birds: flamingo (walks) and phoenix (flies) --------------------------------------------------
function bird(kind) {
  const C = GUARD[kind]
  const b = C.build
  const g = new Group()
  const fly = !!b.flying
  const legH = b.legH
  const plum = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...(fly ? { emissive: '#ff5a00', emissiveIntensity: 0.35 } : {}) })
  const [bx, by, bz] = b.body
  const bodyY = fly ? 0 : legH + (by * VS) / 2 - 0.2
  const body = voxelGeometry(
    bx,
    by,
    bz,
    (x, y, z) => {
      const d = sq((x + 0.5 - bx / 2) / (bx / 2)) + sq((y + 0.5 - by / 2) / (by / 2)) + sq((z + 0.5 - bz / 2) / (bz / 2))
      if (d > 1) return null
      return y < by / 2 - 1 ? C.light : (x + y + z) % 5 === 0 ? C.dark : C.body
    },
    { size: VS, jitter: 0.1, seed: 71, centerY: true },
  )
  const bm = new Mesh(body, plum)
  bm.position.y = bodyY
  bm.castShadow = true
  g.add(bm)

  // Neck + head + beak
  const head = new Group()
  const front = (bz * VS) / 2
  if (fly) {
    head.position.set(0, bodyY + 0.3, front + 0.4)
    box(head, 0.7, 0.7, 0.8, mat(C.body, { emissive: C.body, emissiveIntensity: 0.3 }), 0, 0, 0)
    box(head, 0.25, 0.25, 0.6, mat(b.beak), 0, -0.05, 0.6)
    for (let i = 0; i < 3; i++) box(head, 0.12, 0.5, 0.12, mat(C.light), (i - 1) * 0.18, 0.5, -0.2).rotation.x = -0.6 // crest
  } else {
    // Flamingo: an S-curved neck of blocks rising from the front of the body.
    head.position.set(0, bodyY + 0.2, front - 0.1)
    const pts = [[0, 0.3, 0.1], [0, 0.7, 0.35], [0, 1.1, 0.3], [0, 1.5, 0.05], [0, 1.9, 0.0], [0, 2.25, 0.2]]
    for (const [x, y, z] of pts) box(head, 0.32, 0.45, 0.32, mat(C.body), x, y, z)
    box(head, 0.55, 0.45, 0.6, mat(C.body), 0, 2.5, 0.35)
    box(head, 0.2, 0.2, 0.55, mat(C.light), 0, 2.45, 0.85)
    box(head, 0.18, 0.18, 0.3, mat(b.beak), 0, 2.32, 1.1)
    for (const s of [-1, 1]) box(head, 0.06, 0.1, 0.1, mat('#101010'), s * 0.28, 2.6, 0.45)
  }
  g.add(head)

  // Wings
  const wings = []
  for (const s of [-1, 1]) {
    const w = new Group()
    w.position.set(s * (bx * VS) / 2 - s * 0.1, bodyY + 0.25, 0)
    const span = b.wingspan / 2
    const feathers = fly ? [C.body, C.dark, C.light, '#ffe23a'] : [C.body, C.light, C.dark]
    for (let i = 0; i < feathers.length; i++) {
      const f = box(w, span * (1 - i * 0.18), 0.12, 0.9 - i * 0.1, mat(feathers[i], fly ? { emissive: feathers[i], emissiveIntensity: 0.35 } : {}), s * (span * (1 - i * 0.18)) / 2, 0, -0.3 - i * 0.55)
      f.castShadow = true
    }
    if (!fly) w.rotation.z = s * 1.2 // folded against the body
    g.add(w)
    wings.push({ w, s })
  }

  // Tail feathers
  const tail = new Group()
  tail.position.set(0, bodyY + 0.1, -front + 0.1)
  const tailColors = fly ? [C.body, '#ffe23a', C.dark, C.light] : [C.dark, C.body]
  tailColors.forEach((c, i) => {
    const t = box(tail, 0.35, 0.1, fly ? 2.6 - i * 0.3 : 0.8, mat(c, fly ? { emissive: c, emissiveIntensity: 0.4 } : {}), (i - (tailColors.length - 1) / 2) * 0.3, 0, -(fly ? 1.2 : 0.4))
    t.rotation.x = fly ? 0.15 : -0.3
  })
  g.add(tail)

  // Legs: two long thin legs (tucked up in flight)
  const legs = []
  for (const s of [-1, 1]) {
    const pivot = new Group()
    pivot.position.set(s * 0.35, bodyY - (by * VS) / 2 + 0.2, 0)
    const len = fly ? 0.7 : legH
    box(pivot, 0.14, len, 0.14, mat(b.legs), 0, -len / 2, 0)
    box(pivot, 0.35, 0.08, 0.5, mat(b.legs), 0, -len, 0.12)
    if (fly) pivot.rotation.x = 1.2
    g.add(pivot)
    legs.push(pivot)
  }
  if (fly) {
    // A trail of embers streaming off the phoenix.
    createEmitter(g, { boxes: [{ x: 0, y: 0, z: -front, sx: 0.6, sy: 0.3, sz: 0.6 }], count: 36, life: 0.9, velocity: [0, 0.6, -2.2], spread: [0.6, 0.4, 0.6], size: 0.45, grow: 0.3, color: '#ffa21a', intensity: 3, seed: 13 })
    createEmitter(g, { boxes: [{ x: 0, y: 0, z: 0, sx: b.wingspan / 2, sy: 0.2, sz: 0.6 }], count: 24, life: 0.7, velocity: [0, 0.8, 0], spread: [0.3, 0.3, 0.3], size: 0.3, color: '#ffe23a', intensity: 3.2, twinkle: 8, sprite: 'sparkle', seed: 17 })
  }
  const scale = C.length / (bz * VS + (fly ? 2.4 : 0.6))
  g.scale.setScalar(scale)
  const root = new Group()
  root.add(g)
  return { root, body: g, head, legs, tail, wings, biped: true, flying: fly, hover: b.hover ?? 0 }
}

// chaseSpeed (m/s): the zone's (speed.js guardSpeed); setChase(v, free) changes it per frame and
// `free` lets it run north of its range (an under-speed player is chased until caught).
export function createGuard(parent, fx, def, range, chaseSpeed) {
  const C = GUARD[def.kind]
  const m = C.build.type === 'bird' ? bird(def.kind) : quadruped(def.kind)
  parent.add(m.root)
  const rand = mulberry32(def.kind.length * 31 + Math.round(def.home.z))
  const home = def.home
  const pos = { x: home.x, z: home.z }
  let facing = Math.PI
  let state = 'roam'
  let stateTime = 0
  let target = null
  let pause = 0
  let phase = 0
  let speed = 0
  let splashTimer = 0
  const maxX = HUB.halfWidth - 2
  let free = false
  let wide = false // pursuing a fish carrier: may follow them south through other zones up to the finish line

  const pickRoam = () => ({ x: home.x + (rand() * 2 - 1) * def.roam.hx, z: Math.max(range.minZ, Math.min(range.maxZ, home.z + (rand() * 2 - 1) * def.roam.hz)) })
  const set = (s) => {
    state = s
    stateTime = 0
  }

  function moveToward(tx, tz, v, dt) {
    const dx = tx - pos.x
    const dz = tz - pos.z
    const d = Math.hypot(dx, dz)
    const want = Math.atan2(dx, dz)
    const diff = Math.atan2(Math.sin(want - facing), Math.cos(want - facing))
    facing += Math.sign(diff) * Math.min(Math.abs(diff), dt * 6)
    const step = Math.min(d, v * dt * Math.max(0.25, Math.cos(diff)))
    pos.x = Math.max(-maxX, Math.min(maxX, pos.x + Math.sin(facing) * step))
    // North limit: the range, or the lane's end while chasing free; never pulled back south of it.
    // (south limit: the range, or the finish line while pursuing a carrier; never pulled back by the clamp)
    pos.z = Math.max(free || wide ? HUB.laneEnd : Math.min(range.minZ, pos.z), Math.min(wide ? -1.5 : Math.max(range.maxZ, pos.z), pos.z + Math.cos(facing) * step))
    speed = step / Math.max(dt, 1e-4)
    return d
  }

  return {
    group: m.root,
    kind: def.kind,
    get state() {
      return state
    },
    get chasing() {
      return state === 'roar' || state === 'chase'
    },
    position: pos,
    setChase(v, unbounded, pursuit = false) {
      chaseSpeed = v
      free = unbounded
      wide = pursuit
    },
    chase() {
      if (state === 'roam' || state === 'return') set('roar')
    },
    giveUp() {
      if (state === 'chase' || state === 'roar' || state === 'swipe') set('return')
    },
    update(dt, elapsed, player, rivers, groundAt) {
      stateTime += dt
      speed = 0
      let result = null
      let rear = 0
      if (state === 'roam') {
        if (pause > 0) pause -= dt
        else {
          target ??= pickRoam()
          if (moveToward(target.x, target.z, C.walkSpeed, dt) < 0.5) {
            target = null
            pause = 1 + rand() * 2.5
          }
        }
      } else if (state === 'roar') {
        const want = Math.atan2(player.x - pos.x, player.z - pos.z)
        facing += Math.atan2(Math.sin(want - facing), Math.cos(want - facing)) * Math.min(1, dt * 8)
        rear = Math.sin(Math.min(1, stateTime / C.roar) * Math.PI)
        if (stateTime >= C.roar) set('chase')
      } else if (state === 'chase') {
        const d = moveToward(player.x, player.z, chaseSpeed, dt)
        if (d < C.catchRadius) {
          result = 'caught'
          set('swipe')
        }
      } else if (state === 'swipe') {
        rear = Math.sin(Math.min(1, stateTime / 0.5) * Math.PI) * 0.6
        if (stateTime > 0.7) set('return')
      } else if (state === 'return') {
        if (moveToward(home.x, home.z, C.walkSpeed * 2.2, dt) < 1) {
          set('roam')
          target = null
        }
      }

      // Pose
      phase += speed * dt * (m.biped ? 1.8 : 1.4)
      const amp = Math.min(0.8, speed * 0.09)
      const s = Math.sin(phase)
      if (m.biped) {
        if (!m.flying) {
          m.legs[0].rotation.x = s * amp
          m.legs[1].rotation.x = -s * amp
          m.head.rotation.x = Math.sin(phase * 2) * 0.08 * Math.min(1, speed / 3) - rear * 0.3
        }
        // Wings: the phoenix beats them all the time (harder when chasing);
        // the flamingo flaps them open when it rears up.
        const beat = m.flying ? 0.55 + (state === 'chase' ? 0.25 : 0) : rear * 0.9
        const rate = m.flying ? (state === 'chase' ? 9 : 5) : 14
        for (const { w, s: side } of m.wings) w.rotation.z = side * (m.flying ? Math.sin(elapsed * rate) * beat : 1.2 - beat * (0.6 + 0.4 * Math.sin(elapsed * rate)))
        m.body.rotation.x = m.flying ? -0.12 * Math.min(1, speed / 6) : -rear * 0.2
      } else {
        m.legs[0].rotation.x = s * amp
        m.legs[3].rotation.x = s * amp
        m.legs[1].rotation.x = -s * amp
        m.legs[2].rotation.x = -s * amp
        const bodyRear = C.rear ?? 0.5
        m.body.rotation.x = -rear * bodyRear
        m.body.position.y = Math.abs(Math.cos(phase)) * amp * 0.15 + rear * bodyRear * 0.8
        m.head.rotation.x = -rear * 0.6 + Math.sin(elapsed * 1.3) * 0.05
        for (const { w, s: side } of m.wings) w.rotation.z = side * (0.25 + rear * 1.1 + (state === 'chase' ? Math.sin(elapsed * 10) * 0.25 : 0))
      }
      m.head.rotation.y = state === 'roam' ? Math.sin(elapsed * 0.7) * 0.35 : 0
      if (m.tail) m.tail.rotation.y = Math.sin(elapsed * (speed > 1 ? 9 : 2.5)) * (speed > 1 ? 0.25 : 0.4)

      // Height: wading sinks a walker; a flyer hovers and bobs.
      const inWater = rivers.some((r) => Math.abs(pos.z - r.z) < r.half)
      const ground = groundAt ? groundAt(pos.z) : 0
      const y = m.flying ? ground + m.hover + Math.sin(elapsed * 2.2) * 0.35 : inWater ? -0.35 : ground
      m.root.position.set(pos.x, y, pos.z)
      m.root.rotation.y = facing
      splashTimer -= dt
      if (!m.flying && inWater && speed > 1 && splashTimer <= 0) {
        splashTimer = 0.08
        fx.burst({ x: pos.x, y: 0.15, z: pos.z }, { kind: 'glow', count: 6, color: '#c8f6ff', speed: 2.5, up: 4, size: 0.3, life: 0.6, gravity: 12, spread: 1.2 })
      } else if (!m.flying && !inWater && speed > 6 && splashTimer <= 0) {
        splashTimer = 0.12
        fx.burst({ x: pos.x, y: ground + 0.1, z: pos.z }, { kind: 'puff', count: 3, color: C.dust ?? '#eef6ff', speed: 1, up: 0.8, size: 0.6, grow: 2.2, life: 0.7, gravity: 0, spread: 1 })
      }
      if (state === 'roar' && stateTime < dt * 1.5) {
        fx.burst({ x: pos.x + Math.sin(facing) * 2, y: y + 2.4, z: pos.z + Math.cos(facing) * 2 }, { kind: C.roarFx ?? 'puff', count: 12, color: C.roarColor ?? '#ffffff', speed: 2.5, up: 1, size: 0.5, grow: 2, life: 0.6, gravity: 0 })
      }
      return result
    },
  }
}
