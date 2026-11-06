import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial } from 'three'
import { TRAIL } from '../config.js'

// A glowing ribbon left behind a runner: a flat band TRAIL.width wide at
// TRAIL.height above the ground, a point dropped every TRAIL.spacing m, each point
// fading over TRAIL.life s and narrowing toward the tail. Colour runs through `colors` (2+ stops)
// from `colors[0]` at the runner to the last at the tail. Additive and HDR-bright, so bloom
// makes it glow. A jump of more than TRAIL.teleport m in one frame (respawn, knockback
// landing) restarts the ribbon instead of stretching it across the map.
export function createTrail(scene, colors) {
  const n = TRAIL.points
  const px = new Float32Array(n)
  const pz = new Float32Array(n)
  const py = new Float32Array(n)
  const age = new Float32Array(n).fill(1e9)
  let count = 0
  const pos = new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage)
  const col = new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage)
  const geo = new BufferGeometry()
  geo.setAttribute('position', pos)
  geo.setAttribute('color', col)
  const idx = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  geo.setIndex(idx)
  const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }))
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  scene.add(mesh)
  let stops = []
  const c = new Color()
  // Colour at k (0 = runner .. 1 = tail), brighter at the head.
  const sample = (k, out) => {
    const f = k * (stops.length - 1)
    const i = Math.min(stops.length - 2, Math.floor(f))
    return out.copy(stops[i]).lerp(stops[i + 1], f - i).multiplyScalar(1.8 - 0.4 * k)
  }
  const setColors = (list) => {
    stops = list.map((h) => new Color(h))
    if (stops.length === 1) stops.push(stops[0].clone())
  }
  setColors(colors)

  return {
    mesh,
    setColors,
    // Drop the ribbon; it regrows from the runner's next position.
    reset() {
      count = 0
      age.fill(1e9)
    },
    // x, y, z = the runner's feet this frame.
    update(dt, x, y, z) {
      if (count > 0 && Math.hypot(x - px[0], z - pz[0]) > TRAIL.teleport) {
        count = 0
        age.fill(1e9)
      }
      for (let i = 0; i < count; i++) age[i] += dt
      const moved = count === 0 ? Infinity : Math.hypot(x - px[1 % n], z - pz[1 % n])
      if (count === 0 || moved >= TRAIL.spacing) {
        // shift back, drop a new point at 1
        for (let i = Math.min(count, n - 1); i > 1; i--) {
          px[i] = px[i - 1]
          py[i] = py[i - 1]
          pz[i] = pz[i - 1]
          age[i] = age[i - 1]
        }
        px[1] = x
        py[1] = y
        pz[1] = z
        age[1] = 0
        count = Math.min(n, count + 1)
      }
      // point 0 follows the runner
      px[0] = x
      py[0] = y
      pz[0] = z
      age[0] = 0
      if (count < 2) count = 2
      for (let i = 0; i < n; i++) {
        const j = Math.min(i, count - 1)
        const k = j / (n - 1)
        const fade = Math.max(0, 1 - age[j] / TRAIL.life) * (1 - k)
        // Side vector: perpendicular to the path at this point (flat on the ground).
        const a = Math.max(0, j - 1)
        const b = Math.min(count - 1, j + 1)
        let dx = px[a] - px[b]
        let dz = pz[a] - pz[b]
        const len = Math.hypot(dx, dz) || 1
        dx /= len
        dz /= len
        const half = (TRAIL.width / 2) * (0.35 + 0.65 * (1 - k))
        const y = py[j] + TRAIL.height
        pos.setXYZ(i * 2, px[j] - dz * half, y, pz[j] + dx * half)
        pos.setXYZ(i * 2 + 1, px[j] + dz * half, y, pz[j] - dx * half)
        sample(k, c).multiplyScalar(fade)
        col.setXYZ(i * 2, c.r, c.g, c.b)
        col.setXYZ(i * 2 + 1, c.r, c.g, c.b)
      }
      pos.needsUpdate = true
      col.needsUpdate = true
    },
  }
}
