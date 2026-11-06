// Which trails the local player owns and which one is equipped (saved through net.js).
// Trails are bought with cash (inventory.spend). The equipped trail's `speed` multiplies
// the player's run speed (trailSpeed()); with none equipped it is x1.
// onTrailsChange(fn) runs fn(reason) after every change: 'buy' | 'equip'.
import { TRAILS } from '../config.js'
import { spend } from '../inventory.js'

export const trailById = new Map(TRAILS.map((t) => [t.id, t]))
const START = TRAILS.find((t) => t.start) ?? null

const owned = new Set(TRAILS.filter((t) => t.price <= 0).map((t) => t.id))
if (START) owned.add(START.id)
let equipped = START?.id ?? null

const listeners = new Set()
export function onTrailsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (reason) => listeners.forEach((fn) => fn(reason))

export const isTrailOwned = (id) => owned.has(id)
export const equippedTrailId = () => equipped
export const equippedTrail = () => (equipped ? trailById.get(equipped) : null)
export const trailSpeed = () => equippedTrail()?.speed ?? 1

// --- Save ---
export const snapshotTrails = () => ({ trails: [...owned], trail: equipped ?? '' })
export function hydrateTrails(doc) {
  if (Array.isArray(doc.trails)) for (const id of doc.trails) if (trailById.has(id)) owned.add(id)
  if (doc.trail === '') equipped = null
  else if (typeof doc.trail === 'string' && owned.has(doc.trail)) equipped = doc.trail
  emit('equip')
}

// 'ok' | 'owned' | 'poor' | 'unknown'
export function buyTrail(id) {
  const t = trailById.get(id)
  if (!t) return 'unknown'
  if (owned.has(id)) return 'owned'
  if (!spend(t.price)) return 'poor'
  owned.add(id)
  emit('buy')
  return 'ok'
}

// Equips an owned trail; id = null takes the trail off (x1 speed, no ribbon).
// Returns false if the trail isn't owned or nothing changed.
export function equipTrail(id) {
  if (id !== null && !owned.has(id)) return false
  if (id === equipped) return false
  equipped = id
  emit('equip')
  return true
}
