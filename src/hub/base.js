// Your base (BASE in config): its level sets how many fish can swim in your pond (slots) and
// what the plot looks like (tier: fence, deck, decorations, and the treadmill from level 2,
// drawn by plots.js / baseDecor.js). The Upgrade Base sign stands in front of your plot, right
// of the gate; within BASE.range of it E / the action button buys the next level. The level is
// saved (net.js via saves: snapshot / hydrate) and sent to the others with your plot snapshot.
//
// createBase({ plots, laneHud, toast, fx }) -> { update(pos), interact(), level(), snapshot(), hydrate(doc) }
import { BASE, COARSE_POINTER, PLOT } from '../config.js'
import { player } from '../player.js'
import { inventory, spend } from '../inventory.js'
import { setSlots } from '../activeFish.js'
import { formatMoney } from '../hud/hud.js'
import { sfx } from '../audio/index.js'
import { buildUpgradeSign } from './props.js'

export function createBase({ plots, laneHud, toast, fx }) {
  const { width: W } = PLOT.pool
  const lz = W / 2 + PLOT.fence.border + PLOT.baseSign.z
  const sign = buildUpgradeSign()
  sign.group.position.set(PLOT.baseSign.x, 0, lz)
  sign.group.rotation.y = 0.25
  plots.myRoot().add(sign.group)
  const [sx, sz] = plots.myToWorld(PLOT.baseSign.x, lz)

  let level = 1
  const cur = () => BASE.levels[level - 1]
  const next = () => BASE.levels[level] ?? null
  let shownOk = null

  function repaint() {
    const n = next()
    const ok = !!n && inventory.money >= n.cost
    shownOk = ok
    const line = !n ? `${cur().slots} slots (max)` : level === 1 ? `+Treadmill, ${n.slots} slots` : `${cur().slots} > ${n.slots} slots`
    sign.set({ title: `Base Lv ${level}`, line, price: n ? formatMoney(n.cost) : null, ok })
  }
  // The level's slots and look.
  function apply() {
    setSlots(cur().slots)
    plots.setMyLevel(level)
    repaint()
  }
  apply()

  function buy() {
    const n = next()
    if (!n) {
      sfx.deny()
      toast('Your base is already at max level!')
      return
    }
    if (!spend(n.cost)) {
      sfx.deny()
      toast(`Not enough money! You need ${formatMoney(n.cost)}.`)
      return
    }
    const tier = cur().tier
    level++
    apply()
    sfx.upgrade(level)
    const [cx, cz] = plots.myToWorld(0, 0)
    fx?.burst({ x: cx, y: 1.5, z: cz }, { kind: 'spark', count: 40, color: '#fff2a0', speed: 5, up: 5, size: 0.6, life: 1.1, gravity: 4 })
    if (level === 2) toast('Base upgraded! You got a Treadmill: walk on it to get faster.')
    else if (cur().tier !== tier) toast(`Base upgraded to Level ${level}: ${BASE.tiers[cur().tier].name} look! ${cur().slots} fish slots`)
    else toast(`Base upgraded to Level ${level}! ${cur().slots} fish slots`)
  }

  let prompt = false
  return {
    level: () => level,
    snapshot: () => ({ baseLevel: level }),
    hydrate(doc) {
      if (!Number.isInteger(doc.baseLevel)) return
      level = Math.min(BASE.levels.length, Math.max(1, doc.baseLevel))
      apply()
    },
    // E: buys the next level while the prompt is up. false if it isn't (E falls through).
    interact() {
      if (!prompt) return false
      buy()
      return true
    },
    // pos = player feet.
    update(pos) {
      const n = next()
      const ok = !!n && inventory.money >= n.cost
      if (ok !== shownOk) repaint()
      const near = !player.frozen && Math.hypot(pos.x - sx, pos.z - sz) < BASE.range
      if (near) laneHud.setAction({ title: `${COARSE_POINTER ? '' : '[E] '}Base Lv ${level}`, price: n ? `Upgrade ${formatMoney(n.cost)}` : 'MAX', ok, fn: buy })
      else if (prompt) laneHud.setAction(null)
      prompt = near
    },
  }
}
