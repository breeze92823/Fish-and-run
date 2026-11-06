// Putting a held fish in your pond: while a backpack fish is in your hand (hotbar 3+), aiming
// at the water of your own plot shows a ring on it (green = room in the pond, red = full); a
// click (desktop: the screen centre while the cursor is locked, else the mouse) or a tap on
// the water puts the fish in -- it joins your active fish and swims there, earning.
//
// createFishPlacer({ scene, camera, canvas, plots, getHeld, toast, fx })
//   getHeld() -> uid of the backpack fish in hand, or null
//   -> { update(dt) }   (after the camera has moved this frame)
import { Group, Mesh, MeshBasicMaterial, Raycaster, RingGeometry, CircleGeometry, Vector2 } from 'three'
import { player } from '../player.js'
import { activeCount, placeFish, state } from '../activeFish.js'
import { inventory } from '../inventory.js'
import { FISH } from '../config.js'
import * as fishSound from '../audio/fishPanelSfx.js'
import { sfx } from '../audio/index.js'

const RANGE = 30 // m from you to the spot you aim at
const TAP_MS = 350 // a press shorter than this (and barely moved) is a click / tap
const TAP_PX = 10

export function createFishPlacer({ scene, camera, canvas, plots, getHeld, toast, fx }) {
  const ray = new Raycaster()
  const ndc = new Vector2()
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, seen: false }

  // The ring on the water.
  const marker = new Group()
  const ringMat = new MeshBasicMaterial({ color: '#4dff6a', transparent: true, opacity: 0.85, depthWrite: false })
  const fillMat = new MeshBasicMaterial({ color: '#4dff6a', transparent: true, opacity: 0.22, depthWrite: false })
  const ring = new Mesh(new RingGeometry(0.62, 0.8, 32), ringMat)
  const fill = new Mesh(new CircleGeometry(0.62, 32), fillMat)
  for (const m of [ring, fill]) {
    m.rotation.x = -Math.PI / 2
    m.renderOrder = 3
    marker.add(m)
  }
  marker.visible = false
  scene.add(marker)

  const locked = () => document.pointerLockElement === canvas
  // Where the screen point (CSS px) meets your pond, within RANGE of you, or null.
  function aim(x, y) {
    if (locked()) ndc.set(0, 0)
    else ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = plots.hitMyPond(ray.ray)
    if (!hit) return null
    const p = player.position
    return Math.hypot(hit.x - p.x, hit.z - p.z) <= RANGE ? hit.clone() : null
  }

  function place(at) {
    const uid = getHeld()
    if (uid == null) return
    const fish = inventory.fish.find((f) => f.uid === uid)
    const res = placeFish(uid)
    if (res === 'full') {
      sfx.deny()
      toast(`Your pond is full (${activeCount()}/${state.slots})! Upgrade your Base for more slots.`)
      return
    }
    if (res !== 'ok') return
    fishSound.equipBest(1, 0)
    fx?.ring({ x: at.x, y: 0.17, z: at.z }, { size: 2.4, life: 0.9 })
    fx?.burst({ x: at.x, y: 0.3, z: at.z }, { kind: 'glow', count: 22, color: '#d8faff', speed: 3, up: 5, size: 0.3, life: 0.8, gravity: 12 })
    toast(`${FISH[fish?.species]?.name ?? 'Fish'} is swimming in your pond! (${activeCount()}/${state.slots})`)
  }

  // Clicks / taps: on the canvas, the touch look zone, or anywhere while the cursor is locked.
  const onWorld = (e) => locked() || e.target === canvas || e.target?.classList?.contains('touch-right')
  let down = null
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.seen = true
  })
  window.addEventListener('pointerdown', (e) => {
    down = e.button === 0 && onWorld(e) ? { x: e.clientX, y: e.clientY, t: performance.now() } : null
  })
  window.addEventListener('pointerup', (e) => {
    const d = down
    down = null
    if (!d || getHeld() == null) return
    if (performance.now() - d.t > TAP_MS || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX) return
    const at = aim(e.clientX, e.clientY)
    if (at) place(at)
  })

  let t = 0
  return {
    update(dt) {
      t += dt
      const at = getHeld() != null && (pointer.seen || locked()) ? aim(pointer.x, pointer.y) : null
      marker.visible = !!at
      if (!at) return
      const full = activeCount() >= state.slots
      const color = full ? '#ff4a4a' : '#4dff6a'
      ringMat.color.set(color)
      fillMat.color.set(color)
      marker.position.set(at.x, 0.17, at.z)
      marker.scale.setScalar(1 + Math.sin(t * 6) * 0.08)
    },
  }
}
