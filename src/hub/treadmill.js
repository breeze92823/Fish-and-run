// The local player's treadmill (TREADMILL in config; model + sign in props.js, placed by
// plots.js). Step on the belt and you walk by yourself toward the console (any move key
// takes over) while the belt carries you back just as fast, so you stay on it; every
// `every` s of walking is +per trained speed (speed.js; a yellow "+N" rises over your head
// and the console screen flashes). Walk off the side or against the belt to leave.
// Near the Upgrade sign, E / the Upgrade button buys the next level: the sign repaints,
// and the model changes look (stone -> wood -> gold -> amethyst).
// The level is saved (net.js via saves.js: snapshot / hydrate).
//
// createTreadmill({ scene, plots, laneHud, toast }) -> { update(dt, pos), interact(), level(), snapshot(), hydrate(doc) }
import { COARSE_POINTER, TREADMILL as T } from '../config.js'
import { player } from '../player.js'
import { label } from '../propkit.js'
import { addSpeed, formatSpeed } from '../speed.js'
import { trailSpeed } from '../trails/state.js'
import { inventory, spend } from '../inventory.js'
import { formatMoney } from '../hud/hud.js'
import { sfx } from '../audio/index.js'

const POP_LIFE = 0.9 // s a "+N" rises and fades

export function createTreadmill({ scene, plots, laneHud, toast }) {
  const tm = plots.myTreadmill()
  if (!tm) return { update() {}, interact: () => false, level: () => 1, look: () => 'stone', snapshot: () => ({}), hydrate() {} }
  const c = Math.cos(tm.yaw)
  const s = Math.sin(tm.yaw)
  // Treadmill local -Z (toward the console) in world space: the way you walk on it.
  const dirX = -s
  const dirZ = -c
  const autoWalk = { x: dirX, z: dirZ, speed: T.walk }
  // World point -> treadmill-local (x across the belt, z along it, console at -Z).
  const toLocal = (x, z) => {
    const dx = x - tm.x
    const dz = z - tm.z
    return [c * dx - s * dz, s * dx + c * dz]
  }

  let level = 1
  const cur = () => T.levels[level - 1]
  const next = () => T.levels[level] ?? null
  let shownOk = null
  function repaint() {
    const n = next()
    const ok = !!n && inventory.money >= n.cost
    shownOk = ok
    const per = `+${formatSpeed(cur().per)}`
    tm.sign.set({ title: `Treadmill Lv ${level}`, line: n ? `${per} > +${formatSpeed(n.per)} /step` : `${per} /step`, price: n ? formatMoney(n.cost) : null, ok })
  }
  repaint()

  function buy() {
    const n = next()
    if (!n) {
      sfx.deny()
      toast('Your treadmill is already at max level!')
      return
    }
    if (!spend(n.cost)) {
      sfx.deny()
      toast(`Not enough money! You need ${formatMoney(n.cost)}.`)
      return
    }
    const look = cur().look
    level++
    if (cur().look !== look) plots.setMyTreadmillLook(cur().look)
    sfx.rodBuy()
    toast(`Treadmill upgraded to Level ${level}! Now +${formatSpeed(cur().per)} speed per step`)
    repaint()
  }

  // --- "+N" pops over your head: a few pooled sprites per distinct text -----------------
  const pops = []
  function pop(text, pos) {
    let p = pops.find((q) => q.life <= 0 && q.text === text)
    if (!p) {
      if (pops.length >= 8) {
        p = pops.find((q) => q.life <= 0)
        if (!p) return
        p.sprite.removeFromParent()
        p.sprite.material.map.dispose()
        p.sprite.material.dispose()
        pops.splice(pops.indexOf(p), 1)
      }
      const sprite = label(text, 0.75, { color: '#ffe23a', outline: '#3a2200', font: '700 72px Fredoka, "Arial Black", sans-serif', outlineWidth: 12 })
      sprite.renderOrder = 10
      p = { text, sprite, life: 0 }
      pops.push(p)
    }
    if (!p.sprite.parent) scene.add(p.sprite)
    p.sprite.position.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + 2.4, pos.z + (Math.random() - 0.5) * 0.6)
    p.sprite.material.opacity = 1
    p.sprite.visible = true
    p.life = POP_LIFE
  }

  let stepT = 0
  let onBelt = false
  let prompt = false

  return {
    level: () => level,
    look: () => cur().look,
    snapshot: () => ({ treadmill: level }),
    hydrate(doc) {
      if (!Number.isInteger(doc.treadmill)) return
      const look = cur().look
      level = Math.min(T.levels.length, Math.max(1, doc.treadmill))
      if (cur().look !== look) plots.setMyTreadmillLook(cur().look)
      repaint()
    },
    // E: buys the next level while the Upgrade prompt is up. false if it isn't (E falls through).
    interact() {
      if (!prompt) return false
      buy()
      return true
    },
    // pos = player feet.
    update(dt, pos) {
      // No treadmill until the base is level 2 (base.js): nothing to stand on or upgrade.
      if (!tm.present) {
        if (onBelt) {
          player.autoWalk = null
          player.conveyor.x = player.conveyor.z = 0
          onBelt = false
        }
        if (prompt) laneHud.setAction(null)
        prompt = false
        return
      }
      const model = tm.model
      const [lx, lz] = toLocal(pos.x, pos.z)
      const nowOn = !player.frozen && Math.abs(lx) < 1.0 && lz > -2.0 && lz < 2.6 && pos.y > 0.2 && pos.y < 1.5
      if (nowOn) {
        player.autoWalk = autoWalk
        const forward = player.velocity.x * dirX + player.velocity.z * dirZ
        if (forward > 0.5) {
          // Walking toward the console: the belt cancels it, you stay put and train.
          player.conveyor.x = -dirX * forward
          player.conveyor.z = -dirZ * forward
          model.belt = forward
          stepT += dt
          if (stepT >= T.every) {
            stepT -= T.every
            addSpeed(cur().per)
            pop(`+${formatSpeed(cur().per * trailSpeed())}`, pos)
            model.flash()
            sfx.speedGain(level)
          }
        } else {
          player.conveyor.x = -dirX * T.drift
          player.conveyor.z = -dirZ * T.drift
          model.belt = T.drift
        }
      } else if (onBelt) {
        player.autoWalk = null
        player.conveyor.x = 0
        player.conveyor.z = 0
        model.belt = 0
        stepT = 0
      } else model.belt = 0
      onBelt = nowOn

      for (const p of pops) {
        if (p.life <= 0) continue
        p.life -= dt
        p.sprite.position.y += dt * 1.6
        p.sprite.material.opacity = Math.min(1, (p.life / POP_LIFE) * 2.5)
        if (p.life <= 0) p.sprite.visible = false
      }

      // The sign's price turns green / grey as you can (not) afford the next level.
      const n = next()
      const ok = !!n && inventory.money >= n.cost
      if (ok !== shownOk) repaint()

      // The Upgrade prompt near the sign.
      const near = Math.hypot(pos.x - tm.signAt.x, pos.z - tm.signAt.z) < T.range && !player.frozen
      if (near) laneHud.setAction({ title: `${COARSE_POINTER ? '' : '[E] '}Treadmill Lv ${level}`, price: n ? `Upgrade ${formatMoney(n.cost)}` : 'MAX', ok, fn: buy })
      else if (prompt) laneHud.setAction(null)
      prompt = near
    },
  }
}
