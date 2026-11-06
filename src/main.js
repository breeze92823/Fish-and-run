import { ACESFilmicToneMapping, Clock, NeutralToneMapping, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, ECONOMY, FISH, graphicsPreset, MY_PLOT, NET, OFFER_ROTATE, OFFERS, RENDER, SPEED_BOOST, TIME_OF_DAY } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey } from './input.js'
import { installAudio } from './audio/index.js'
import { closeSellFish, openSellFish } from './sellFish.js'
import { closeIndex, openIndex, toggleIndex } from './hud/indexWindow.js'
import { closeRods, openRods } from './rods/window.js'
import { equippedRodId, onRodsChange } from './rods/state.js'
import { rodThumb } from './rods/thumbs.js'
import { closeTrails, openTrails } from './trails/window.js'
import { equippedTrail, equippedTrailId, hydrateTrails, onTrailsChange, snapshotTrails } from './trails/state.js'
import { boostLeft, formatSpeed, onSpeedChange, speedStat, startBoost } from './speed.js'
import { createTreadmill } from './hub/treadmill.js'
import { createBase } from './hub/base.js'
import { createFishPlacer } from './hub/placeFish.js'
import { createTrail } from './hub/trail.js'
import { createHud } from './hud/hud.js'
import { getActiveFishIds, getMoney, onActiveFishChanged, totalEarn } from './activeFish.js'
import { createOfferView } from './offerModel.js'
import { addFish, grant, inventory, spend, subscribe as onInventory } from './inventory.js'
import { isEquipped } from './activeFish.js'
import { fishThumb } from './fishThumbs.js'
import { createFx } from './fx.js'
import { createLaneHud } from './hud/laneHud.js'
import { buildLane } from './lane/index.js'
import { closeFishPanel, toggleFishPanel } from './hud/fishPanel.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createWorld } from './world.js'
import { buildHub } from './hub/index.js'
import { fishTime, formatEarn } from './hub/fish.js'
import { initNet, net, onLeaderboard, onNetMessage, roster, sendLoadout, sendPlot, sendPose, setStores, setWantedBase, syncAvatar, waitForBase } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { hydrateFish, snapshotFish } from './activeFish.js'
import { hydrateIndex, snapshotIndex } from './fishIndex.js'
import { hydrateRods, snapshotRods } from './rods/state.js'
import { hydrateSpeed, snapshotSpeed } from './speed.js'
import { formatMoney } from './hud/hud.js'
import { setParticleDensity, updateParticles } from './particles.js'
import { equipTool } from './tools.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions } from './avatar/loader.js'
import { buildLook } from './avatar/look.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    setParticleDensity(next.particles)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = RENDER.toneMapping === 'neutral' ? NeutralToneMapping : ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => closeSellFish() || closeRods() || closeTrails() || closeIndex() || closeFishPanel() || bloxity.showMenu(), renderer.domElement) // Esc closes an open window, else opens the portal menu
installAudio() // the context starts on the first gesture
// HUD: buttons report through onAction(name). 'fish' = the right-edge Fish tile.
const hud = createHud({
  onAction(name, value) {
    if (name === 'fish') toggleFishPanel()
    else if (name === 'index') toggleIndex()
    else if (name === 'slowMode') {
      player.speedScale = value ? ECONOMY.slowModeSpeed : 1
      hud.setSlowMode(value)
    } else if (name === 'equip') {
      equip(value)
    } else if (name === 'speed') buySpeedBoost()
    else if (name === 'offer') buyOffer()
    else if (name === 'shop' || name === 'gems') hud.toast('Coming soon!')
  },
})
onNetMessage('schedule', (sc) => hud.setSchedule(sc)) // server clock for the Update / Next event countdowns
hud.setGems(inventory.gems)
onInventory(() => hud.setGems(inventory.gems))
hud.setEquipped(1)

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene) // clouds
// Multiplayer + saves (net.js): join a room and wait (at most NET.joinWait s) for the plot the
// server gives us, so the hub is built with our pool and treadmill on it. Offline (no server, or
// none answered) we take MY_PLOT and the other plots stay empty.
initNet()
bloxity.loadingStep('Finding a server')
const base = await waitForBase(NET.joinWait * 1000)
const myPlot = base >= 0 ? base : MY_PLOT
setWantedBase(myPlot)
const hub = buildHub(scene, { myName: bloxity.displayName(), myPlot })
hub.onPad((id, def) => {
  if (id === 'sell') openSellFish()
  else if (id === 'rods') openRods()
  else if (id === 'trails') openTrails()
  else hud.toast(`${def.label} shop coming soon!`)
})
createPlayerBody()
syncYawToPlayer()
const fx = createFx(scene)

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar) // the rig is still in its bind pose here
  equipTool(avatar, equippedSlot, hotbarSpecies(equippedSlot))
}

