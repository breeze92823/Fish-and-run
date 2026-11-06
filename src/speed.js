// The speed stat (SPEED in config). Trained speed comes from the plot treadmill and is
// kept here (saved through net.js); the stat the game uses is trained x the equipped
// trail's multiplier. player.js turns the stat into run speed, lane guards chase at a
// zone's recommended speed.
//   onSpeedChange(fn) runs fn() after the trained speed or the trail changes.
import { PHYSICS, SPEED, SPEED_BOOST } from './config.js'
import { onTrailsChange, trailSpeed } from './trails/state.js'

let trained = SPEED.start
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
onTrailsChange((reason) => reason === 'equip' && emit())

export function onSpeedChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const trainedSpeed = () => trained
export function addSpeed(n) {
  if (!(n > 0)) return
  trained += n
  emit()
}
export const snapshotSpeed = () => ({ trained })
export function hydrateSpeed(doc) {
  if (Number.isFinite(doc.trained) && doc.trained >= SPEED.start) trained = doc.trained
  emit()
}
// Timed x2 boost bought from the HUD (session only, not saved).
let boostUntil = 0
let boostTimer = 0
export const boostLeft = () => Math.max(0, Math.ceil((boostUntil - Date.now()) / 1000))
export function startBoost(seconds) {
  boostUntil = Math.max(Date.now(), boostUntil) + seconds * 1000 // buying again extends it
  clearTimeout(boostTimer)
  boostTimer = setTimeout(emit, boostLeft() * 1000 + 50)
  emit()
}
// The stat everything compares: trained x trail x boost.
export const speedStat = () => trained * trailSpeed() * (boostLeft() > 0 ? SPEED_BOOST.mult : 1)

// m/s for a speed stat: the base walk / sprint grows by the same step per power of ten.
export function runSpeed(stat, sprint = false) {
  const base = sprint ? PHYSICS.sprintSpeed : PHYSICS.walkSpeed
  return base * (1 + Math.log10(Math.max(1, stat)) * SPEED.perDecade)
}
// A zone guard sprints a little slower than a player sprinting at the zone's recommended speed.
export const guardSpeed = (zone) => runSpeed(zone.speed ?? 1, true) * SPEED.chaseFactor

// 1.25 / 24 / 1.2K / 3.4M (whole numbers from 10 up, short units from 1K).
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
export function formatSpeed(n) {
  n = Math.max(0, +n || 0)
  if (n < 10) return String(Math.floor(n * 100) / 100)
  let u = 0
  while (n >= 1000 && u < UNITS.length - 1) {
    n /= 1000
    u++
  }
  const v = u === 0 ? Math.floor(n) : Math.floor(n * (n >= 100 ? 1 : 10)) / (n >= 100 ? 1 : 10)
  return `${v}${UNITS[u]}`
}
