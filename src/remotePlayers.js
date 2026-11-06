// The other players in the room, drawn in the world (after Scare Your Neighbor's remotePlayers.js).
// Everything comes from the synced roster (net.js roster(), backend PlayerState), diffed against the
// scene every frame, so joins / leaves / look changes need no events:
//   * their Bloxity avatar (skin texture, accessories, proportions) on the same base rig the local
//     player uses, and a name tag;
//   * the procedural animations (idle, run, jump / fall, landing), what is in the right hand (their
//     rod, the bat or a backpack fish: tools.js), the fish held overhead on the run home (the lane's
//     carry pose) and lying flat while a guard has knocked them down;
//   * their equipped trail as a ribbon behind them.
// Poses are eased toward the last one relayed plus speed x heading for the time since (dead
// reckoning), so fast runners glide instead of stepping. Nearest first, capped (fewer on touch).
import { Group } from 'three'
import { BAT, COARSE_POINTER, FISH, NET, PLAYER_DIMS, TRAILS } from './config.js'
import { roster, net } from './net.js'
import { label } from './propkit.js'
import { buildDefaultCharacter } from './avatar/character.js'
import { buildLook } from './avatar/look.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { equipTool, stepSwing } from './tools.js'
import { fishMesh } from './hub/fish.js'
import { createTrail } from './hub/trail.js'
import { POSE } from './lane/index.js'

const MAX = COARSE_POINTER ? NET.maxRemotesTouch : NET.maxRemotes
const HELD_LENGTH = 2.0 // m: the overhead catch, as lane/index.js draws your own
const trailColors = new Map(TRAILS.map((t) => [t.id, t.colors]))
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

