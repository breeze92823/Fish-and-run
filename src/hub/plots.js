import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Plane, Vector3 } from 'three'
import { BASE, FISH, PLOT, PLOTS, TREADMILLS } from '../config.js'
import { RAPIER, addFixed, world } from '../physics.js'
import { yawQuat } from '../propkit.js'
import { fishMesh } from './fish.js'
import { removeEmitter } from '../particles.js'
import { paintCaustics, tex } from './paint.js'
import { buildTreadmill, buildUpgradeSign, houseIcon, ownerTag } from './props.js'
import { buildDecor } from './baseDecor.js'

// Player plots: a fenced plot with a gate in its front fence, a deck to walk on and a pond
// where the owner's fish swim, the owner's head tag floating over it, and (base level 2+) a
// treadmill + its Upgrade sign in front. What the fence, deck and pond look like follows the
// owner's base level (BASE.levels -> tier, drawn by baseDecor.js), always inside the plot's
// own footprint. The plot's local frame: length along X, front (toward the hub centre) = +Z;
// the deck runs along the inside of the front fence, the pond fills the rest.

let waterTex = null
let waterMat = null
function poolWater() {
  if (!waterMat) {
    const Wt = PLOT.water
    waterTex = tex(paintCaustics(Wt.color, Wt.light, Wt.deep), PLOT.pool.length / 7, PLOT.pool.width / 7, 8)
    waterMat = new MeshStandardMaterial({ map: waterTex, roughness: 0.12, metalness: 0, emissive: '#18c8f0', emissiveIntensity: 0.28 })
  }
  return waterMat
}

// Local (lx, lz) of a plot -> world (x, z).
function toWorld(def, lx, lz) {
  const c = Math.cos(def.facing)
  const s = Math.sin(def.facing)
  return [def.x + lx * c + lz * s, def.z - lx * s + lz * c]
}

const L = PLOT.pool.length
const W = PLOT.pool.width
const D = PLOT.deck
const B = PLOT.fence.border
const DIMS = { L, W, D, b: B, gate: PLOT.gate }
const POND = { x0: -L / 2, x1: L / 2, z0: -W / 2, z1: W / 2 - D, y: 0.14 } // plot-local water rectangle
const tierOf = (level) => BASE.levels[Math.max(0, Math.min(BASE.levels.length - 1, (level || 1) - 1))].tier

// One swimming fish: a Lissajous loop inside the pond, nose along its velocity.
function swimmer(id, i, L, W) {
  const g = fishMesh(id)
  const size = FISH[id].size
  const big = size > W * 0.6
  const rx = Math.max(0.4, L / 2 - size * 0.45 - 0.4)
  const rz = big ? Math.max(0.2, W / 2 - size * 0.12 - 1.5) : Math.max(0.3, W / 2 - size * 0.4 - 0.4)
  const speed = big ? 0.12 + (i % 3) * 0.02 : 0.25 + ((i * 37) % 10) * 0.02
  return { g, rx, rz, w: speed, p1: i * 1.9, p2: i * 2.7, ratio: big ? 0.5 : 0.7 + (i % 3) * 0.13, h: g.userData.height, upright: FISH[id].shape === 'seahorse' }
}

function buildPlot(scene, def) {
  const root = new Group()
  root.position.set(def.x, 0, def.z)
  root.rotation.y = def.facing
  scene.add(root)

  // The pond: the rest of the fenced area behind the deck.
  const water = new Mesh(new PlaneGeometry(L, POND.z1 - POND.z0), poolWater())
  water.rotation.x = -Math.PI / 2
  water.position.set(0, POND.y, (POND.z0 + POND.z1) / 2)
  water.receiveShadow = true
  root.add(water)

  // Colliders (world space): the fence with its gate, and the pond (tall enough that a jump
  // can't land on it), so you walk in through the gate onto the deck up to the water.
  const yaw = def.facing
  const h = 1.6
  const full = L + B * 2
  const g = PLOT.gate
  const leftLen = g.x - g.width / 2 + full / 2
  const rightLen = full / 2 - (g.x + g.width / 2)
  const box = (lx, lz, hx, hy, hz) => {
    const [x, z] = toWorld(def, lx, lz)
    return addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y: hy, z }, yawQuat(yaw))
  }
  box(0, -(W / 2 + B / 2), full / 2, h / 2, B / 2) // back
  box(-(L / 2 + B / 2), 0, B / 2, h / 2, W / 2) // sides
  box(L / 2 + B / 2, 0, B / 2, h / 2, W / 2)
  box(-full / 2 + leftLen / 2, W / 2 + B / 2, leftLen / 2, h / 2, B / 2) // front, either side of the gate
  box(full / 2 - rightLen / 2, W / 2 + B / 2, rightLen / 2, h / 2, B / 2)
  box(0, (POND.z0 + POND.z1) / 2, L / 2, 1.1, (POND.z1 - POND.z0) / 2) // the pond

  // Treadmill + its Upgrade sign in front of the fence, off to one side: built now, shown
  // (with colliders) from base tier 1.
  const plot = { def, root, fish: [], treadmill: null, sign: null, house: null, tag: null, look: 'stone', key: null, decor: null, tier: -1, mill: false, millColliders: [] }
  const tz = W / 2 + B + PLOT.treadmillGap
  plot.treadmill = buildTreadmill('stone')
  plot.treadmill.group.position.set(-L * 0.18, 0, tz)
  plot.treadmill.belt = 0
  plot.treadmill.group.visible = false
  root.add(plot.treadmill.group)
  plot.sign = buildUpgradeSign()
  plot.sign.group.position.set(-L * 0.18 + 2.1, 0, tz - 1.6)
  plot.sign.group.rotation.y = -0.3
  plot.sign.group.visible = false
  root.add(plot.sign.group)
  plot.treadmillAt = { lx: -L * 0.18, lz: tz } // plot-local centre (the console is at -Z)
  plot.millBoxes = () => [
    [-L * 0.18, tz, 1.05, 0.17, 2.6], // base (low enough to step onto)
    [-L * 0.18, tz - 2.25, 1.05, 1.2, 0.35], // console
  ].map(([lx, lz, hx, hy, hz]) => box(lx, lz, hx, hy, hz))
  return plot
}

