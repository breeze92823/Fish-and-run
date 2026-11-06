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

// The bat swing (bat.js), as upper-body overlays on the animator (character-space bone rotations):
// a wind-up to the right, a fast sweep across the front, a follow-through, then back to locomotion.
// stepSwing(animator, prev, t) applies the key the swing just reached (prev -> t, s since it began)
// and returns false once the swing is over. `windup` / `total` from config BAT.
export const BAT_POSE = {
  // Rig axes (measured): ArmR1 x < 0 raises the arm forward, z > 0 swings it out to the right;
  // Spine1 y < 0 turns the right shoulder back; ArmR2 x bends the elbow.
  windup: { ArmR1: { x: -1.5, z: 1.25 }, ArmR2: { x: 1.0 }, ArmL1: { x: -1.3, z: 0.7 }, ArmL2: { x: 0.8 }, Spine1: { y: -0.7, x: -0.08 }, Neck1: { y: 0.45 } },
  strike: { ArmR1: { x: -0.9, z: -0.5 }, ArmR2: { x: 1.4 }, ArmL1: { x: -1.4, z: -0.2 }, ArmL2: { x: 0.3 }, Spine1: { y: 0.6, x: 0.15 }, Neck1: { y: -0.3 } },
  follow: { ArmR1: { x: -1.2, z: -1.15 }, ArmR2: { x: 0.9 }, ArmL1: { x: -0.9, z: -0.7 }, Spine1: { y: 0.9, x: 0.1 }, Neck1: { y: -0.4 } },
}
export function stepSwing(animator, prev, t, windup, total) {
  if (!animator) return t < total
  const keys = [
    [0, BAT_POSE.windup, 32],
    [windup, BAT_POSE.strike, 48],
    [windup + 0.1, BAT_POSE.follow, 22],
    [total, null, 9],
  ]
  for (const [at, pose, rate] of keys) if (prev < at && t >= at) animator.setOverlay(pose, rate)
  if (prev < 0 && t >= 0) animator.setOverlay(BAT_POSE.windup, 32)
  return t < total
}