// Hotbar: 1 = fishing rod, 2 = bat, 3+ = fish caught in the lane and not yet put in
// the plot (grouped by species + weight), held in the right hand.
let equippedSlot = 1
let hotbarFish = []
function hotbarSpecies(slot) {
  return slot >= 3 ? (hotbarFish[slot - 3]?.species ?? null) : null
}
function refreshHotbar() {
  const groups = new Map()
  for (const f of inventory.fish) {
    if (!f.hotbar || isEquipped(f.uid)) continue
    const key = `${f.species}|${f.weight}`
    const g = groups.get(key)
    if (g) g.count++
    else groups.set(key, { species: f.species, weight: f.weight, count: 1 })
  }
  hotbarFish = [...groups.values()]
  hud.setBackpackFish(hotbarFish.map((g) => ({ img: fishThumb(g.species), label: `${g.weight}Kg`, count: g.count })))
  if (equippedSlot >= 3 && !hotbarFish[equippedSlot - 3]) equip(null)
}
function equip(slot) {
  equippedSlot = slot
  hud.setEquipped(slot)
  if (!avatar) return
  // Tools attach in the bind pose: rebuild the animator around a reset rig.
  disposeAnimator(animator)
  animator = makeAnimator(avatar)
  equipTool(avatar, slot, hotbarSpecies(slot))
}

// --- The run lane: zones, fishing, the guard, carrying fish home --------------------
const laneHud = createLaneHud(hud.root, { onCast: () => lane.tryCast(), onStop: () => lane.reset(), onClick: () => lane.click() })
const skyMoods = new Map()
const lane = buildLane(scene, {
  fx,
  laneHud,
  toast: (m) => hud.toast(m),
  playerGroup,
  canvas: renderer.domElement,
  getAvatar: () => avatar,
  getAnimator: () => animator,
  getSlot: () => equippedSlot,
  // Each zone's sky tint over the default daylight (cached so a zone keeps one mood object).
  setSky(sky) {
    if (!sky) return lighting.setMoods(TIME_OF_DAY)
    if (!skyMoods.has(sky)) skyMoods.set(sky, { day: { ...TIME_OF_DAY.day, ...sky }, night: TIME_OF_DAY.night })
    lighting.setMoods(skyMoods.get(sky))
  },
  // Home with a catch: it goes in the backpack and straight into your hands, ready to be put in
  // your pond (click the water: hub/placeFish.js).
  onDeliver({ species, weight, earn }) {
    inventory.caught++
    addFish(species, weight, earn).hotbar = true
    refreshHotbar()
    const i = hotbarFish.findIndex((g) => g.species === species && g.weight === weight)
    if (i >= 0) equip(3 + i)
    if (inventory.caught <= 3) setTimeout(() => hud.toast('Click the water in your base to put your fish in!'), 1600)
  },
})
// A new rod: swap the model in hand (if the rod slot is held) and the hotbar picture.
const syncRodIcon = () => hud.setSlotImage(1, rodThumb(equippedRodId()))
onRodsChange((reason) => {
  if (reason !== 'equip') return
  if (equippedSlot === 1) equip(1)
  syncRodIcon()
})
syncRodIcon()
onInventory(refreshHotbar)
onActiveFishChanged(refreshHotbar)
refreshHotbar()
// The speed stat (trained on the treadmill x the trail) sets run speed; the HUD shows it.
let shownStat = 0
function syncSpeed() {
  const stat = speedStat()
  player.speedStat = stat
  hud.setSpeed(formatSpeed(stat), stat > shownStat && shownStat > 0)
  shownStat = stat
}
onSpeedChange(syncSpeed)
syncSpeed()
hud.setSpeedBoost({ price: SPEED_BOOST.price })
let shownBoost = -1
function tickBoost() {
  const left = boostLeft()
  if (left !== shownBoost) hud.setSpeedBoost({ price: SPEED_BOOST.price, secondsLeft: (shownBoost = left) })
}
const treadmill = createTreadmill({ scene, plots: hub.plots, laneHud, toast: (m) => hud.toast(m) })
const myBase = createBase({ plots: hub.plots, laneHud, toast: (m) => hud.toast(m), fx })
// The backpack fish in your hand (hotbar 3+), as a uid, for putting it in the pond.
function heldFishUid() {
  const g = equippedSlot >= 3 ? hotbarFish[equippedSlot - 3] : null
  if (!g) return null
  return inventory.fish.find((f) => f.hotbar && !isEquipped(f.uid) && f.species === g.species && f.weight === g.weight)?.uid ?? null
}
const placer = createFishPlacer({ scene, camera, canvas: renderer.domElement, plots: hub.plots, getHeld: heldFishUid, toast: (m) => hud.toast(m), fx })