function dropEmitters(group) {
  const points = []
  group.traverse((o) => o.isPoints && points.push(o))
  for (const pt of points) removeEmitter(pt)
}

// The fence / deck / decorations of base tier `tier`.
function setTier(p, tier) {
  if (tier === p.tier) return
  p.tier = tier
  if (p.decor) {
    dropEmitters(p.decor.group)
    p.root.remove(p.decor.group)
    p.decor.group.traverse((o) => o.isMesh && o.geometry.dispose())
  }
  p.decor = buildDecor(tier, DIMS)
  p.root.add(p.decor.group)
}

// The treadmill (and sign) shown with their colliders, or hidden without them.
function setMill(p, on) {
  if (on === p.mill) return
  p.mill = on
  p.treadmill.group.visible = on
  p.sign.group.visible = on
  if (on) p.millColliders = p.millBoxes()
  else {
    for (const c of p.millColliders) world.removeCollider(c, false)
    p.millColliders = []
  }
}

// The pond's swimmers: species ids, best first.
function setFish(p, ids) {
  for (const f of p.fish) {
    dropEmitters(f.g)
    p.root.remove(f.g)
  }
  p.fish = ids.filter((id) => FISH[id]).map((id, i) => {
    const s = swimmer(id, i, L, POND.z1 - POND.z0)
    p.root.add(s.g)
    return s
  })
}

// Swaps the plot's treadmill model for another TREADMILLS look.
function setLook(p, look) {
  if (!TREADMILLS[look] || look === p.look) return
  const old = p.treadmill
  const next = buildTreadmill(look)
  next.group.position.copy(old.group.position)
  next.group.visible = old.group.visible
  next.belt = old.belt
  dropEmitters(old.group)
  p.root.remove(old.group)
  p.root.add(next.group)
  p.treadmill = next
  p.look = look
}

function setTag(p, name, head) {
  if (p.tag) {
    p.root.remove(p.tag)
    p.tag.material.map.dispose()
    p.tag.material.dispose()
    p.tag = null
  }
  if (name == null) return
  p.tag = ownerTag(name, head)
  p.tag.position.set(0, PLOT.tagHeight, 0)
  p.root.add(p.tag)
}

