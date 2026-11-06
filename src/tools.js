import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { buildRodModel, disposeRodModel } from './rods/models.js'
import { equippedRodId } from './rods/state.js'
import { fishMesh } from './hub/fish.js'
import { RIG_HEIGHT } from './config.js'

// Hotbar tools held in the avatar's right hand: 1 = fishing rod, 2 = baseball bat.
// Built in metres, pointing along +Y from the grip at the origin.

function part(geo, mat, x, y, z) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

// A rod (default: the equipped one, rods/state.js) as its detailed model (rods/models.js).
function buildRod(rodId = equippedRodId()) {
  return buildRodModel(rodId)
}

function buildBat() {
  const g = new Group()
  const woodMat = new MeshStandardMaterial({ color: '#e8b874', roughness: 0.6 })
  const grip = new MeshStandardMaterial({ color: '#5a3a22', roughness: 0.9 })
  g.add(part(new CylinderGeometry(0.03, 0.035, 0.32, 8), grip, 0, 0.0, 0))
  g.add(part(new CylinderGeometry(0.075, 0.03, 0.75, 10), woodMat, 0, 0.55, 0))
  g.add(part(new CylinderGeometry(0.075, 0.075, 0.12, 10), woodMat, 0, 0.98, 0))
  g.add(part(new BoxGeometry(0.09, 0.03, 0.09), grip, 0, -0.17, 0))
  return g
}

// A caught fish carried under the arm (hotbar slots 3+), label and all, ~0.7 m long.
function buildFish(species) {
  const g = new Group()
  const f = fishMesh(species, { aura: false })
  const k = 0.75 / f.userData.size
  f.scale.setScalar(k)
  f.rotation.set(0, Math.PI / 2, Math.PI / 2)
  f.position.set(0, 0.1, 0)
  g.add(f)
  return g
}

const BUILDERS = { 1: buildRod, 2: buildBat }

// Puts tool `slot` (or none) in the avatar's right hand. Must run while the rig is in
// its bind pose (right after the animator is made): the tool is placed at the hand
// in character space, then re-parented to the forearm bone keeping that transform,
// so it follows the arm whatever the bone frames are.
// `fish` = species id when slot is a hotbar fish (3+); `rodId` = the rod to draw (another player's).
export function equipTool(avatar, slot, fish = null, rodId = undefined) {
  const old = avatar.userData.tool
  if (old) {
    old.removeFromParent()
    if (avatar.userData.toolSlot === 1) disposeRodModel(old)
    avatar.userData.tool = null
  }
  const build = fish ? () => buildFish(fish) : BUILDERS[slot]
  if (!slot || !build) return
  const bone = avatar.nodes?.ArmR2 ?? avatar.nodes?.ArmR1
  if (!bone) return
  const tool = build(rodId)
  // The avatar root is scaled rig units -> metres; work in rig units here.
  const k = RIG_HEIGHT / 1.8
  tool.scale.setScalar(k)
  tool.position.set(-2, 2.55, 0.15) // right hand (the rig's right arm hangs at x = -2)
  if (fish) tool.rotation.set(0, 0, 0)
  else tool.rotation.set(slot === 1 ? 0.9 : 0.5, 0, slot === 1 ? -0.35 : -0.15) // tipped forward
  avatar.add(tool)
  avatar.updateMatrixWorld(true)
  bone.attach(tool)
  avatar.userData.tool = tool
  avatar.userData.toolSlot = slot
}

// The rod's line tip (world position via getWorldPosition), or null when no rod is held.
export const rodTip = (avatar) => avatar?.userData.tool?.userData.tip ?? null
export function setToolVisible(avatar, on) {
  const t = avatar?.userData.tool
  if (t) t.visible = on
}