// --- Saves (net.js): every part of the progress, each { snapshot(), hydrate(doc) } ---------------
// Order matters on load: the backpack before the Index (its fish unlock their species).
setStores([
  { snapshot: myBase.snapshot, hydrate: myBase.hydrate }, // the base level first: it sets the pond's slots
  { snapshot: snapshotFish, hydrate: hydrateFish }, // money, gems, lifetime counters, income, slots, fish
  { snapshot: snapshotRods, hydrate: hydrateRods },
  { snapshot: snapshotTrails, hydrate: hydrateTrails },
  { snapshot: snapshotSpeed, hydrate: hydrateSpeed },
  { snapshot: snapshotIndex, hydrate: hydrateIndex },
  { snapshot: treadmill.snapshot, hydrate: treadmill.hydrate },
  // Offline earnings: the server works out income x offline rate x time away (capped at a day).
  {
    snapshot: () => ({}),
    hydrate(doc) {
      if (!(doc.offline > 0)) return
      grant(doc.offline)
      setTimeout(() => hud.toast(`Welcome back! Your fish earned ${formatMoney(doc.offline)} while you were away`), 1500)
    },
  },
])

// --- Multiplayer: the other players, their plots and the leaderboard ----------------------------
const remotes = createRemotePlayers(scene)
// This player as the others draw them: the pose (each frame, net.js throttles), and what is in hand.
function sendPresence() {
  const v = player.velocity
  sendPose({ x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.facing, speed: Math.hypot(v.x, v.z), vy: v.y, grounded: player.grounded, knocked: lane.mode === 'thrown' })
  const slot = equippedSlot ?? 0
  sendLoadout({ rod: equippedRodId(), trail: equippedTrailId() ?? '', slot: Math.min(3, slot), item: slot >= 3 ? hotbarSpecies(slot) ?? '' : '', hold: lane.carrying ?? '' })
}
// Twice a second: our plot for the others (the pool's fish, the treadmill tier), and the other
// players' plots from the roster (an unowned plot is left empty).
const plotCache = new Map() // plot JSON -> parsed
setInterval(() => {
  sendPlot(JSON.stringify({ f: getActiveFishIds().slice(0, NET.plotFish), t: treadmill.look(), b: myBase.level() }))
  const players = roster()
  if (!players) return
  const owners = new Map()
  players.forEach((p, id) => {
    if (id === net.sessionId || p.base < 0 || p.base === myPlot) return
    let snap = plotCache.get(p.plot)
    if (!snap) {
      try {
        snap = p.plot ? JSON.parse(p.plot) : {}
      } catch {
        snap = {}
      }
      if (plotCache.size > 64) plotCache.clear()
      plotCache.set(p.plot, snap)
    }
    owners.set(p.base, { name: p.username || 'Player', fish: Array.isArray(snap.f) ? snap.f.slice(0, NET.plotFish) : [], treadmill: typeof snap.t === 'string' ? snap.t : 'stone', level: Number.isInteger(snap.b) ? snap.b : 1 })
  })
  hub.plots.plots.forEach((_, i) => i !== myPlot && hub.plots.setOwner(i, owners.get(i) ?? null))
}, 500)
// The MOST CASH/S board: the server's top earners (income $/s).
onLeaderboard((lb) => {
  const rows = lb.boards?.income
  if (Array.isArray(rows)) hub.board.setRows(rows.slice(0, 8).map((r) => [String(r.name ?? 'Player'), `${formatEarn(+r.value || 0)}/s`]))
})

// The equipped trail: a ribbon streaming from the player's feet.
let myTrail = null
function syncTrail() {
  const t = equippedTrail()
  if (!t) {
    if (myTrail) myTrail.mesh.visible = false
    return
  }
  if (!myTrail) myTrail = createTrail(scene, t.colors)
  else myTrail.setColors(t.colors)
  myTrail.reset()
  myTrail.mesh.visible = true
}
onTrailsChange(syncTrail)
syncTrail()

