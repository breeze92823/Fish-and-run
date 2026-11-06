// The fish Index (collection): one page per lane zone listing the fish it holds, in
// the zone's order. A species is unlocked the first time it joins the backpack (caught, or the
// starter fish); each unlocked species pays its INDEX_REWARDS once when claimed.
// Saved through net.js (saves.js). onIndexChange(fn): fn(reason, ids) on 'unlock' | 'claim' | 'load'.
import { FISH, INDEX_REWARDS, ZONES } from './config.js'
import { grant, inventory, subscribe } from './inventory.js'

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

// [{ id, name, banner, fish: [species ids] }] in ZONES order; total = every species listed.
export const indexZones = ZONES.map((z) => ({
  id: z.id,
  name: title(z.name),
  banner: z.banner,
  fish: [...new Set(z.fish.map(([id]) => id))].filter((id) => FISH[id]),
}))
export const allSpecies = [...new Set(indexZones.flatMap((z) => z.fish))]

const unlocked = new Set()
const claimed = new Set()
const listeners = new Set()
const emit = (reason, ids) => listeners.forEach((fn) => fn(reason, ids))

export function onIndexChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function scan() {
  const fresh = []
  for (const f of inventory.fish) {
    if (unlocked.has(f.species)) continue
    unlocked.add(f.species)
    fresh.push(f.species)
  }
  if (fresh.length) emit('unlock', fresh)
}
scan()
subscribe(scan)

export const isUnlocked = (id) => unlocked.has(id)
export const isClaimed = (id) => claimed.has(id)
export const canClaim = (id) => unlocked.has(id) && !claimed.has(id)
export const rewardOf = (id) => INDEX_REWARDS[FISH[id]?.rarity] ?? INDEX_REWARDS.COMMON
export const unlockedCount = () => allSpecies.reduce((n, id) => n + unlocked.has(id), 0)
export const zoneUnlocked = (zone) => zone.fish.reduce((n, id) => n + unlocked.has(id), 0)
export const pendingClaims = () => allSpecies.reduce((n, id) => n + canClaim(id), 0)

// --- Save ---
export const snapshotIndex = () => ({ unlocked: [...unlocked], claimed: [...claimed] })
export function hydrateIndex(doc) {
  if (Array.isArray(doc.unlocked)) for (const id of doc.unlocked) if (FISH[id]) unlocked.add(id)
  if (Array.isArray(doc.claimed)) {
    claimed.clear()
    for (const id of doc.claimed) if (FISH[id]) claimed.add(id)
  }
  scan()
  emit('load', [])
}

// Pays the species' reward once. Returns the reward, or null if it can't be claimed.
export function claim(id) {
  if (!canClaim(id)) return null
  claimed.add(id)
  const r = rewardOf(id)
  grant(r.cash, r.gems)
  emit('claim', [id])
  return r
}
