import { LEADERBOARD, MY_HEAD, MY_PLOT, STALL_SCALE, STALLS } from '../config.js'
import { formatEarn } from './fish.js'
import { buildYard, updateYard } from './ground.js'
import { buildPlots } from './plots.js'
import { buildLeaderboard, buildStall } from './props.js'
import { solidBox } from '../propkit.js'

// The hub: the yard (ground, walls, finish line, lane shell), the eight plots,
// the stalls at the finish line with their glowing pads and the MOST CASH/S board.
// buildHub(scene, { myName, myPlot }) -> { update(dt, elapsed, playerPos), onPad(fn), ... }
// myPlot: the PLOTS index you own (the server's pick). The other plots stay empty until real
// players own them (main.js dresses them from the room's roster).
export function buildHub(scene, { myName, myPlot = MY_PLOT }) {
  buildYard(scene)

  const plots = buildPlots(scene, { myPlot, myName, myHead: MY_HEAD })
  let myEarn = 0

  // Stalls face the hub (+Z). Pads: a world-space rectangle each, entered -> onPad(id).
  const stalls = STALLS.map((def) => {
    const s = buildStall(def)
    s.group.position.set(def.x, 0, def.z)
    s.group.scale.setScalar(STALL_SCALE)
    scene.add(s.group)
    solidBox(2.4 * STALL_SCALE, 1, 1.7 * STALL_SCALE, def.x, 1, def.z)
    return { def, ...s, pad: { x: def.x, z: def.z + (1.6 + 2.2) * STALL_SCALE, hx: 1.7 * STALL_SCALE, hz: 1.0 * STALL_SCALE }, inside: false }
  })

  const board = buildLeaderboard(LEADERBOARD, myName, `${formatEarn(0)}/s`)
  board.group.position.set(LEADERBOARD.x, 0, LEADERBOARD.z)
  board.group.rotation.y = LEADERBOARD.yaw
  board.group.scale.setScalar(1.15)
  scene.add(board.group)
  solidBox(3, 4.5, 0.4, LEADERBOARD.x, 4.5, LEADERBOARD.z, LEADERBOARD.yaw)


  const padListeners = []
  return {
    plots,
    board,
    onPad(fn) {
      padListeners.push(fn)
    },
    setMyName(name) {
      myName = name
      plots.setMyName(name, MY_HEAD)
      board.setYou(name, `${formatEarn(myEarn)}/s`)
    },
    // The local player's active fish (species ids) and their total $/s.
    setMyFish(ids, earnPerSecond) {
      plots.setMyFish(ids)
      myEarn = earnPerSecond
      board.setYou(myName, `${formatEarn(myEarn)}/s`)
    },
    update(dt, elapsed, p) {
      updateYard(elapsed)
      plots.update(dt, elapsed)
      for (const s of stalls) {
        s.update(elapsed)
        const inside = Math.abs(p.x - s.pad.x) < s.pad.hx && Math.abs(p.z - s.pad.z) < s.pad.hz && p.y < 1
        if (inside && !s.inside) for (const fn of padListeners) fn(s.def.id, s.def)
        s.inside = inside
      }
    },
  }
}