const respawnAll = () => {
  lane.reset()
  respawn()
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const signed = !!bloxity.authState.user
    const group = await buildLook(
      { equipped: signed ? bloxity.getEquippedAvatar() : null, proportions: signed ? bloxity.getProportions() : null, skin: bloxity.getSkinTextureUrl() },
      () => mine !== generation,
    )
    if (!group || mine !== generation) return
    setAvatar(group)
    syncAvatar() // the others see the new look
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
    hub.setMyName(bloxity.displayName())
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => !avatar?.isCustomCharacter && applyProportions(avatar, bloxity.getProportions()))
bloxity.onRespawnRequest(respawnAll)

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
onKey('KeyV', toggleMode)
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', respawnAll)
onKey('KeyE', () => myBase.interact() || treadmill.interact() || lane.tryCast())
installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn: respawnAll })

// --- Your plot + economy ------------------------------------------------------
// activeFish.js owns money and the active fish; the plot swims them and the HUD
// shows the rates (offline earnings are ECONOMY.offlineRate of the online rate).
function syncActiveFish() {
  const earn = totalEarn()
  hub.setMyFish(getActiveFishIds(), earn)
  hud.setOfflinePerDay(earn * 86400 * ECONOMY.offlineRate)
}
onActiveFishChanged(syncActiveFish)
syncActiveFish()
hud.setMoney(getMoney())

// The rotating best-fish offer (top-right card) and its 3D model.
const offerView = hud.offerBox() ? createOfferView(hud.offerBox()) : null
let offerIndex = -1
function updateOffer(elapsed) {
  const i = Math.floor(elapsed / OFFER_ROTATE) % OFFERS.length
  if (i !== offerIndex) {
    offerIndex = i
    const o = OFFERS[i]
    hud.setOffer({ percent: o.percent, name: FISH[o.fish].name, price: o.price })
    offerView?.setFish(o.fish)
  }
  offerView?.update(elapsed)
}
// Buy the current offer with cash: the fish goes straight into your hands, like a delivered catch.
function buyOffer() {
  const o = OFFERS[Math.max(0, offerIndex)]
  if (!spend(o.price)) return hud.toast('Not enough cash!')
  inventory.caught++
  const earn = Math.max(1, Math.round(FISH[o.fish].earn * (o.earnMult ?? 1)))
  addFish(o.fish, 1, earn).hotbar = true
  refreshHotbar()
  const i = hotbarFish.findIndex((g) => g.species === o.fish)
  if (i >= 0) equip(3 + i)
  hud.toast(`Bought ${FISH[o.fish].name}!`)
}
function buySpeedBoost() {
  if (!spend(SPEED_BOOST.price)) return hud.toast('Not enough cash!')
  startBoost(SPEED_BOOST.duration)
  hud.toast(`x${SPEED_BOOST.mult} Speed for ${Math.round(SPEED_BOOST.duration / 60)} min!`)
}

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0

let elapsed = 0
// One frame. `fixedDt` (dev only, __game.advance) steps the game without real time passing.
function frame(fixedDt) {
  const dt = fixedDt ?? Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  elapsed += dt
  tickBoost()

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
  })

  updateCamera(camera, dt)
  placer.update(dt)
  world.update(dt, elapsed)
  fishTime.value = elapsed
  hub.update(dt, elapsed, player.renderPosition)
  treadmill.update(dt, player.position)
  myBase.update(player.position)
  lane.update(dt, elapsed)
  remotes.update(dt, player.renderPosition)
  sendPresence()
  if (myTrail?.mesh.visible) myTrail.update(dt, p.x, p.y, p.z)
  laneHud.update(dt)
  fx.update(dt, renderer.domElement.height)
  hud.setMoney(getMoney())
  hud.update(dt)
  updateOffer(elapsed)
  updateParticles(elapsed, renderer.domElement.height)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
let paused = false // dev: __game.pause(true) freezes the loop (step it with __game.advance)
renderer.setAnimationLoop(() => paused || frame())

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, treadmill, base: myBase, net, remotes, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, hub, equip, lane, advance: (seconds, step = 1 / 60) => { for (let t = 0; t < seconds; t += step) frame(step) }, pause: (on) => { paused = on; if (!on) clock.getDelta() }, openSellFish, openIndex, openRods, openTrails }
}