class Remote {
  constructor(scene) {
    this.scene = scene
    this.group = new Group()
    this.group.rotation.order = 'YXZ' // yaw, then the knocked-down tip
    this.group.visible = false
    scene.add(this.group)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.applied = { tool: '', hold: '', trail: '', name: null } // as last applied
    this.carried = null // the overhead fish
    this.trail = null
    this.label = null
    this.placed = false
    this.fall = 0
    this.swingT = -1 // s into a bat swing, -1 = none
    this.spin = 0 // somersault while flying from a bonk
    this.p = null // their roster entry, as last drawn
    this.base = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, at: 0, key: '' }
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    this.avatar = next
    this.group.add(next)
    this.rebuildRig()
  }

  // Tools attach in the bind pose: a fresh animator around the reset rig, then the tool, then the
  // overhead pose again if they are carrying a catch.
  rebuildRig() {
    disposeAnimator(this.animator)
    this.animator = makeAnimator(this.avatar)
    const [slot, item, rod] = this.applied.tool.split('|')
    const s = this.applied.hold ? 0 : Number(slot) || 0 // both hands are on the catch
    equipTool(this.avatar, s, s === 3 ? item || null : null, rod || undefined)
    if (this.applied.hold) this.animator?.setOverlay(POSE.carry, 100)
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    const mine = ++this.generation
    if (!json) return this.setAvatar(buildDefaultCharacter())
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    try {
      const group = await buildLook({ equipped: look?.equipped, proportions: look?.proportions, skin: look?.skin || undefined }, () => mine !== this.generation)
      if (group && mine === this.generation) this.setAvatar(group)
    } catch (err) {
      console.warn('[remote] avatar failed to load', err)
    }
  }

  // A bat swing seen from the roster's `swing` relay (bat.js).
  swing() {
    if (this.applied.hold) return
    this.swingT = 0
    stepSwing(this.animator, -1, 0, BAT.windup, BAT.swing)
  }

  setCarried(species) {
    if (this.carried) {
      this.carried.removeFromParent()
      this.carried = null
    }
    if (!species || !FISH[species]) return
    const f = fishMesh(species, { labels: false, aura: false })
    f.scale.setScalar(HELD_LENGTH / FISH[species].size)
    f.position.set(0, 2.45, 0)
    f.rotation.set(0, Math.PI / 2, 0)
    this.group.add(f)
    this.carried = f
  }

  // Hand, overhead catch, trail and name: rebuilt only when they change.
  sync(p) {
    const a = this.applied
    const tool = `${p.slot}|${p.item}|${p.rod}`
    const hold = p.hold && FISH[p.hold] ? p.hold : ''
    if (tool !== a.tool || hold !== a.hold) {
      const holdChanged = hold !== a.hold
      a.tool = tool
      a.hold = hold
      if (holdChanged) this.setCarried(hold)
      this.rebuildRig()
    }
    if (p.trail !== a.trail) {
      a.trail = p.trail
      const colors = trailColors.get(p.trail)
      if (colors) {
        if (!this.trail) this.trail = createTrail(this.scene, colors)
        else this.trail.setColors(colors)
        this.trail.reset()
        this.trail.mesh.visible = true
      } else if (this.trail) this.trail.mesh.visible = false
    }
    const name = p.username || 'Player'
    if (name !== a.name) {
      a.name = name
      this.dropLabel()
      this.label = label(name, 0.42, { color: '#ffffff', outline: '#1a1c26' })
      this.label.position.y = PLAYER_DIMS.height + 0.6
      this.group.add(this.label)
    }
  }

  update(p, dt, now) {
    // A new pose resets the dead-reckoning base.
    const b = this.base
    const key = `${p.x}|${p.y}|${p.z}|${p.yaw}|${p.speed}`
    if (key !== b.key) Object.assign(b, { key, x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed: p.speed, at: now })
    const ahead = p.knocked ? 0 : Math.min((now - b.at) / 1000, NET.predictMax) * b.speed
    const tx = b.x + Math.sin(b.yaw) * ahead
    const tz = b.z + Math.cos(b.yaw) * ahead
    const g = this.group
    const far = Math.hypot(tx - g.position.x, tz - g.position.z) > 30
    const k = this.placed && !far ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    // Knocked down by a guard: flat on the back while it lasts (the throw itself comes through the pose).
    const lying = p.knocked && p.grounded
    this.fall = lying ? Math.min(1, this.fall + dt * 7) : Math.max(0, this.fall - dt * 3)
    g.position.x += (tx - g.position.x) * k
    g.position.y += (b.y + this.fall * 0.22 - g.position.y) * k
    g.position.z += (tz - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, b.yaw) * k
    // Bonked into the air: somersault until they come down (the flight itself comes through the pose).
    const flying = p.knocked && b.y > 0.5
    this.spin = flying ? this.spin + dt * 13 : 0
    g.rotation.x = flying ? -this.spin : -this.fall * Math.PI * 0.5
    if (this.swingT >= 0) {
      const prev = this.swingT
      this.swingT += dt
      if (!stepSwing(this.animator, prev, this.swingT, BAT.windup, BAT.swing)) this.swingT = -1
    }
    this.placed = true
    if (this.carried) {
      const t = now / 1000
      this.carried.rotation.z = Math.sin(t * 9) * 0.15 // the fish flaps
      this.carried.position.y = 2.55 + Math.abs(Math.sin(t * 9)) * 0.06
    }

    this.animator?.update(dt, {
      grounded: p.grounded,
      speed: p.knocked ? 0 : b.speed,
      verticalVelocity: p.vy,
      turn: 0,
    })
    if (this.trail?.mesh.visible) this.trail.update(dt, g.position.x, g.position.y, g.position.z)
  }

  hide() {
    this.group.visible = false
    this.placed = false // snap into place when it comes back
    if (this.trail) this.trail.mesh.visible = false
    this.applied.trail = null // shown again (reset) when they come back
  }

  dropLabel() {
    if (!this.label) return
    this.group.remove(this.label)
    this.label.material.map?.dispose()
    this.label.material.dispose()
    this.label = null
  }

  dispose() {
    this.generation++ // an avatar still loading is dropped
    this.scene.remove(this.group)
    disposeAnimator(this.animator)
    this.dropLabel()
    if (this.trail) {
      this.scene.remove(this.trail.mesh)
      this.trail.mesh.geometry.dispose()
      this.trail.mesh.material.dispose()
    }
  }
}

export function createRemotePlayers(scene) {
  const remotes = new Map() // sessionId -> Remote
  const list = [] // reused each frame: [{ id, p, d }]

  function clear() {
    for (const r of remotes.values()) r.dispose()
    remotes.clear()
  }

  return {
    get count() {
      return remotes.size
    },
    // The drawn remote for a session id (its `group` is where they stand on screen), or null.
    get: (id) => remotes.get(id) ?? null,
    // fn(id, remote) for every remote drawn this frame (remote.p = their roster entry).
    forEachVisible(fn) {
      for (const [id, r] of remotes) if (r.group.visible && r.p) fn(id, r)
    },
    // viewer: this player's drawn position.
    update(dt, viewer) {
      const players = roster()
      if (!players) return remotes.size && clear()
      const mine = net.sessionId
      list.length = 0
      players.forEach((p, id) => {
        if (id !== mine) list.push({ id, p, d: Math.hypot(p.x - viewer.x, p.z - viewer.z) })
      })
      list.sort((a, b) => a.d - b.d)
      const now = performance.now()
      const keep = new Set()
      for (let i = 0; i < Math.min(MAX, list.length); i++) {
        const { id, p, d } = list[i]
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(scene)))
        r.syncAvatar(p.avatar)
        if (d > NET.remoteFade) {
          if (r.group.visible || r.placed) r.hide()
          continue
        }
        r.sync(p)
        r.p = p
        r.group.visible = true
        r.update(p, dt, now)
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose()
        remotes.delete(id)
      }
    },
  }
}