// A blocky head for a player whose look we don't know: picked from their name.
const HEADS = [
  { skin: '#f2c79a', hair: '#1a1a1a', face: 'smile' },
  { skin: '#e8b48a', hair: '#3a1a14', face: 'grin' },
  { skin: '#8fa8ff', hair: '#2a3a8a', face: 'shades' },
  { skin: '#5a3a2a', hair: '#1a6a2a', face: 'smile' },
  { skin: '#ffd23a', hair: '#7a3a1a', face: 'smirk' },
  { skin: '#ffffff', hair: '#d02020', face: 'goggles' },
]
const headFor = (name) => HEADS[[...String(name)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % HEADS.length]

// owner: { name, head?, fish: [ids], treadmill: look, level: base level } or null (an empty plot).
function dress(p, owner) {
  const key = owner ? JSON.stringify([owner.name, owner.fish, owner.treadmill, owner.level]) : ''
  if (key === p.key) return
  p.key = key
  setTag(p, owner ? owner.name : null, owner?.head ?? headFor(owner?.name ?? ''))
  setFish(p, owner?.fish ?? [])
  const tier = tierOf(owner?.level)
  setTier(p, tier)
  setMill(p, tier >= 1)
  setLook(p, owner?.treadmill ?? 'stone')
  p.treadmill.belt = 0
}

const pondPlane = new Plane(new Vector3(0, 1, 0), -POND.y)
const hit = new Vector3()

// myPlot: the PLOTS index the local player owns (the server's pick, or MY_PLOT offline).
// The other plots start empty; setOwner dresses them for the real players in the room.
export function buildPlots(scene, { myPlot, myName, myHead }) {
  const plots = PLOTS.map((def) => buildPlot(scene, def))
  const myOwner = { name: myName, head: myHead, fish: [], treadmill: 'stone', level: 1 }
  plots.forEach((p, i) => dress(p, i === myPlot ? myOwner : null))
  const mine = plots[myPlot]
  mine.house = houseIcon()
  mine.house.position.set(0, PLOT.houseHeight, 0)
  mine.root.add(mine.house)
  const toLocal = (x, z) => {
    const c = Math.cos(mine.def.facing)
    const s = Math.sin(mine.def.facing)
    const dx = x - mine.def.x
    const dz = z - mine.def.z
    return [c * dx - s * dz, s * dx + c * dz]
  }
  return {
    plots,
    mine,
    setMyName(name, head) {
      myOwner.name = name
      if (head) myOwner.head = head
      dress(mine, { ...myOwner })
    },
    // Replaces the fish swimming in the local player's pond (species ids, best first).
    setMyFish(ids) {
      myOwner.fish = ids
      dress(mine, { ...myOwner })
    },
    // The local player's base level (hub/base.js): its tier's look, the treadmill from tier 1.
    setMyLevel(level) {
      myOwner.level = level
      dress(mine, { ...myOwner })
    },
    // Another player's plot (i != myPlot): owner { name, fish, treadmill, level } or null = nobody.
    setOwner(i, owner) {
      if (i === myPlot || !plots[i]) return
      dress(plots[i], owner)
    },
    // The local player's treadmill: its centre and the Upgrade sign in world space, the
    // plot's yaw (treadmill local -Z = toward the console), the sign, the model, and whether
    // it is there yet (base level 2+).
    myTreadmill() {
      const { lx, lz } = mine.treadmillAt
      const [x, z] = toWorld(mine.def, lx, lz)
      const [sx, sz] = toWorld(mine.def, lx + 2.1, lz - 1.6)
      return {
        x, z, yaw: mine.def.facing, sign: mine.sign, signAt: { x: sx, z: sz },
        get model() { return mine.treadmill },
        get present() { return mine.mill },
      }
    },
    // Swaps the local player's treadmill model for another TREADMILLS look (an upgrade).
    setMyTreadmillLook(look) {
      myOwner.treadmill = look
      dress(mine, { ...myOwner })
    },
    // Where a ray (Raycaster.ray) meets the water of your own pond, in world space, or null.
    hitMyPond(ray) {
      if (!ray.intersectPlane(pondPlane, hit)) return null
      const [lx, lz] = toLocal(hit.x, hit.z)
      const m = 0.25 // keep clear of the edge
      if (lx < POND.x0 + m || lx > POND.x1 - m || lz < POND.z0 + m || lz > POND.z1 - m) return null
      return hit
    },
    // Plot-local (lx, lz) of your plot -> world [x, z], and its root (base.js puts its sign there).
    myToWorld: (lx, lz) => toWorld(mine.def, lx, lz),
    myRoot: () => mine.root,
    update(dt, elapsed) {
      if (waterTex) waterTex.offset.set(elapsed * 0.03, elapsed * 0.017)
      const zMid = (POND.z0 + POND.z1) / 2
      for (const p of plots) {
        if (p.mill) p.treadmill.update(dt, elapsed)
        if (p.house) p.house.position.y = PLOT.houseHeight + Math.sin(elapsed * 2.2) * 0.25
        for (const f of p.fish) {
          const t = elapsed * f.w
          const x = f.rx * Math.sin(t + f.p1)
          const z = f.rz * Math.sin(t * f.ratio + f.p2)
          const dx = f.rx * Math.cos(t + f.p1)
          const dz = f.rz * f.ratio * Math.cos(t * f.ratio + f.p2)
          f.g.position.set(x, 0.14 - f.h * 0.1 + Math.sin(elapsed * 1.7 + f.p1) * 0.05, zMid + z)
          if (!f.upright || Math.abs(dx) > 1e-3) f.g.rotation.y = Math.atan2(-dz, dx)
          if (f.upright) f.g.rotation.y = dx >= 0 ? 0 : Math.PI
        }
      }
    },
  }
}
