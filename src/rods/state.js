// Which fishing rods the local player owns and which one is equipped (saved through net.js). Rods are bought with cash (inventory.spend). onRodsChange(fn) runs fn(reason)
// after every change: 'buy' | 'equip'.
import { RODS } from '../config.js'
import { spend } from '../inventory.js'

export const rodById = new Map(RODS.map((r) => [r.id, r]))
const START = RODS.find((r) => r.start) ?? RODS[0]

const owned = new Set(RODS.filter((r) => r.price <= 0).map((r) => r.id))
owned.add(START.id)
let equipped = START.id

const listeners = new Set()
export function onRodsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (reason) => listeners.forEach((fn) => fn(reason))

export const isOwned = (id) => owned.has(id)
export const equippedRodId = () => equipped
export const equippedRod = () => rodById.get(equipped) ?? START
export const startRodId = START.id

// --- Save ---
export const snapshotRods = () => ({ rods: [...owned], rod: equipped })
export function hydrateRods(doc) {
  if (Array.isArray(doc.rods)) for (const id of doc.rods) if (rodById.has(id)) owned.add(id)
  if (typeof doc.rod === 'string' && owned.has(doc.rod)) equipped = doc.rod
  emit('equip')
}

// 'ok' | 'owned' | 'poor' | 'unknown'
export function buyRod(id) {
  const r = rodById.get(id)
  if (!r) return 'unknown'
  if (owned.has(id)) return 'owned'
  if (!spend(r.price)) return 'poor'
  owned.add(id)
  emit('buy')
  return 'ok'
}

// Equips an owned rod. Unequipping (id = null) goes back to the starter rod: you always
// hold a rod in hotbar slot 1. Returns false if the rod isn't owned or nothing changed.
export function equipRod(id) {
  const next = id ?? START.id
  if (!owned.has(next) || next === equipped) return false
  equipped = next
  emit('equip')
  return true
}
