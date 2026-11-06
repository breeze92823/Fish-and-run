// Active (equipped) fish: up to `state.slots` fish from the backpack (inventory.js) swim in
// your pond and earn money every second. The slot count is the base level's (hub/base.js setSlots). Equipped fish are tracked by uid; a fish that
// leaves the backpack (sold) simply stops counting.
// onEquipChange(fn): fn(reason) after every change here ('unequip' | 'equip-best' | 'slot').
import { BASE, START_FISH } from './config.js'
import { addFish, inventory, loadInventory, subscribe } from './inventory.js'

const equipped = new Set()
for (const f of START_FISH) {
  const fish = addFish(f.species, f.weight, f.earn)
  if (f.mutation) fish.mutation = f.mutation
  if (f.equipped) equipped.add(fish.uid)
}

export const state = { slots: BASE.levels[0].slots }

const listeners = new Set()
export function onEquipChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (reason) => listeners.forEach((fn) => fn(reason))

// Drop uids of fish that left the backpack (sold), so counts stay right.
subscribe(() => {
  const have = new Set(inventory.fish.map((f) => f.uid))
  let gone = false
  for (const uid of equipped) if (!have.has(uid)) gone = equipped.delete(uid) || gone
  if (gone) emit('sold')
})

// For the hub (plot pool) and HUD: the active fish's species ids, best first, and a
// listener for any change to them. Money lives in inventory.money (inventory.js).
export const getActiveFishIds = () => activeFish().map((f) => f.species)
export const onActiveFishChanged = onEquipChange
export const getMoney = () => inventory.money

export const isEquipped = (uid) => equipped.has(uid)
const byEarn = (a, b) => b.earn - a.earn || a.uid - b.uid

// Equipped fish, best first.
export function activeFish() {
  return inventory.fish.filter((f) => equipped.has(f.uid)).sort(byEarn)
}
export const activeCount = () => activeFish().length
export const totalEarn = () => activeFish().reduce((s, f) => s + f.earn, 0)

export function unequip(uid) {
  if (!equipped.delete(uid)) return false
  emit('unequip')
  return true
}

// Fills the active slots with the best fish in the backpack. Returns the uids that moved in.
export function equipBest() {
  const best = [...inventory.fish].sort(byEarn).slice(0, state.slots)
  const before = new Set(equipped)
  equipped.clear()
  for (const f of best) equipped.add(f.uid)
  const added = best.filter((f) => !before.has(f.uid)).map((f) => f.uid)
  if (added.length || before.size !== equipped.size) emit('equip-best')
  return added
}

// The base level's slot count (hub/base.js). Fish past it stop swimming (worst first).
export function setSlots(n) {
  if (n === state.slots) return
  const grew = n > state.slots
  state.slots = n
  const keep = activeFish().slice(0, n).map((f) => f.uid)
  if (keep.length < equipped.size) {
    equipped.clear()
    for (const uid of keep) equipped.add(uid)
  }
  emit(grew ? 'slot' : 'unequip')
}
export const maxSlots = () => BASE.levels[BASE.levels.length - 1].slots

// Puts backpack fish `uid` in the pond: 'ok' | 'full' (every slot taken) | 'missing'.
export function placeFish(uid) {
  if (!inventory.fish.some((f) => f.uid === uid)) return 'missing'
  if (equipped.has(uid)) return 'ok'
  if (equipped.size >= state.slots) return 'full'
  equipped.add(uid)
  emit('place')
  return 'ok'
}

// Income: the active fish pay into inventory.money once a second (also while the
// panel is closed; this module loads with the HUD).
setInterval(() => {
  const n = totalEarn()
  inventory.money += n
  inventory.earned += n
}, 1000)

// --- Save (net.js via saves.js) ---------------------------------------------------------
// The backpack with each fish's equipped flag, the slot count and the income rate.
export function snapshotFish() {
  return {
    money: inventory.money,
    gems: inventory.gems,
    earned: inventory.earned,
    caught: inventory.caught,
    income: totalEarn(),
    slots: state.slots,
    fish: inventory.fish.map((f) => ({ species: f.species, weight: f.weight, earn: f.earn, mutation: f.mutation ?? '', equipped: equipped.has(f.uid), hotbar: !!f.hotbar })),
  }
}
export function hydrateFish(doc) {
  const fish = loadInventory(doc)
  if (fish) {
    equipped.clear()
    fish.forEach((f, i) => {
      if (doc.fish[i]?.equipped && equipped.size < state.slots) equipped.add(f.uid)
    })
  }
  emit('load')
}

// $10K, $269.4K, $218.16K, $1.5M ...
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qd', 'Qn']
export function formatMoney(n) {
  n = Math.floor(n)
  let u = 0
  while (Math.abs(n) >= 1000 && u < UNITS.length - 1) {
    n /= 1000
    u++
  }
  return `$${u === 0 ? n : Math.floor(n * 100) / 100}${UNITS[u]}`
}
