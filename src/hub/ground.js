import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { HUB } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { put } from '../propkit.js'
import { paintChecker, paintStuds, paintWall, tex } from './paint.js'

// The yard: one long studded lime baseplate shared by the hub (z > 0) and the lane
// (z < 0), tall orange walls with a grass lip all round and the checkered finish line
// at z = 0. The lane's zones (rivers, scenery) are src/lane/.
const { halfWidth: W, south: S, laneEnd: N, wall: WALL, colors: C } = HUB

let studMaterial = null
export function studMat() {
  if (!studMaterial) {
    const c = paintStuds(C.ground, C.groundStud, C.groundStudLight)
    const t = tex(c, 1, 1)
    studMaterial = new MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0 })
  }
  return studMaterial
}

// A material whose texture repeats `per` metres on the face it is used for.
function wallMat(lengthM, heightM) {
  const c = paintWall(C.wall, C.wallDark, C.wallLight)
  return new MeshStandardMaterial({ map: tex(c, lengthM / 6, heightM / 6), roughness: 0.9, emissive: '#ff6a00', emissiveIntensity: 0.12 })
}

function wallBox(root, cx, cz, sx, sz) {
  const h = WALL.height
  const geo = new BoxGeometry(sx, h, sz)
  const len = Math.max(sx, sz)
  const mat = wallMat(len, h)
  const m = put(root, geo, mat, cx, h / 2, cz)
  // Grass lip: a green slab on top overhanging a little, studded on top.
  const lip = new BoxGeometry(sx + WALL.overhang * 2, WALL.grassLip, sz + WALL.overhang * 2)
  const grass = studMat().clone()
  grass.map = studMat().map.clone()
  grass.map.repeat.set(sx / (HUB.studSize * 4), sz / (HUB.studSize * 4))
  grass.color.set('#d8ffc0')
  put(root, lip, grass, cx, h + WALL.grassLip / 2 - 0.05, cz)
  addFixed(RAPIER.ColliderDesc.cuboid(sx / 2, h / 2 + 4, sz / 2), { x: cx, y: h / 2 + 4, z: cz })
  return m
}

export function buildYard(scene) {
  const root = new Group()
  root.name = 'yard'
  scene.add(root)

  // Ground: one plane from the lane's end to the south wall.
  const len = S - N
  const groundTex = studMat().map
  groundTex.repeat.set((W * 2) / (HUB.studSize * 4), len / (HUB.studSize * 4))
  const ground = new Mesh(new PlaneGeometry(W * 2 + WALL.thick * 2, len), studMat())
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, 0, (S + N) / 2)
  ground.receiveShadow = true
  root.add(ground)
  addFixed(RAPIER.ColliderDesc.cuboid(W + WALL.thick, 1, len / 2 + WALL.thick), { x: 0, y: -1, z: (S + N) / 2 }, null, { friction: 0.9 })

  // Walls: east / west run the full length, south closes the hub, north the lane.
  const t = WALL.thick
  wallBox(root, -W - t / 2, (S + N) / 2, t, len + t * 2)
  wallBox(root, W + t / 2, (S + N) / 2, t, len + t * 2)
  wallBox(root, 0, S + t / 2, W * 2, t)
  wallBox(root, 0, N - t / 2, W * 2, t)
  // Beyond the walls: a wide grass plain at the wall top, so the sky meets green, not void.
  // Four strips round the yard (the plain has a yard-shaped hole).
  const plainMat = new MeshStandardMaterial({ color: '#63cf10', roughness: 1 })
  const strip = (cx, cz, sx, sz) => {
    const m = new Mesh(new PlaneGeometry(sx, sz), plainMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(cx, WALL.height + WALL.grassLip - 0.06, cz)
    m.receiveShadow = true
    root.add(m)
  }
  const far = 700
  strip(-W - t - far / 2, (S + N) / 2, far, len + far * 2)
  strip(W + t + far / 2, (S + N) / 2, far, len + far * 2)
  strip(0, S + t + far / 2, (W + t) * 2, far)
  strip(0, N - t - far / 2, (W + t) * 2, far)

  // Finish line: two rows of black/white squares across the yard.
  const L = HUB.line
  const checker = tex(paintChecker(), (W * 2) / (L.square * 2), 1, 16)
  const line = new Mesh(new PlaneGeometry(W * 2, L.square * 2), new MeshStandardMaterial({ map: checker, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }))
  line.rotation.x = -Math.PI / 2
  line.position.set(0, 0.02, L.z)
  line.receiveShadow = true
  root.add(line)

  return root
}

export function updateYard() {}
