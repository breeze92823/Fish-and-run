// The local player's money, gems and backpack of caught fish, plus the lifetime counters the
// leaderboards rank (earned cash, fish caught). Saved through net.js (saves.js).
// A fish is { uid, species (FISH id), weight kg, earn $/s }; its sell value is
// earn * SELL.valuePerEarn. subscribe(fn) runs fn() after every change.
import { ECONOMY, SELL } from './config.js'

let nextUid = 1
const listeners = new Set()
const changed = () => listeners.forEach((fn) => fn())

export const inventory = {
  money: ECONOMY.startMoney,
  gems: ECONOMY.startGems,
  fish: SELL.starterBackpack.map((f) => ({ ...f, hotbar: true, uid: nextUid++ })), // carried, like a catch
  earned: 0, // lifetime cash earned (income, sales, rewards)
  caught: 0, // lifetime fish carried home
}

export const fishValue = (f) => f.earn * SELL.valuePerEarn

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function addFish(species, weight, earn) {
  const f = { uid: nextUid++, species, weight, earn }
  inventory.fish.push(f)
  changed()
  return f
}

// Pays `amount` from money. false (and nothing changes) if the player can't afford it.
export function spend(amount) {
  if (!(amount >= 0) || inventory.money < amount) return false
  inventory.money -= amount
  changed()
  return true
}

// Adds a reward: cash to money, gems to gems.
export function grant(cash = 0, gems = 0) {
  inventory.money += Math.max(0, +cash || 0)
  inventory.earned += Math.max(0, +cash || 0)
  inventory.gems += Math.max(0, +gems || 0)
  changed()
}

// A fish the player is carrying: caught in the lane and brought home (hotbar slots 3+), as
// opposed to one in their pool or stored on their plot. Only carried fish can be sold.
export const isCarried = (f) => !!f?.hotbar

// Sells the fish with these uids that the player is carrying (any other uid is ignored);
// returns { count, value } actually sold.
export function sellFish(uids) {
  const set = new Set(uids)
  let value = 0
  let count = 0
  inventory.fish = inventory.fish.filter((f) => {
    if (!set.has(f.uid) || !isCarried(f)) return true
    value += fishValue(f)
    count++
    return false
  })
  inventory.money += value
  inventory.earned += value
  if (count) changed()
  return { count, value }
}

// A loaded save: the whole backpack is replaced (new uids). Returns the new fish, in order.
export function loadInventory({ money, gems, earned, caught, fish }) {
  if (Number.isFinite(money)) inventory.money = money
  if (Number.isFinite(gems)) inventory.gems = gems
  if (Number.isFinite(earned)) inventory.earned = Math.max(inventory.earned, earned)
  if (Number.isFinite(caught)) inventory.caught = Math.max(inventory.caught, caught)
  let out = null
  if (Array.isArray(fish)) {
    out = fish
      .filter((f) => f && typeof f.species === 'string')
      .map((f) => {
        const n = { uid: nextUid++, species: f.species, weight: +f.weight || 0, earn: +f.earn || 0 }
        if (f.mutation) n.mutation = f.mutation
        if (f.hotbar) n.hotbar = true
        return n
      })
    inventory.fish = out
  }
  changed()
  return out
}
