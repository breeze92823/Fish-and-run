import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { BAT, FISH, FISHING, GUARD, HUB, KNOCKBACK, LANE, ROD_LUCK_POWER, ZONE_BANNER, ZONES } from '../config.js'
import { equippedRod } from '../rods/state.js'
import { formatSpeed, guardSpeed, speedStat } from '../speed.js'
import { player, resetPlayer } from '../player.js'
import { fishMesh, prewarmFish } from '../hub/fish.js'
import { rodTip, setToolVisible } from '../tools.js'
import { createGuard } from './guard.js'
import { buildForest, updateRivers } from './scenery.js'
import { buildThemedZone } from './themes.js'

// The run lane: zones north of the finish line, each with a river to fish and a
// guard. The loop (from the reference): cross the line -> zone banner; stand by the
// river with the rod -> Cast; the bobber lands, a fish bites -> Click Fast! fills
// the bar; the fish leaps into your hands and you hold it overhead -> RUN!, the
// guard chases you; cross back over the line -> the fish goes in your backpack.
// Caught by the guard -> the fish is lost and you're thrown back to the start of
// the zone, lie there a moment, and stand up.
//
// Each zone's guard also blocks the way on: stepping into the next zone (up to
// GUARD.gateDepth m) makes it chase you; caught, you are thrown back to the start of
// the guard's zone. Zones far from the player are hidden; entering one tints the sky.
//
// Bat bonks (bat.js): bonked(dir) throws you up and away and returns the catch you lose;
// receiveFish(species, from) makes a stolen catch leap into your hands to carry home.
//
// buildLane(scene, ctx) -> { update(dt, elapsed), tryCast(), reset(), click(), mode, carrying,
//   canSwing, bonked(dir), receiveFish(species, from), setCarryWeight(kg) }
// ctx: { fx, laneHud, toast(msg), playerGroup, getAvatar(), getAnimator(), getSlot(), onDeliver(fish), canvas, setSky(sky|null) }

const D = Math.PI / 180
export const POSE = {
  windup: { ArmR1: { x: -2.75, z: -0.25 }, ArmR2: { x: 0.2 }, ArmL1: { x: -0.5, z: 0.25 } },
  throw: { ArmR1: { x: -0.85, z: -0.1 }, ArmR2: { x: 0.1 }, ArmL1: { x: -0.45, z: 0.1 }, Spine1: { x: 0.12 } },
  hold: { ArmR1: { x: -1.0, z: -0.12 }, ArmR2: { x: 0.25 }, ArmL1: { x: -0.95, z: -0.42 }, ArmL2: { x: 0.35 } },
  reel: { ArmR1: { x: -1.3, z: -0.12 }, ArmR2: { x: 0.55 }, ArmL1: { x: -1.2, z: -0.42 }, ArmL2: { x: 0.6 }, Spine1: { x: -0.12 } },
  carry: { ArmL1: { x: -3.05, z: 0.28 }, ArmR1: { x: -3.05, z: -0.28 }, ArmL2: { x: 0.15 }, ArmR2: { x: 0.15 } },
  flail: { ArmL1: { x: -2.4, z: 1.3 }, ArmR1: { x: -2.4, z: -1.3 }, LegL1: { x: -0.7 }, LegR1: { x: 0.6 }, Neck1: { x: -20 * D } },
}

const HELD_LENGTH = 2.0 // m: the reference shows the catch about as long as the player is tall
const rand = (a, b) => a + Math.random() * (b - a)
// Weighted pick; the rod's luck multiplies each fish's weight by luck ^ (rarity tier * power).
const TIER = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5, SECRET: 6 }
function pickFish(zone, luck = 1) {
  const w = zone.fish.map(([id, wt]) => wt * Math.pow(luck, (TIER[FISH[id].rarity] ?? 0) * ROD_LUCK_POWER))
  const total = w.reduce((s, x) => s + x, 0)
  let r = Math.random() * total
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return zone.fish[i][0]
  return zone.fish[0][0]
}
const zoneAt = (z) => ZONES.find((zn) => z <= zn.start && z > zn.end) ?? null

