import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three'

// Voxel models: a grid sampled by colorAt(x, y, z) -> colour (hex number / css string)
// or null for empty. Only faces between a filled and an empty cell are emitted, with
// a per-vertex colour (slightly jittered per voxel, like the blocky meshes in the
// reference) and an optional `sway` attribute (0 at the head end +X, 1 at the tail
// end -X) that fish.js uses to bend the tail in the vertex shader.
// The geometry is centred on the grid's middle in X/Z and sits on y = 0 unless
// `centerY` is set; `size` is metres per voxel.
// Faces as flat tables: normal (nx, ny, nz), shade, then 4 corners (x, y, z) each.
const FACES = [
  [1, 0, 0, 0.9, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1],
  [-1, 0, 0, 0.9, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0],
  [0, -1, 0, 0.7, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
  [0, 0, 1, 0.95, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1],
  [0, 0, -1, 0.95, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
]

// Parsed colours, shared by every model (a few dozen distinct strings in all).
const tmp = new Color()
const rgbCache = new Map()
function rgb(c) {
  let v = rgbCache.get(c)
  if (!v) {
    tmp.set(c)
    v = [tmp.r, tmp.g, tmp.b]
    rgbCache.set(c, v)
  }
  return v
}

// Growable Float32 / Uint32 buffers (no per-vertex array pushes).
function grow(a, need) {
  if (need <= a.length) return a
  const b = new a.constructor(Math.max(need, a.length * 2))
  b.set(a)
  return b
}

export function voxelGeometry(nx, ny, nz, colorAt, { size = 1, centerY = false, sway = false, jitter = 0.06, seed = 1 } = {}) {
  // Sample the grid once into palette indices (0 = empty).
  const palette = [null]
  const paletteOf = new Map()
  const grid = new Uint16Array(nx * ny * nz)
  let i = 0
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++, i++) {
        const c = colorAt(x, y, z)
        if (c === null || c === undefined) continue
        let k = paletteOf.get(c)
        if (k === undefined) {
          k = palette.length
          palette.push(rgb(c))
          paletteOf.set(c, k)
        }
        grid[i] = k
      }
    }
  }
  const sx = 1
  const sy = nx
  const sz = nx * ny

  let pos = new Float32Array(4096)
  let nor = new Float32Array(4096)
  let col = new Float32Array(4096)
  let sw = sway ? new Float32Array(1366) : null
  let index = new Uint32Array(2048)
  let v = 0 // vertices written
  let n = 0 // indices written
  let s = seed >>> 0
  const ox = nx / 2
  const oy = centerY ? ny / 2 : 0
  const oz = nz / 2
  i = 0
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++, i++) {
        const k = grid[i]
        if (k === 0) continue
        const c = palette[k]
        // mulberry32 step: per-voxel brightness jitter
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        const j = 1 + ((((t ^ (t >>> 14)) >>> 0) / 4294967296) - 0.5) * 2 * jitter
        for (let f = 0; f < 6; f++) {
          const F = FACES[f]
          const ax = x + F[0]
          const ay = y + F[1]
          const az = z + F[2]
          if (ax >= 0 && ay >= 0 && az >= 0 && ax < nx && ay < ny && az < nz && grid[i + F[0] * sx + F[1] * sy + F[2] * sz] !== 0) continue
          if ((v + 4) * 3 > pos.length) {
            pos = grow(pos, (v + 4) * 3)
            nor = grow(nor, (v + 4) * 3)
            col = grow(col, (v + 4) * 3)
            if (sw) sw = grow(sw, v + 4)
          }
          if (n + 6 > index.length) index = grow(index, n + 6)
          const shade = F[3] * j
          const r = c[0] * shade
          const g = c[1] * shade
          const b = c[2] * shade
          for (let q = 0; q < 4; q++) {
            const cx = F[4 + q * 3]
            const cy = F[5 + q * 3]
            const cz = F[6 + q * 3]
            const o = (v + q) * 3
            pos[o] = (x + cx - ox) * size
            pos[o + 1] = (y + cy - oy) * size
            pos[o + 2] = (z + cz - oz) * size
            nor[o] = F[0]
            nor[o + 1] = F[1]
            nor[o + 2] = F[2]
            col[o] = r
            col[o + 1] = g
            col[o + 2] = b
            if (sw) sw[v + q] = Math.max(0, Math.min(1, 1 - (x + cx) / nx))
          }
          index[n] = v
          index[n + 1] = v + 1
          index[n + 2] = v + 2
          index[n + 3] = v
          index[n + 4] = v + 2
          index[n + 5] = v + 3
          v += 4
          n += 6
        }
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos.slice(0, v * 3), 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nor.slice(0, v * 3), 3))
  geo.setAttribute('color', new Float32BufferAttribute(col.slice(0, v * 3), 3))
  if (sw) geo.setAttribute('sway', new Float32BufferAttribute(sw.slice(0, v), 1))
  geo.setIndex(new Uint32BufferAttribute(index.slice(0, n), 1))
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}

// Rainbow hue (0..1 along a length) as a css colour, saturated like the reference.
const RAINBOW = ['#ff2a2a', '#ff8a1a', '#ffe21a', '#3ae03a', '#1ab8ff', '#3a5aff', '#c03aff', '#ff3ab8']
export function rainbowAt(t) {
  const f = ((t % 1) + 1) % 1 * RAINBOW.length
  return RAINBOW[Math.floor(f) % RAINBOW.length]
}