export function buildLane(scene, ctx) {
  const { fx, laneHud } = ctx
  const root = new Group()
  root.name = 'lane'
  scene.add(root)

  // Zones: scenery + guard per zone, each in its own group (hidden when far away).
  const zones = ZONES.map((zone, index) => {
    const group = new Group()
    group.name = `zone-${zone.id}`
    root.add(group)
    const built = zone.id === 'forest' ? buildForest(group, zone) : buildThemedZone(group, zone)
    const range = { minZ: zone.end - GUARD.gateDepth, maxZ: zone.start - 1.5 }
    const guard = createGuard(group, fx, zone.guard, range, guardSpeed(zone))
    // The gate: from `approach` m before the zone's end (but north of every bank the rod
    // can be cast from, so fishing never sets it off) to `gateDepth` m into the next zone.
    const gate = {
      from: Math.min(zone.end + GUARD.approach, ...built.rivers.map((r) => r.z - r.half - LANE.river.curbWidth - FISHING.reach)),
      to: zone.end - GUARD.gateDepth,
    }
    return { zone, index, group, built, rivers: built.rivers, guard, range, gate, groundAt: built.groundAt ?? (() => 0), centre: (zone.start + zone.end) / 2, name: zone.guard.kind.charAt(0).toUpperCase() + zone.guard.kind.slice(1) }
  })
  const allRivers = zones.flatMap((zn) => zn.rivers.map((river) => ({ zn, river })))
  // Build every zone's fish models in idle time, nearest zones first.
  prewarmFish(ZONES.flatMap((zone) => zone.fish.map(([id]) => id)))
  const VISIBLE = 230 // m from a zone's centre within which it is drawn

  // --- Line + bobber ---
  const SEG = 24
  const linePos = new Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3)
  const lineGeo = new BufferGeometry()
  lineGeo.setAttribute('position', linePos)
  const line = new Line(lineGeo, new LineBasicMaterial({ color: FISHING.lineColor }))
  line.frustumCulled = false
  line.visible = false
  scene.add(line)
  const bobber = new Group()
  const bTop = new Mesh(new SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#ff2a2a', roughness: 0.4 }))
  const bBot = new Mesh(new SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }))
  bobber.add(bTop, bBot)
  bobber.visible = false
  scene.add(bobber)

  const tip = new Vector3()
  const from = new Vector3()
  const to = new Vector3()
  const tmp = new Vector3()

  function drawLine(sag) {
    const b = bobber.position
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG
      tmp.lerpVectors(tip, b, t)
      tmp.y -= Math.sin(t * Math.PI) * sag
      linePos.setXYZ(i, tmp.x, tmp.y, tmp.z)
    }
    linePos.needsUpdate = true
  }

  // --- State ---
  let mode = 'free' // free | cast | wait | reel | leap | carry | thrown
  let t = 0 // time in mode
  let current = null // the zone entry being fished
  let currentRiver = null
  let species = null
  let weight = 0
  let need = 10
  let clicks = 0
  let progress = 0
  let waitFor = 0
  let reelTime = 0
  let leapFish = null
  let carried = null
  let castable = false
  let lastZone = zoneAt(player.position.z)
  let throwFrom = null
  let throwTo = null
  let knock = KNOCKBACK // the throw being played: a guard's catch or a bat bonk (BAT.knock)
  let stolen = false // the catch being carried was stolen with the bat
  let splashT = 0

  const anim = () => ctx.getAnimator()
  const setPose = (p, rate) => anim()?.setOverlay(p, rate)
  const riverNear = (z) => {
    let best = null
    for (const e of allRivers) {
      const d = Math.abs(z - e.river.z) - e.river.half
      if (d < FISHING.reach + LANE.river.curbWidth && (!best || d < best.d)) best = { e, d }
    }
    return best?.e ?? null
  }

  function endFishing() {
    line.visible = false
    bobber.visible = false
    laneHud.showClicker(false)
    player.frozen = false
    setPose(null, 8)
    mode = 'free'
  }

  function tryCast() {
    if (!castable || mode !== 'free') return false
    const near = riverNear(player.position.z)
    if (!near) return false
    current = near.zn
    currentRiver = near.river
    const rz = near.river.z
    const dir = Math.sign(rz - player.position.z) || -1
    player.frozen = true
    player.facing = dir < 0 ? Math.PI : 0
    const lim = near.river.half - 0.7
    to.set(player.position.x + rand(-0.8, 0.8), 0.1, Math.max(rz - lim, Math.min(rz + lim, player.position.z + dir * FISHING.castDistance)))
    mode = 'cast'
    t = 0
    setPose(POSE.windup, 14)
    laneHud.showCast(false)
    return true
  }

  function onClick() {
    if (mode !== 'reel') return
    clicks++
    progress = Math.min(1, progress + equippedRod().speed / need) // catch speed: more per click
    laneHud.setClicks(clicks, progress, true)
    laneHud.pulseClick()
    fx.burst(bobber.position, { kind: 'glow', count: 5, color: '#d8faff', speed: 1.6, up: 3, size: 0.22, life: 0.5, gravity: 12 })
    fx.ring(bobber.position, { size: 1.2, life: 0.5 })
    setPose(clicks % 2 ? POSE.reel : POSE.hold, 30)
  }

  // Clicks while the pointer is locked land on the canvas, not on the HUD's catcher.
  const onMouse = (e) => {
    if (e.button !== 0) return
    if (mode === 'reel' && document.pointerLockElement) onClick()
    else if (mode === 'free' && castable && (e.target === ctx.canvas || document.pointerLockElement)) tryCast()
  }
  window.addEventListener('mousedown', onMouse)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && mode === 'reel') onClick()
  })

  function startCarry() {
    carried = fishMesh(species, { labels: false, aura: false })
    const k = HELD_LENGTH / FISH[species].size
    carried.scale.setScalar(k)
    carried.position.set(0, 2.45, 0)
    carried.rotation.set(0, Math.PI / 2, 0)
    ctx.playerGroup.add(carried)
    mode = 'carry'
    t = 0
    player.frozen = false
    setPose(POSE.carry, 10)
    setToolVisible(ctx.getAvatar(), false)
    laneHud.run()
    fx.burst(tmp.copy(player.renderPosition).setY(2.8), { kind: 'spark', count: 22, color: '#fff6b0', speed: 3, up: 3, size: 0.45, life: 0.9, gravity: 3 })
  }

  function dropCarry() {
    if (!carried) return
    carried.removeFromParent()
    carried = null
    setToolVisible(ctx.getAvatar(), true)
  }

  function deliver() {
    const w = weight
    const earn = Math.max(1, Math.round(FISH[species].earn * (1 + w)))
    ctx.onDeliver({ species, weight: w, earn })
    fx.burst(tmp.copy(player.renderPosition).setY(1.5), { kind: 'spark', count: 30, color: '#fff2a0', speed: 4, up: 4, size: 0.5, life: 1, gravity: 4 })
    ctx.toast(`+1 ${FISH[species].name} (${w}Kg)${stolen ? ' - stolen!' : ''}`)
    stolen = false
    dropCarry()
    setPose(null, 8)
    for (const zn of zones) zn.guard.giveUp()
    laneHud.warn(false)
    mode = 'free'
  }

  function knockedDown(zn) {
    const hadFish = !!carried
    const fishPos = carried ? carried.getWorldPosition(new Vector3()) : player.renderPosition
    fx.burst(fishPos, { kind: 'glow', count: 16, color: '#ffffff', speed: 4, up: 4, size: 0.35, life: 0.7, gravity: 10 })
    if (mode === 'cast' || mode === 'wait' || mode === 'reel') endFishing()
    if (leapFish) {
      leapFish.removeFromParent()
      leapFish = null
    }
    dropCarry()
    laneHud.warn(false)
    ctx.toast(hadFish ? `The ${zn.name} took your fish!` : `The ${zn.name} won't let you pass!`)
    launch({ x: player.position.x * 0.7, z: Math.min(KNOCKBACK.landZ, zn.zone.start + KNOCKBACK.landZ) }, KNOCKBACK)
  }

  // Thrown through the air to `to` (flight / height / lie / getUp from `how`), lie there, stand up.
  function launch(to, how) {
    mode = 'thrown'
    t = 0
    knock = how
    player.frozen = true
    throwFrom = { x: player.position.x, z: player.position.z }
    throwTo = to
    setPose(POSE.flail, 14)
  }

  // A landing spot `d` m from here along (dx, dz): inside the lane's walls, north of the finish
  // line and on dry ground (a spot in a river moves to its nearer bank).
  function landingSpot(dx, dz, d) {
    const W = HUB.halfWidth - 2.5
    let x = Math.max(-W, Math.min(W, player.position.x + dx * d))
    let z = Math.max(HUB.laneEnd + 4, Math.min(-2.5, player.position.z + dz * d))
    for (const { river } of allRivers) {
      const edge = river.half + LANE.river.curbWidth + 0.8
      if (Math.abs(z - river.z) < edge) z = z > river.z ? river.z + edge : river.z - edge
    }
    return { x, z: Math.min(-2.5, z) }
  }

  // Hit with a bat (bat.js): whatever you were doing stops, the catch you held is gone (returned as
  // { species, weight } for the server to hand to the attacker) and you fly up and away along (dx, dz).
  function bonked(dx, dz) {
    let lost = null
    if (mode === 'carry' && carried) lost = { species, weight }
    if (mode === 'cast' || mode === 'wait' || mode === 'reel') endFishing()
    if (leapFish) {
      leapFish.removeFromParent()
      leapFish = null
    }
    dropCarry()
    stolen = false
    laneHud.warn(false)
    for (const zn of zones) zn.guard.giveUp()
    const len = Math.hypot(dx, dz) || 1
    player.facing = Math.atan2(-dx / len, -dz / len) // face the attacker as you fly backwards
    launch(landingSpot(dx / len, dz / len, BAT.knock.distance), BAT.knock)
    return lost
  }

  // A catch stolen with the bat: it leaps from the victim (`from`, world position) into your hands
  // and you carry it home like your own, chased by the guard of the zone you are in. The weight is
  // the zone's middle one until the victim's own arrives (setCarryWeight).
  function receiveFish(id, fromPos) {
    if (!FISH[id] || mode !== 'free') return false
    species = id
    const home = ZONES.find((zn) => zn.fish.some(([f]) => f === id))
    weight = home ? Math.round(((home.weight[0] + home.weight[1]) / 2) * 10) / 10 : 1
    current = zones.find((zn) => zn.zone === zoneAt(player.position.z)) ?? zones[0]
    stolen = true
    leapFish = fishMesh(species, { labels: false, aura: false })
    leapFish.scale.setScalar(HELD_LENGTH / FISH[species].size)
    scene.add(leapFish)
    from.set(fromPos.x, fromPos.y, fromPos.z)
    fx.burst(from, { kind: 'spark', count: 16, color: '#ffe680', speed: 3, up: 4, size: 0.45, life: 0.8, gravity: 6 })
    setPose(POSE.carry, 9)
    mode = 'leap'
    t = 0
    return true
  }

  function reset() {
    if (mode === 'free') return
    endFishing()
    dropCarry()
    laneHud.warn(false)
    ctx.playerGroup.rotation.x = 0
    for (const zn of zones) zn.guard.giveUp()
  }

  return {
    tryCast,
    reset,
    click: onClick,
    get mode() {
      return mode
    },
    // The species held overhead on the run home, or null.
    get carrying() {
      return mode === 'carry' ? species : null
    },
    // Free to swing the bat: not fishing, carrying, flying or lying down.
    get canSwing() {
      return mode === 'free'
    },
    bonked,
    receiveFish,
    // The stolen catch's real weight, once its old owner reports it.
    setCarryWeight(kg) {
      if (stolen && Number.isFinite(kg) && kg >= 0) weight = Math.round(kg * 10) / 10
    },
    update(dt, elapsed) {
      t += dt
      const p = player.position
      updateRivers(elapsed)
      for (const zn of zones) zn.built?.update(dt, elapsed)

      // Zone banner (and the zone's sky) on entering a zone.
      const z = zoneAt(p.z)
      if (z !== lastZone) {
        if (z) laneHud.banner(z.name, z.banner, ZONE_BANNER.hold, ZONE_BANNER.fade, `Recommended Speed: ${formatSpeed(z.speed ?? 1)}`, speedStat() < (z.speed ?? 1))
        ctx.setSky?.(z?.sky ?? null)
        lastZone = z
      }
      // Only zones near the player are drawn.
      for (const zn of zones) zn.group.visible = Math.abs(p.z - zn.centre) < VISIBLE

      // Rod tip in world space (for the line).
      const tipObj = rodTip(ctx.getAvatar())
      if (tipObj) tipObj.getWorldPosition(tip)
      else tip.copy(player.renderPosition).setY(p.y + 1.6)

      // Cast button: rod in hand, by a river, nothing else going on.
      const canNow = mode === 'free' && ctx.getSlot() === 1 && !!tipObj && player.grounded && p.z < 0 && !!riverNear(p.z)
      if (canNow !== castable) {
        castable = canNow
        laneHud.showCast(castable)
      }

      if (mode === 'cast') {
        // Wind up, then throw: the bobber flies in an arc to the water.
        if (t > 0.28 && !bobber.visible) {
          setPose(POSE.throw, 20)
          from.copy(tip)
          bobber.visible = true
          line.visible = true
        }
        if (bobber.visible) {
          const k = Math.min(1, (t - 0.28) / FISHING.castTime)
          bobber.position.lerpVectors(from, to, k)
          bobber.position.y += Math.sin(k * Math.PI) * 2.6
          drawLine(0.15)
          if (k >= 1) {
            fx.burst(to, { kind: 'glow', count: 10, color: '#d8faff', speed: 2, up: 3, size: 0.25, life: 0.6, gravity: 12 })
            fx.ring(to, { size: 1.4 })
            mode = 'wait'
            t = 0
            waitFor = rand(FISHING.bite[0], FISHING.bite[1]) / equippedRod().speed // catch speed: quicker bites
            setPose(POSE.hold, 8)
          }
        }
      } else if (mode === 'wait') {
        bobber.position.set(to.x, 0.12 + Math.sin(elapsed * 3) * 0.04, to.z)
        drawLine(0.45)
        if (t > waitFor - 0.5) bobber.position.y -= Math.sin((t - waitFor + 0.5) * 30) * 0.05 // nibbles
        if (t >= waitFor) {
          // Bite!
          species = pickFish(current.zone, equippedRod().luck)
          weight = Math.round(rand(current.zone.weight[0], current.zone.weight[1]) * 10) / 10
          need = FISHING.clicks[FISH[species].rarity] ?? 12
          clicks = 0
          progress = 0
          reelTime = 0
          fx.burst(bobber.position, { kind: 'glow', count: 22, color: '#d8faff', speed: 3, up: 5, size: 0.3, life: 0.8, gravity: 12 })
          fx.burst(bobber.position, { kind: 'spark', count: 8, color: '#ffffff', speed: 1.5, up: 2, size: 0.5, life: 0.6, gravity: 2 })
          fx.ring(bobber.position, { size: 2 })
          laneHud.showClicker(true)
          mode = 'reel'
          t = 0
        }
      } else if (mode === 'reel') {
        reelTime += dt
        if (progress < 1) progress = Math.max(0, progress - FISHING.decay * dt) // a full bar lands it this frame
        laneHud.setClicks(clicks, progress, clicks > 0)
        // The bobber thrashes and creeps toward the bank as the fish tires.
        const pull = progress * 0.6
        bobber.position.set(to.x + Math.sin(elapsed * 17) * 0.12, 0.05 + Math.abs(Math.sin(elapsed * 11)) * 0.08, to.z + (p.z - to.z) * pull * 0.5)
        drawLine(0.04)
        splashT -= dt
        if (splashT <= 0) {
          splashT = 0.18
          fx.burst(bobber.position, { kind: 'glow', count: 3, color: '#e8fcff', speed: 1.2, up: 2.5, size: 0.2, life: 0.4, gravity: 12 })
        }
        if (progress >= 1) {
          // Landed: the fish leaps from the water into the player's hands.
          laneHud.showClicker(false)
          line.visible = false
          bobber.visible = false
          leapFish = fishMesh(species, { labels: false, aura: false })
          const k = HELD_LENGTH / FISH[species].size
          leapFish.scale.setScalar(k)
          scene.add(leapFish)
          from.copy(bobber.position)
          fx.burst(from, { kind: 'glow', count: 30, color: '#d8faff', speed: 4, up: 7, size: 0.35, life: 0.9, gravity: 12 })
          fx.ring(from, { size: 2.6, life: 1.1 })
          setPose(POSE.carry, 9)
          mode = 'leap'
          t = 0
        } else if (reelTime > FISHING.timeLimit) {
          ctx.toast('The fish got away!')
          endFishing()
        }
      } else if (mode === 'leap') {
        const k = Math.min(1, t / FISHING.leapTime)
        to.copy(player.renderPosition).setY(p.y + 2.55)
        leapFish.position.lerpVectors(from, to, k)
        leapFish.position.y += Math.sin(k * Math.PI) * 4
        leapFish.rotation.set(0, player.facing + Math.PI / 2, Math.sin(k * Math.PI * 3) * 0.8)
        if (Math.random() < 0.5) fx.burst(leapFish.position, { kind: 'glow', count: 1, color: '#e8fcff', speed: 0.5, up: 0, size: 0.22, life: 0.5, gravity: 8 })
        if (k >= 1) {
          leapFish.removeFromParent()
          leapFish = null
          startCarry()
        }
      } else if (mode === 'carry') {
        carried.rotation.z = Math.sin(elapsed * 9) * 0.15 // the fish flaps
        carried.position.y = 2.55 + Math.abs(Math.sin(elapsed * 9)) * 0.06
        const chased = zones.some((zn) => zn.guard.chasing)
        const speed = Math.hypot(player.velocity.x, player.velocity.z)
        laneHud.warn(chased && speed < 4 && t > 1)
        if (p.z > 0.6) deliver()
      } else if (mode === 'thrown') {
        const F = knock.flight
        const g = ctx.playerGroup
        if (t < F) {
          const k = t / F
          const x = throwFrom.x + (throwTo.x - throwFrom.x) * k
          const zz = throwFrom.z + (throwTo.z - throwFrom.z) * k
          resetPlayer({ x, y: Math.sin(k * Math.PI) * knock.height, z: zz }, player.facing)
          g.rotation.x = -k * Math.PI * 2.5
        } else if (t < F + knock.lie) {
          if (t - dt < F) {
            resetPlayer({ x: throwTo.x, y: 0.05, z: throwTo.z }, player.facing)
            fx.burst({ x: throwTo.x, y: 0.2, z: throwTo.z }, { kind: 'puff', count: 14, color: '#f0f8e0', speed: 2.5, up: 1, size: 0.8, grow: 2, life: 0.9, gravity: 0 })
            setPose(null, 6)
          }
          g.rotation.x = -Math.PI / 2
          g.position.y += 0.22
        } else if (t < F + knock.lie + knock.getUp) {
          const k = (t - F - knock.lie) / knock.getUp
          g.rotation.x = -Math.PI / 2 * (1 - k * k * (3 - 2 * k))
          g.position.y += 0.22 * (1 - k)
        } else {
          g.rotation.x = 0
          player.frozen = false
          mode = 'free'
        }
      }

      // Guards: while a fish is carried only the guard of the zone it was caught in
      // chases (through its own zone); otherwise each guard chases anyone reaching the
      // end part of its zone (the gate). A catch knocks them back to the start of the
      // guard's zone.
      for (const zn of zones) {
        let want = false
        if (mode === 'carry') want = zn === current && p.z <= zn.zone.start + 1 && p.z >= zn.range.minZ
        else if (mode !== 'thrown') want = p.z < zn.gate.from && p.z > zn.gate.to
        if (want) zn.guard.chase()
        else zn.guard.giveUp()
        if (!zn.group.visible && !zn.guard.chasing) continue
        const res = zn.guard.update(dt, elapsed, player.renderPosition, zn.rivers, zn.groundAt)
        if (res === 'caught' && want) knockedDown(zn)
      }
    },
  }
}
