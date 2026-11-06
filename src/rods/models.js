// Detailed procedural fishing rods, one builder per RODS id (config.js).
//
//   const g = buildRodModel('golden')   // Group, metres, grip at the origin pointing +Y
//   g.userData.tip                      // Object3D where the fishing line leaves the rod
//
// Every rod is ~2.5 m long with the hand at y = 0 (the butt hangs below it). Guides,
// reels and the line sit on the +Z side, which faces down once tools.js tips the rod
// forward in the avatar's hand. Materials and textures are shared between builds
// (cached by key); only geometry is per build (disposeRodModel frees it).
import {
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'

// --- Materials + textures ---------------------------------------------------------------------
const mats = new Map()
// color, { r: roughness, m: metalness, e: emissive, ei, op: opacity, flat, map (texture key) }
function M(color, o = {}) {
  const key = `${color}|${o.r}|${o.m}|${o.e}|${o.ei}|${o.op}|${o.flat}|${o.map ?? ''}`
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      roughness: o.r ?? 0.7,
      metalness: o.m ?? 0,
      emissive: o.e ?? '#000000',
      emissiveIntensity: o.ei ?? 1,
      transparent: o.op != null,
      opacity: o.op ?? 1,
      flatShading: !!o.flat,
      map: o.map ? tex(o.map) : null,
    })
    m.userData.shared = true
    mats.set(key, m)
  }
  return m
}

const texes = new Map()
function canvasTex(key, w, h, paint, repeat = [1, 1]) {
  let t = texes.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d'), w, h)
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 4
  texes.set(key, t)
  return t
}
// Diagonal stripes (wrap around a cylinder as a helix).
function stripes(ctx, w, h, colors, band) {
  ctx.fillStyle = colors[0]
  ctx.fillRect(0, 0, w, h)
  for (let i = -2; i < (w + h) / band + 2; i++) {
    ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length]
    ctx.beginPath()
    ctx.moveTo(i * band, 0)
    ctx.lineTo(i * band + band, 0)
    ctx.lineTo(i * band + band - h, h)
    ctx.lineTo(i * band - h, h)
    ctx.closePath()
    ctx.fill()
  }
}
const TEX = {
  candy: () => canvasTex('candy', 64, 64, (c, w, h) => stripes(c, w, h, ['#fff4f0', '#3a1a10', '#fff4f0', '#e8423a'], 16), [1, 6]),
  candyGrip: () => canvasTex('candyGrip', 64, 64, (c, w, h) => stripes(c, w, h, ['#6ae23a', '#ffe23a'], 16), [1, 3]),
  cane: () => canvasTex('cane', 64, 64, (c, w, h) => stripes(c, w, h, ['#ffffff', '#e01e2a', '#ffffff', '#ff6a6a'], 16), [14, 1]),
  // Katana grip: black silk wrap crossing over white ray skin, gold flecks.
  tsuka: () =>
    canvasTex(
      'tsuka',
      64,
      64,
      (c) => {
        c.fillStyle = '#f2ede0'
        c.fillRect(0, 0, 64, 64)
        c.fillStyle = '#16161a'
        c.beginPath()
        c.moveTo(0, 0)
        c.lineTo(32, 32)
        c.lineTo(0, 64)
        c.closePath()
        c.moveTo(64, 0)
        c.lineTo(32, 32)
        c.lineTo(64, 64)
        c.closePath()
        c.fill()
        c.fillStyle = '#16161a'
        c.fillRect(0, 0, 64, 6)
        c.fillRect(0, 58, 64, 6)
        c.strokeStyle = '#d8a820'
        c.lineWidth = 3
        c.beginPath()
        c.moveTo(22, 32)
        c.lineTo(32, 20)
        c.lineTo(42, 32)
        c.lineTo(32, 44)
        c.closePath()
        c.stroke()
      },
      [3, 6],
    ),
  // Lollipop face: a red and white spiral.
  swirl: () =>
    canvasTex('swirl', 128, 128, (c) => {
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, 128, 128)
      c.strokeStyle = '#e8283a'
      c.lineWidth = 9
      c.lineCap = 'round'
      c.beginPath()
      for (let a = 0; a < Math.PI * 7; a += 0.08) {
        const r = 3 + a * 2.8
        const x = 64 + Math.cos(a) * r
        const y = 64 + Math.sin(a) * r
        if (a === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.stroke()
    }),
  // Wood grain (streaks along the rod).
  grain: () =>
    canvasTex(
      'grain',
      32,
      128,
      (c) => {
        c.fillStyle = '#ffffff'
        c.fillRect(0, 0, 32, 128)
        for (let i = 0; i < 26; i++) {
          c.fillStyle = `rgba(60,30,10,${0.08 + (i % 4) * 0.05})`
          const x = (i * 7.3) % 32
          c.fillRect(x, (i * 37) % 128, 1 + (i % 3), 30 + (i % 5) * 18)
        }
      },
      [2, 4],
    ),
}
function tex(name) {
  return TEX[name]()
}

// --- Geometry helpers ---------------------------------------------------------------------------
const UP = new Vector3(0, 1, 0)
const v = (x, y, z) => new Vector3(x, y, z)
const lerp = (a, b, k) => a + (b - a) * k

function add(g, geo, mat) {
  const m = new Mesh(geo, mat)
  m.castShadow = true
  g.add(m)
  return m
}
// Tapered cylinder from a to b (radius r0 at a, r1 at b).
function segAB(g, mat, a, b, r0, r1 = r0, sides = 10) {
  const d = new Vector3().subVectors(b, a)
  const len = d.length()
  const m = add(g, new CylinderGeometry(r1, r0, len, sides, 1), mat)
  m.position.addVectors(a, b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(UP, d.normalize())
  return m
}
// Along the rod axis (x, z offset), y0 -> y1.
const seg = (g, mat, y0, y1, r0, r1 = r0, sides = 14, x = 0, z = 0) => segAB(g, mat, v(x, y0, z), v(x, y1, z), r0, r1, sides)
// Ring around the rod axis at height y (axis along Y unless rotated).
function ring(g, mat, y, R, t, { x = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, sides = 18 } = {}) {
  const m = add(g, new TorusGeometry(R, t, 6, sides, arc), mat)
  m.position.set(x, y, z)
  m.rotation.set(Math.PI / 2 + rx, ry, rz)
  return m
}
function ball(g, mat, p, r, s = [1, 1, 1], seg = 12) {
  const m = add(g, new SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat)
  m.position.copy(p)
  m.scale.set(s[0], s[1], s[2])
  return m
}
function cone(g, mat, a, b, r, sides = 8) {
  const d = new Vector3().subVectors(b, a)
  const m = add(g, new ConeGeometry(r, d.length(), sides), mat)
  m.position.addVectors(a, b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(UP, d.normalize())
  return m
}
// A tapered rod along a smooth curve through pts (joints hidden by spheres).
function curveRod(g, mat, pts, r0, r1, n = 14, sides = 8) {
  const c = new CatmullRomCurve3(pts)
  let prev = c.getPoint(0)
  for (let i = 1; i <= n; i++) {
    const p = c.getPoint(i / n)
    const ra = lerp(r0, r1, (i - 1) / n)
    const rb = lerp(r0, r1, i / n)
    segAB(g, mat, prev, p, ra, rb, sides)
    if (i < n) ball(g, mat, p, rb * 1.02, [1, 1, 1], sides)
    prev = p
  }
  return c
}
// Constant-radius tube along pts.
function tube(g, mat, pts, r, n = 48, sides = 8, closed = false) {
  return add(g, new TubeGeometry(new CatmullRomCurve3(pts, closed), n, r, sides, closed), mat)
}
// Helix around the rod axis from y0 to y1 (wraps, vines, rope).
function helix(y0, y1, R, turns, phase = 0, n = 64) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const k = i / n
    const a = phase + k * turns * Math.PI * 2
    const r = typeof R === 'function' ? R(k) : R
    pts.push(v(Math.cos(a) * r, lerp(y0, y1, k), Math.sin(a) * r))
  }
  return pts
}
// A leaf: flattened ellipsoid with a darker mid rib, base at p pointing along dir.
function leaf(g, mat, rib, p, dir, len, wid) {
  const d = dir.clone().normalize()
  const m = ball(g, mat, p.clone().addScaledVector(d, len / 2), 1, [wid, len / 2, wid * 0.22], 10)
  m.quaternion.setFromUnitVectors(UP, d)
  segAB(g, rib, p, p.clone().addScaledVector(d, len * 0.9), 0.003, 0.0015, 4)
  return m
}

// Line guide on the +Z side at height y: two struts, a thread wrap and a ring. Returns
// the ring centre (where the line passes).
function guide(g, frame, ringMat, wrap, y, sr, s = 1) {
  const h = sr + 0.03 * s
  const R = 0.018 * s
  segAB(g, frame, v(0, y - 0.025 * s, sr * 0.7), v(0, y, h), 0.0035 * s, 0.003 * s, 5)
  segAB(g, frame, v(0, y + 0.02 * s, sr * 0.7), v(0, y, h), 0.0035 * s, 0.003 * s, 5)
  if (wrap) seg(g, wrap, y - 0.035 * s, y + 0.03 * s, sr * 1.12, sr * 1.12, 10)
  ring(g, ringMat, y, R, 0.0042 * s, { z: h + R, sides: 14 })
  return v(0, y, h + R)
}
// Spinning reel hanging off the +Z side at height y. c = { frame, body, spool, line, knob }.
// Returns the point where the line leaves the spool.
function reel(g, y, sr, c, s = 1) {
  const z = sr + 0.15 * s
  const box = add(g, new CylinderGeometry(0.012 * s, 0.012 * s, 0.15 * s, 8), c.frame) // reel foot
  box.position.set(0, y, sr + 0.008)
  box.scale.set(1.6, 1, 0.6)
  segAB(g, c.frame, v(0, y - 0.005, sr + 0.01), v(0, y - 0.02 * s, z - 0.03 * s), 0.009 * s, 0.011 * s, 8) // stem
  seg(g, c.body, y - 0.085 * s, y - 0.005 * s, 0.03 * s, 0.043 * s, 16, 0, z) // gearbox
  ball(g, c.body, v(0, y - 0.085 * s, z), 0.03 * s, [1, 0.6, 1], 14)
  seg(g, c.frame, y - 0.005 * s, y + 0.03 * s, 0.05 * s, 0.047 * s, 18, 0, z) // rotor cup
  seg(g, c.spool, y + 0.03 * s, y + 0.085 * s, 0.035 * s, 0.035 * s, 16, 0, z) // spool
  seg(g, c.line, y + 0.036 * s, y + 0.078 * s, 0.041 * s, 0.04 * s, 16, 0, z) // wound line
  ring(g, c.frame, y + 0.087 * s, 0.04 * s, 0.006 * s, { z, sides: 16 }) // spool lip
  ring(g, c.frame, y + 0.012 * s, 0.058 * s, 0.0035 * s, { z, arc: Math.PI, ry: 0.3, sides: 14 }) // bail wire
  // Crank on the +X side.
  const hub = v(0.035 * s, y - 0.045 * s, z)
  const elbow = v(0.075 * s, y - 0.045 * s, z)
  segAB(g, c.frame, hub, elbow, 0.007 * s)
  const hand = v(0.075 * s, y - 0.11 * s, z + 0.035 * s)
  segAB(g, c.frame, elbow, hand, 0.008 * s, 0.006 * s, 6)
  segAB(g, c.knob, hand, v(0.11 * s, y - 0.11 * s, z + 0.035 * s), 0.013 * s, 0.011 * s, 10)
  return v(0, y + 0.06 * s, z + 0.041 * s)
}
// The fishing line through pts (reel -> guides -> tip).
function line(g, mat, pts) {
  for (let i = 1; i < pts.length; i++) segAB(g, mat, pts[i - 1], pts[i], 0.0028, 0.0028, 4)
}
function tipAt(g, p) {
  const t = new Object3D()
  t.name = 'rodTip'
  t.position.copy(p)
  g.add(t)
  g.userData.tip = t
}

// --- A classic rod: butt cap, grip, reel seat, reel, tapered blank, guides, line ------------
// o: { tipY, butt, gripTop, gripR, r0, r1, blank, grip, cap, seat, frame, ringMat, wrap,
//      reel: {frame, body, spool, line, knob}, line, guides: [fractions], guideScale }
function classic(g, o) {
  const tipY = o.tipY ?? 2.5
  const butt = o.butt ?? -0.34
  const gripTop = o.gripTop ?? 0.26
  const gr = o.gripR ?? 0.04
  const r0 = o.r0 ?? 0.026
  const r1 = o.r1 ?? 0.009
  const blankStart = gripTop + 0.24
  const R = (y) => lerp(r0, r1, Math.max(0, (y - blankStart) / (tipY - blankStart)))

  // Butt cap + rear grip, reel seat, fore grip.
  seg(g, o.cap, butt - 0.03, butt + 0.03, gr * 0.85, gr * 1.08, 16)
  ball(g, o.cap, v(0, butt - 0.03, 0), gr * 0.85, [1, 0.45, 1], 14)
  seg(g, o.grip, butt + 0.03, gripTop - 0.02, gr, gr * 0.9, 16)
  if (o.gripRings) for (let y = butt + 0.09; y < gripTop - 0.05; y += 0.085) ring(g, o.gripRings, y, gr * 0.98, 0.006, { sides: 18 })
  seg(g, o.seat, gripTop - 0.02, gripTop + 0.17, r0 * 1.15, r0 * 1.15, 14)
  ring(g, o.seat, gripTop, r0 * 1.35, 0.008, { sides: 16 })
  ring(g, o.seat, gripTop + 0.16, r0 * 1.35, 0.008, { sides: 16 })
  seg(g, o.grip, gripTop + 0.17, blankStart, gr * 0.85, r0 * 1.15, 16) // fore grip
  ring(g, o.seat, blankStart, r0 * 1.2, 0.005, { sides: 14 }) // winding check

  // Blank (2 sections, ferrule between).
  const mid = lerp(blankStart, tipY, 0.48)
  seg(g, o.blank, blankStart, mid, r0, R(mid), 12)
  seg(g, o.blank, mid, tipY, R(mid), r1, 10)
  if (o.ferrule) seg(g, o.ferrule, mid - 0.04, mid + 0.04, R(mid) * 1.25, R(mid) * 1.15, 12)

  // Reel + guides + line.
  const pts = [reel(g, gripTop + 0.085, r0 * 1.15, o.reel, o.reelScale ?? 1)]
  const fr = o.guides ?? [0.12, 0.3, 0.46, 0.6, 0.73, 0.85, 0.94]
  for (let i = 0; i < fr.length; i++) {
    const y = lerp(blankStart, tipY, fr[i])
    pts.push(guide(g, o.frame, o.ringMat, o.wrap, y, R(y), lerp(1.25, 0.6, i / (fr.length - 1)) * (o.guideScale ?? 1)))
  }
  // Tip-top.
  seg(g, o.frame, tipY - 0.03, tipY, r1 * 1.25, r1 * 1.25, 8)
  ring(g, o.ringMat, tipY + 0.012, 0.011, 0.0035, { z: 0.004, rx: Math.PI / 2, sides: 12 })
  const tip = v(0, tipY + 0.014, 0.004)
  pts.push(tip)
  line(g, o.line, pts)
  tipAt(g, tip)
  return { R, blankStart, tipY, mid, gripTop, butt, gr, r0, r1 }
}

const LINE = () => M('#eef2f4', { r: 0.4 })
const CHROME = () => M('#dfe3ea', { r: 0.18, m: 0.9 })
const DARK_METAL = () => M('#2a2c34', { r: 0.35, m: 0.7 })

// --- The rods ------------------------------------------------------------------------------------
const BUILD = {
  // A crooked branch, a grass-wrapped handle, line knotted at the tip.
  branch(g) {
    const bark = M('#7a4320', { r: 0.95, flat: true })
    const barkDark = M('#55301a', { r: 1, flat: true })
    const grass = M('#86c23a', { r: 0.9 })
    const grassDark = M('#5a9022', { r: 0.9 })
    const twine = M('#cfae6c', { r: 1 })
    const pts = [v(0, -0.36, 0), v(0.012, 0.3, 0.006), v(-0.018, 0.95, -0.004), v(0.022, 1.55, 0.01), v(-0.01, 2.05, 0.004), v(0.018, 2.45, 0.012)]
    const c = curveRod(g, bark, pts, 0.042, 0.011, 22, 8)
    ball(g, barkDark, v(0, -0.36, 0), 0.04, [1, 0.4, 1], 8) // cut end
    // Knots and stubs.
    for (const [k, side] of [[0.38, 1], [0.55, -1], [0.71, 1], [0.86, -1]]) {
      const p = c.getPoint(k)
      ball(g, barkDark, p.clone().add(v(0.022 * side * (1 - k * 0.5), 0, 0.006)), 0.014 * (1.3 - k * 0.6), [1, 1.4, 1], 7)
    }
    // A twig with leaves.
    const t0 = c.getPoint(0.62)
    const twig = curveRod(g, bark, [t0, t0.clone().add(v(0.09, 0.12, 0.02)), t0.clone().add(v(0.16, 0.3, 0.03))], 0.01, 0.004, 5, 6)
    const leafMat = M('#4fae2a', { r: 0.8 })
    const rib = M('#2f7a16', { r: 0.8 })
    leaf(g, leafMat, rib, twig.getPoint(1), v(0.4, 1, 0.2), 0.12, 0.035)
    leaf(g, leafMat, rib, twig.getPoint(0.6), v(1, 0.3, -0.3), 0.1, 0.03)
    leaf(g, leafMat, rib, c.getPoint(0.97), v(-0.7, 1, 0.3), 0.09, 0.026)
    // Grass wrap over the handle, twine bands at its ends.
    tube(g, grass, helix(-0.3, 0.32, 0.044, 9, 0), 0.011, 160, 6)
    tube(g, grassDark, helix(-0.28, 0.3, 0.043, 9, Math.PI), 0.009, 160, 6)
    for (const y of [-0.31, 0.33]) ring(g, twine, y, 0.047, 0.008, { sides: 14 })
    // Line: tied below the tip, runs down to a hand-tied keeper above the grip.
    const tip = c.getPoint(1).add(v(0, 0.01, 0.012))
    ring(g, twine, tip.y - 0.03, 0.014, 0.005, { x: tip.x, z: tip.z - 0.012, sides: 10 })
    const keeper = c.getPoint(0.27).add(v(0, 0, 0.046))
    ring(g, twine, keeper.y, 0.045, 0.006, { x: keeper.x, sides: 14 })
    const linePts = [keeper, c.getPoint(0.5).add(v(0, 0, 0.034)), c.getPoint(0.75).add(v(0, 0, 0.026)), tip]
    line(g, LINE(), linePts)
    tipAt(g, tip)
  },

  // Plain varnished wood, a maroon grip and a blue reel.
  wooden(g) {
    const wood = M('#b06a2c', { r: 0.55, map: 'grain' })
    const twine = M('#e8d6a0', { r: 0.9 })
    const r = classic(g, {
      blank: wood,
      grip: M('#5a1e22', { r: 0.85 }),
      gripRings: M('#3a1014', { r: 0.9 }),
      cap: M('#2a1a14', { r: 0.6 }),
      seat: M('#4a5ab0', { r: 0.4, m: 0.3 }),
      frame: M('#6a4a2a', { r: 0.7 }),
      ringMat: twine,
      wrap: twine,
      reel: { frame: M('#3a4aa0', { r: 0.4, m: 0.3 }), body: M('#4a5ab8', { r: 0.4, m: 0.3 }), spool: M('#8a96d8', { r: 0.4, m: 0.4 }), line: twine, knob: M('#2a1a14', { r: 0.6 }) },
      line: LINE(),
      guides: [0.15, 0.4, 0.62, 0.8, 0.93],
    })
    for (const y of [0.9, 1.35, 1.8, 2.2]) ring(g, M('#7a4418', { r: 0.7 }), y, r.R(y) * 1.05, 0.004, { sides: 12 })
  },

  // Dark wood bound with iron straps and brass ferrules.
  reinforced_wood(g) {
    const iron = M('#34343c', { r: 0.45, m: 0.75 })
    const brass = M('#c8963a', { r: 0.3, m: 0.85 })
    const r = classic(g, {
      blank: M('#7a4822', { r: 0.6, map: 'grain' }),
      grip: M('#1c241e', { r: 0.95 }),
      gripRings: M('#101410', { r: 1 }),
      cap: brass,
      seat: brass,
      ferrule: brass,
      frame: iron,
      ringMat: CHROME(),
      wrap: M('#3a2414', { r: 0.9 }),
      reel: { frame: iron, body: M('#4a3a2a', { r: 0.6, m: 0.3 }), spool: brass, line: M('#d8d0b8', { r: 0.8 }), knob: M('#6a3a1a', { r: 0.7 }) },
      line: LINE(),
      r0: 0.03,
      r1: 0.011,
    })
    for (const y of [0.72, 1.0, 1.55, 1.9, 2.22]) {
      seg(g, iron, y - 0.018, y + 0.018, r.R(y) * 1.22, r.R(y) * 1.22, 12)
      for (let a = 0; a < 4; a++) ball(g, iron, v(Math.cos(a * 1.57 + 0.4) * r.R(y) * 1.24, y, Math.sin(a * 1.57 + 0.4) * r.R(y) * 1.24), 0.004, [1, 1, 1], 5) // rivets
    }
  },

  // Navy steel, knurled grip, chrome hardware.
  reinforced_metal(g) {
    const steel = M('#2e3fa8', { r: 0.3, m: 0.7 })
    const band = M('#1a2468', { r: 0.35, m: 0.75 })
    const r = classic(g, {
      blank: steel,
      grip: M('#15161c', { r: 0.8 }),
      gripRings: M('#3a3e4a', { r: 0.5, m: 0.6 }),
      cap: CHROME(),
      seat: CHROME(),
      ferrule: band,
      frame: CHROME(),
      ringMat: M('#9aa8ff', { r: 0.2, m: 0.8 }),
      wrap: band,
      reel: { frame: CHROME(), body: M('#24307e', { r: 0.3, m: 0.7 }), spool: CHROME(), line: M('#cfd8ff', { r: 0.4 }), knob: M('#15161c', { r: 0.7 }) },
      line: LINE(),
      r0: 0.028,
    })
    for (const y of [0.8, 1.2, 1.7, 2.1]) seg(g, band, y - 0.025, y + 0.025, r.R(y) * 1.18, r.R(y) * 1.18, 12)
  },

  // Polished gold with a ruby in the butt cap.
  golden(g) {
    const gold = M('#ffc21a', { r: 0.22, m: 0.9 })
    const deep = M('#c8860a', { r: 0.3, m: 0.85 })
    const r = classic(g, {
      blank: gold,
      grip: deep,
      gripRings: M('#ffe27a', { r: 0.2, m: 0.9 }),
      cap: gold,
      seat: M('#fff0a8', { r: 0.15, m: 0.95 }),
      ferrule: M('#fff0a8', { r: 0.15, m: 0.95 }),
      frame: gold,
      ringMat: M('#fff6d0', { r: 0.1, m: 0.95 }),
      wrap: deep,
      reel: { frame: gold, body: deep, spool: M('#fff0a8', { r: 0.15, m: 0.95 }), line: M('#ffe9a0', { r: 0.4 }), knob: M('#7a1010', { r: 0.3 }) },
      line: M('#fff4c0', { r: 0.4 }),
    })
    ball(g, M('#e0182a', { r: 0.15, m: 0.2, e: '#5a0008', ei: 0.6 }), v(0, r.butt - 0.06, 0), 0.022, [1, 1, 1], 8)
    tube(g, M('#ffe27a', { r: 0.2, m: 0.9 }), helix(r.blankStart + 0.05, r.blankStart + 0.5, (k) => r.R(r.blankStart + 0.05 + k * 0.45) * 1.15, 4), 0.004, 80, 5)
  },

  // Ice: a clear blue blank with crystal shards growing out of it.
  frost(g) {
    const ice = M('#bdf2ff', { r: 0.08, m: 0.1, op: 0.82, e: '#3aa8ff', ei: 0.18 })
    const shard = M('#e8fbff', { r: 0.05, m: 0.15, op: 0.9, e: '#7ad8ff', ei: 0.25 })
    const deep = M('#5ac8f0', { r: 0.15, m: 0.3 })
    const r = classic(g, {
      blank: ice,
      grip: M('#eaf6ff', { r: 0.9 }),
      gripRings: M('#9ad8f0', { r: 0.6 }),
      cap: deep,
      seat: deep,
      ferrule: shard,
      frame: deep,
      ringMat: shard,
      wrap: deep,
      reel: { frame: deep, body: M('#c8eeff', { r: 0.2, m: 0.3 }), spool: shard, line: M('#ffffff', { r: 0.3 }), knob: M('#2a7ab8', { r: 0.3 }) },
      line: LINE(),
      r0: 0.03,
    })
    // Ice spikes around the blank and a crown of shards at the guard.
    const spikes = [[0.75, 0.2, 0.2], [1.0, 2.4, 0.16], [1.3, 4.3, 0.17], [1.55, 1.1, 0.13], [1.8, 3.4, 0.11], [2.05, 5.4, 0.09]]
    for (const [y, a, len] of spikes) {
      const base = v(Math.cos(a) * r.R(y), y, Math.sin(a) * r.R(y))
      const out = base.clone().add(v(Math.cos(a) * len, len * 0.7, Math.sin(a) * len))
      cone(g, shard, base, out, 0.024, 5)
      cone(g, shard, base, base.clone().lerp(out, 0.6).add(v(0, 0.06, 0)), 0.015, 4)
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const base = v(Math.cos(a) * 0.035, r.blankStart - 0.04, Math.sin(a) * 0.035)
      cone(g, shard, base, base.clone().add(v(Math.cos(a) * 0.06, 0.09, Math.sin(a) * 0.06)), 0.014, 4)
    }
    const crystal = add(g, new OctahedronGeometry(0.045, 0), shard)
    crystal.position.set(0, r.butt - 0.08, 0)
    crystal.scale.set(1, 1.6, 1)
  },

  // Striped candy blank, a sour-apple grip, gumdrop butt, a lollipop at the tip.
  candy(g) {
    const pink = M('#ff6ab8', { r: 0.35 })
    const r = classic(g, {
      blank: M('#ffffff', { r: 0.35, map: 'candy' }),
      grip: M('#ffffff', { r: 0.5, map: 'candyGrip' }),
      cap: pink,
      seat: M('#ffe23a', { r: 0.35 }),
      frame: pink,
      ringMat: M('#ffffff', { r: 0.3 }),
      wrap: pink,
      reel: { frame: pink, body: M('#7ae0ff', { r: 0.35 }), spool: M('#ffe23a', { r: 0.35 }), line: M('#ffffff', { r: 0.4 }), knob: M('#ff3a3a', { r: 0.35 }) },
      line: LINE(),
      tipY: 2.3,
      r0: 0.03,
      r1: 0.014,
    })
    ball(g, M('#9a4aff', { r: 0.3 }), v(0, r.butt - 0.05, 0), 0.05, [1, 0.8, 1], 12) // gumdrop
    // Lollipop: stick end into a swirl disc.
    const disc = add(g, new CylinderGeometry(0.13, 0.13, 0.05, 28), [M('#e8283a', { r: 0.25 }), M('#ffffff', { r: 0.25, map: 'swirl' }), M('#ffffff', { r: 0.25, map: 'swirl' })])
    disc.position.set(0, r.tipY + 0.13, 0)
    disc.rotation.x = Math.PI / 2
    ring(g, M('#ff9ac8', { r: 0.3 }), r.tipY + 0.13, 0.13, 0.012, { rx: -Math.PI / 2, sides: 28 }) // rim
  },

  // Twisted green vines bearing red toadstools.
  mushroom(g) {
    const vine = M('#2c5a22', { r: 0.85 })
    const vineDark = M('#1c3a16', { r: 0.9 })
    const cap = M('#d2261e', { r: 0.55 })
    const dot = M('#fff6ea', { r: 0.6 })
    const stem = M('#f2e6cc', { r: 0.8 })
    const root = M('#5a3a1e', { r: 1, flat: true })
    const r = classic(g, {
      blank: vineDark,
      grip: root,
      cap: root,
      seat: M('#3a2414', { r: 0.8 }),
      frame: M('#3a2414', { r: 0.8 }),
      ringMat: M('#8ad04a', { r: 0.6 }),
      wrap: vine,
      reel: { frame: M('#3a2414', { r: 0.8 }), body: vine, spool: cap, line: M('#d8f0c0', { r: 0.6 }), knob: dot },
      line: LINE(),
      r0: 0.028,
    })
    tube(g, vine, helix(r.blankStart, 2.3, (k) => lerp(0.04, 0.015, k), 6, 0), 0.011, 180, 6)
    tube(g, vineDark, helix(r.blankStart, 2.3, (k) => lerp(0.04, 0.015, k), 6, Math.PI), 0.009, 180, 6)
    tube(g, root, helix(r.butt + 0.02, r.gripTop, 0.045, 5, 1), 0.01, 100, 5) // root wrap
    const toad = (y, a, s) => {
      s *= 1.5
      const o = v(Math.cos(a) * 0.04, y, Math.sin(a) * 0.04)
      const top = o.clone().add(v(Math.cos(a) * 0.05 * s, 0.045 * s, Math.sin(a) * 0.05 * s))
      segAB(g, stem, o, top, 0.012 * s, 0.016 * s, 8)
      const c = add(g, new SphereGeometry(0.05 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap)
      c.position.copy(top)
      c.scale.set(1, 0.75, 1)
      c.quaternion.setFromUnitVectors(UP, v(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize())
      for (let i = 0; i < 5; i++) {
        const b = (i / 5) * Math.PI * 2
        const p = v(Math.cos(b) * 0.032 * s, 0.026 * s, Math.sin(b) * 0.032 * s).applyQuaternion(c.quaternion).add(top)
        ball(g, dot, p, 0.007 * s, [1, 1, 1], 6)
      }
      ball(g, dot, v(0, 0.038 * s, 0).applyQuaternion(c.quaternion).add(top), 0.008 * s, [1, 1, 1], 6)
    }
    toad(r.blankStart + 0.05, 0.8, 1.3)
    toad(0.95, 3.6, 1)
    toad(1.35, 1.6, 0.85)
    toad(1.75, 4.6, 0.7)
    toad(2.1, 2.2, 0.55)
    const leafMat = M('#4caa2a', { r: 0.8 })
    const rib = M('#2a6a14', { r: 0.8 })
    for (const [y, a] of [[0.85, 0.4], [1.2, 3.1], [1.6, 5.4], [1.95, 0.9]]) leaf(g, leafMat, rib, v(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03), v(Math.cos(a), 0.8, Math.sin(a)), 0.1, 0.03)
  },

  // A fossil spine: stacked vertebrae, a rib cage, a raptor claw at the tip.
  prehistoric(g) {
    const bone = M('#efc6a0', { r: 0.8 })
    const shade = M('#c8946a', { r: 0.9 })
    const leather = M('#6a3a1a', { r: 0.9 })
    const cord = M('#c8a060', { r: 1 })
    // Leather-bound grip.
    seg(g, bone, -0.4, -0.32, 0.03, 0.045, 10)
    ball(g, bone, v(0, -0.41, 0), 0.04, [1.3, 0.7, 1], 10) // knuckle joint at the butt
    seg(g, leather, -0.32, 0.3, 0.043, 0.04, 14)
    tube(g, cord, helix(-0.3, 0.28, 0.044, 7), 0.006, 120, 5)
    // Vertebrae.
    const n = 20
    let prevTop = 0.3
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      const y0 = prevTop
      const h = lerp(0.12, 0.08, k)
      const r = lerp(0.034, 0.012, k)
      const x = Math.sin(k * 3.2) * 0.02
      seg(g, bone, y0 + 0.01, y0 + h - 0.01, r * 1.25, r * 1.2, 10, x)
      seg(g, shade, y0 + h * 0.35, y0 + h * 0.65, r, r, 10, x)
      seg(g, shade, y0 + h - 0.012, y0 + h, r * 0.7, r * 0.7, 8, x) // disc
      cone(g, bone, v(x - r * 0.8, y0 + h * 0.5, 0), v(x - r * 2.6, y0 + h * 0.8, 0), r * 0.45, 5) // spinous process
      if (i % 2 === 0) for (const s of [-1, 1]) cone(g, shade, v(x, y0 + h * 0.5, s * r), v(x, y0 + h * 0.55, s * r * 2.2), r * 0.35, 4)
      prevTop = y0 + h
    }
    const tipY = prevTop
    // Ribs sweep out to one side and down.
    for (let i = 0; i < 5; i++) {
      const y = 0.75 + i * 0.13
      const l = 0.36 - i * 0.045
      const base = v(-0.02, y, 0.01)
      curveRod(g, bone, [base, base.clone().add(v(-l * 0.5, 0.04, 0.03)), base.clone().add(v(-l, -0.1, 0.05))], 0.02, 0.007, 7, 7)
    }
    // Raptor claw.
    const cb = v(Math.sin(3.2) * 0.02, tipY, 0)
    curveRod(g, M('#4a3a30', { r: 0.4 }), [cb, cb.clone().add(v(0.02, 0.07, 0)), cb.clone().add(v(0.06, 0.12, 0))], 0.014, 0.002, 6, 6)
    const tip = cb.clone().add(v(0.006, 0.02, 0.016))
    // Line through sinew loops.
    const pts = [v(0, 0.32, 0.05)]
    ring(g, cord, 0.32, 0.046, 0.006, { sides: 14 })
    for (const y of [0.9, 1.4, 1.8, 2.15]) {
      const p = v(0, y, 0.04)
      ring(g, cord, y, 0.014, 0.004, { z: 0.04, sides: 10 })
      pts.push(p)
    }
    pts.push(tip)
    line(g, M('#e8dcc0', { r: 0.7 }), pts)
    tipAt(g, tip)
  },

  // A ship's anchor, upside down: ring at the butt, rope-wrapped shank, crown and flukes up top.
  anchor(g) {
    const iron = M('#2f43a0', { r: 0.4, m: 0.6, flat: true })
    const dark = M('#1c2868', { r: 0.5, m: 0.6, flat: true })
    const rope = M('#c8a464', { r: 1 })
    const rust = M('#7a4a2a', { r: 1, flat: true })
    ring(g, dark, -0.38, 0.075, 0.018, { rx: Math.PI / 2, sides: 18 }) // anchor ring
    seg(g, iron, -0.31, 0.05, 0.03, 0.034, 8)
    tube(g, rope, helix(-0.27, 0.3, 0.038, 8), 0.011, 140, 6)
    seg(g, iron, 0.05, 1.95, 0.036, 0.046, 8) // shank
    // Stock: a crossbar with ball ends.
    seg(g, dark, 0.4, 0.46, 0.05, 0.05, 8)
    segAB(g, dark, v(-0.3, 0.43, 0), v(0.3, 0.43, 0), 0.024, 0.024, 8)
    for (const s of [-1, 1]) ball(g, dark, v(s * 0.31, 0.43, 0), 0.034, [1, 1, 1], 10)
    // Crown + arms curving down, flukes on the ends.
    ball(g, dark, v(0, 1.97, 0), 0.06, [1, 1, 1], 10)
    const arm = add(g, new TorusGeometry(0.32, 0.035, 8, 24, Math.PI), iron)
    arm.position.set(0, 1.66, 0)
    arm.rotation.set(0, 0, 0)
    arm.scale.set(1, 1, 1)
    for (const s of [-1, 1]) {
      const end = v(s * 0.32, 1.66, 0)
      const flGeo = new ConeGeometry(0.09, 0.2, 4)
      flGeo.rotateY(Math.PI / 4)
      const fl = add(g, flGeo, dark)
      fl.position.copy(end).add(v(s * 0.03, -0.07, 0))
      fl.rotation.set(0, 0, Math.PI + s * 0.5) // points down and out
      fl.scale.set(1, 1, 0.35)
    }
    // Eye on the crown, where the line leaves.
    ring(g, dark, 2.06, 0.035, 0.011, { rx: Math.PI / 2, sides: 14 })
    // Rust specks + rope line down the shank.
    for (const [y, a] of [[0.7, 0.5], [1.1, 2.6], [1.5, 4.8], [1.85, 1.2]]) ball(g, rust, v(Math.cos(a) * 0.04, y, Math.sin(a) * 0.04), 0.012, [1, 1.4, 1], 5)
    const pts = [v(0, 0.3, 0.05)]
    for (const y of [0.8, 1.3, 1.75]) {
      ring(g, rope, y, 0.05, 0.007, { sides: 12 })
      pts.push(v(0, y, 0.058))
    }
    const tip = v(0, 2.1, 0)
    pts.push(tip)
    line(g, LINE(), pts)
    tipAt(g, tip)
  },

  // Golden trident: ringed shaft, three barbed prongs, a sea-glass orb.
  trident(g) {
    const gold = M('#ffbf12', { r: 0.25, m: 0.9 })
    const deep = M('#c88a08', { r: 0.3, m: 0.85 })
    const gem = M('#3ad8ff', { r: 0.1, m: 0.2, e: '#0a8ac8', ei: 0.7 })
    seg(g, gold, -0.4, -0.34, 0.025, 0.04, 10)
    cone(g, gold, v(0, -0.4, 0), v(0, -0.5, 0), 0.025, 8) // butt spike
    seg(g, deep, -0.34, 0.3, 0.036, 0.034, 14)
    for (let y = -0.3; y < 0.28; y += 0.07) ring(g, gold, y, 0.036, 0.007, { sides: 16 })
    seg(g, gold, 0.3, 1.95, 0.028, 0.022, 12)
    for (const y of [0.3, 0.7, 1.1, 1.5, 1.9]) {
      seg(g, deep, y - 0.03, y + 0.03, 0.038, 0.038, 12)
      ring(g, gold, y - 0.03, 0.038, 0.006, { sides: 14 })
      ring(g, gold, y + 0.03, 0.038, 0.006, { sides: 14 })
    }
    // Head.
    ball(g, gem, v(0, 2.0, 0), 0.05, [1, 1, 1], 14)
    seg(g, gold, 2.04, 2.08, 0.04, 0.05, 12)
    segAB(g, gold, v(-0.15, 2.1, 0), v(0.15, 2.1, 0), 0.022, 0.022, 8)
    for (const s of [-1, 1]) {
      const b = v(s * 0.15, 2.1, 0)
      curveRod(g, gold, [b, b.clone().add(v(s * 0.03, 0.12, 0)), b.clone().add(v(s * 0.01, 0.32, 0))], 0.02, 0.006, 6, 8)
      cone(g, gold, b.clone().add(v(s * 0.01, 0.32, 0)), b.clone().add(v(s * 0.008, 0.4, 0)), 0.012, 6)
      cone(g, gold, b.clone().add(v(s * 0.02, 0.22, 0)), b.clone().add(v(s * -0.03, 0.15, 0)), 0.01, 4) // barb
    }
    seg(g, gold, 2.08, 2.5, 0.022, 0.012, 10)
    cone(g, gold, v(0, 2.5, 0), v(0, 2.6, 0), 0.02, 6)
    for (const s of [-1, 1]) cone(g, gold, v(0, 2.44, 0), v(s * 0.04, 2.38, 0), 0.01, 4)
    // Line through small gold eyes.
    const pts = [v(0, 0.3, 0.04)]
    for (const y of [0.9, 1.3, 1.7]) {
      ring(g, gold, y, 0.012, 0.004, { z: 0.04, sides: 10 })
      pts.push(v(0, y, 0.04))
    }
    const tip = v(0, 2.6, 0.004)
    pts.push(tip)
    line(g, M('#fff2b0', { r: 0.4 }), pts)
    tipAt(g, tip)
  },

  // Pearl white with tilted gold rings, feathered wings at the guard and a halo on top.
  angelic(g) {
    const pearl = M('#f6f6fa', { r: 0.25, m: 0.1 })
    const gold = M('#ffc41a', { r: 0.2, m: 0.9, e: '#7a5000', ei: 0.25 })
    const feather = M('#ffffff', { r: 0.6 })
    const featherShade = M('#e2e6f2', { r: 0.7 })
    const halo = M('#ffe27a', { r: 0.2, m: 0.6, e: '#ffc41a', ei: 0.9 })
    cone(g, gold, v(0, -0.38, 0), v(0, -0.52, 0), 0.03, 8)
    seg(g, gold, -0.38, -0.3, 0.03, 0.04, 12)
    seg(g, pearl, -0.3, 0.3, 0.038, 0.034, 14)
    tube(g, gold, helix(-0.28, 0.28, 0.038, 5), 0.006, 100, 5)
    seg(g, gold, 0.3, 0.36, 0.045, 0.045, 14)
    seg(g, pearl, 0.36, 2.4, 0.03, 0.012, 12)
    // Wings.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const k = i / 4
        const base = v(s * 0.03, 0.34, 0)
        const dir = v(s * lerp(1, 0.45, k), lerp(-0.25, 0.9, k), 0.25)
        const len = lerp(0.3, 0.18, k)
        const f = ball(g, i % 2 ? featherShade : feather, base.clone().addScaledVector(dir.clone().normalize(), len / 2), 1, [0.05, len / 2, 0.016], 10)
        f.quaternion.setFromUnitVectors(UP, dir.normalize())
      }
      ball(g, gold, v(s * 0.035, 0.34, 0), 0.02, [1, 1, 1], 8)
    }
    // Tilted gold rings orbiting the shaft.
    const rings = [[0.75, 0.5], [1.1, -0.45], [1.45, 0.4], [1.8, -0.35], [2.1, 0.3]]
    for (const [y, tilt] of rings) ring(g, gold, y, 0.05 - (y - 0.7) * 0.012, 0.009, { rx: tilt, ry: tilt * 0.6, sides: 20 })
    // Halo above the tip.
    ring(g, halo, 2.52, 0.08, 0.012, { rx: 0.25, sides: 26 })
    cone(g, gold, v(0, 2.4, 0), v(0, 2.47, 0), 0.012, 6)
    const pts = [v(0, 0.36, 0.05)]
    for (const y of [0.95, 1.6, 2.2]) {
      ring(g, gold, y, 0.012, 0.004, { z: 0.034, sides: 10 })
      pts.push(v(0, y, 0.034))
    }
    const tip = v(0, 2.47, 0.004)
    pts.push(tip)
    line(g, M('#ffe9a0', { r: 0.4, e: '#a07a00', ei: 0.3 }), pts)
    tipAt(g, tip)
  },

  // Jointed bamboo with node rings, leaves at a few nodes and a twine grip.
  bamboo(g) {
    const cane = M('#4f9a1e', { r: 0.45 })
    const node = M('#3a7414', { r: 0.5 })
    const light = M('#8ccf4a', { r: 0.5 })
    const twine = M('#d8b878', { r: 1 })
    const leafMat = M('#5cb82a', { r: 0.7 })
    const rib = M('#2a6a10', { r: 0.7 })
    const n = 8
    let y = -0.38
    const nodes = []
    for (let i = 0; i < n; i++) {
      const h = lerp(0.36, 0.3, i / n)
      const r = lerp(0.04, 0.016, i / n)
      seg(g, cane, y + 0.012, y + h - 0.012, r, r * 0.95, 14)
      seg(g, light, y + h * 0.12, y + h * 0.5, r * 1.01, r * 0.97, 14) // sheen band
      ring(g, node, y + h, r * 1.02, r * 0.28, { sides: 16 })
      nodes.push([y + h, r])
      y += h
    }
    ball(g, node, v(0, -0.38, 0), 0.04, [1, 0.3, 1], 12)
    tube(g, twine, helix(-0.32, 0.28, 0.044, 10), 0.007, 160, 5)
    for (const [ny, a, s] of [[nodes[2][0], 0.6, 1], [nodes[4][0], 3.4, 0.9], [nodes[6][0], 5.2, 0.8]]) {
      const p = v(Math.cos(a) * 0.025, ny, Math.sin(a) * 0.025)
      segAB(g, cane, p, p.clone().add(v(Math.cos(a) * 0.06, 0.06, Math.sin(a) * 0.06)), 0.006, 0.004, 6)
      const q = p.clone().add(v(Math.cos(a) * 0.06, 0.06, Math.sin(a) * 0.06))
      leaf(g, leafMat, rib, q, v(Math.cos(a), 1.4, Math.sin(a)), 0.2 * s, 0.03 * s)
      leaf(g, leafMat, rib, q, v(Math.cos(a + 0.8), 0.6, Math.sin(a + 0.8)), 0.16 * s, 0.026 * s)
    }
    const pts = [v(0, 0.3, 0.05)]
    ring(g, twine, 0.3, 0.046, 0.007, { sides: 14 })
    for (let i = 2; i < n; i += 2) {
      const [ny, r] = nodes[i]
      ring(g, twine, ny - 0.03, 0.012, 0.004, { z: r + 0.012, sides: 10 })
      pts.push(v(0, ny - 0.03, r + 0.012))
    }
    const tip = v(0, y + 0.01, 0.006)
    pts.push(tip)
    line(g, LINE(), pts)
    tipAt(g, tip)
  },

  // A katana: wrapped tsuka, round tsuba, a long curved steel blade with line guides on the spine.
  katana(g) {
    const steel = M('#e2e6ee', { r: 0.14, m: 0.95 })
    const edge = M('#ffffff', { r: 0.08, m: 0.8 })
    const goldM = M('#d8a820', { r: 0.25, m: 0.9 })
    const black = M('#18181c', { r: 0.5, m: 0.3 })
    // Kashira (pommel), tsuka (grip), fuchi.
    seg(g, black, -0.42, -0.36, 0.034, 0.04, 14)
    ball(g, black, v(0, -0.42, 0), 0.034, [1, 0.4, 0.8], 12)
    seg(g, goldM, -0.36, -0.34, 0.041, 0.041, 14)
    const grip = seg(g, M('#ffffff', { r: 0.7, map: 'tsuka' }), -0.34, 0.24, 0.04, 0.038, 16)
    grip.scale.set(1, 1, 0.82)
    for (const y of [-0.15, 0.08]) ball(g, goldM, v(0, y, 0.032), 0.014, [1, 2, 0.6], 8) // menuki
    seg(g, goldM, 0.24, 0.27, 0.04, 0.04, 14)
    // Tsuba: dark disc, gold rim, cut-outs implied by gold studs.
    const tsuba = seg(g, black, 0.27, 0.295, 0.085, 0.085, 28)
    tsuba.scale.set(1, 1, 0.85)
    ring(g, goldM, 0.2825, 0.085, 0.008, { sides: 28 })
    for (let i = 0; i < 4; i++) ball(g, goldM, v(Math.cos(i * 1.57 + 0.78) * 0.06, 0.296, Math.sin(i * 1.57 + 0.78) * 0.05), 0.009, [1, 0.5, 1], 6)
    seg(g, goldM, 0.295, 0.35, 0.026, 0.022, 12) // habaki
    // Blade: profile extruded thin, curved back (toward -Z, so the guides sit on the spine at +Z).
    const L = 2.1
    const sh = new Shape()
    const W = 0.042
    const curve = (k) => 0.09 * k * k // sori (curvature) along the blade
    sh.moveTo(0, -W / 2)
    for (let i = 1; i <= 20; i++) {
      const k = i / 20
      const w = lerp(W, W * 0.72, k)
      sh.lineTo(k * L * (i === 20 ? 0.94 : 1), curve(k) - w / 2)
    }
    sh.lineTo(L, curve(1) + W * 0.2) // kissaki
    for (let i = 20; i >= 0; i--) {
      const k = i / 20
      const w = lerp(W, W * 0.72, k)
      sh.lineTo(k * L, curve(k) + w / 2)
    }
    const blade = add(g, new ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1 }), steel)
    // Shape x -> rod +Y, shape y -> rod +Z (blade width faces the sides).
    blade.rotation.set(0, Math.PI / 2, Math.PI / 2)
    blade.position.set(-0.004, 0.35, 0)
    // Hamon line (temper line) as a thin bright strip along the edge side.
    for (let i = 0; i < 10; i++) {
      const k0 = i / 10
      const k1 = (i + 1) / 10
      for (const x of [-0.0085, 0.0085]) segAB(g, edge, v(x, 0.35 + k0 * L, curve(k0) - W * 0.22), v(x, 0.35 + k1 * L, curve(k1) - W * 0.22 + (i % 2 ? 0.004 : -0.004)), 0.0025, 0.0025, 4)
    }
    // Guides on the spine (+Z side), line to the point.
    const pts = [v(0, 0.24, 0.05)]
    ring(g, goldM, 0.24, 0.042, 0.005, { sides: 14 })
    for (const k of [0.15, 0.38, 0.6, 0.8]) {
      const y = 0.35 + k * L
      const z = curve(k) + W * 0.5
      segAB(g, goldM, v(0, y, z - 0.004), v(0, y, z + 0.022), 0.003, 0.003, 5)
      ring(g, goldM, y, 0.012, 0.0035, { z: z + 0.034, sides: 10 })
      pts.push(v(0, y, z + 0.034))
    }
    const tip = v(0, 0.35 + L, curve(1) + W * 0.2)
    pts.push(tip)
    line(g, LINE(), pts)
    tipAt(g, tip)
  },

  // A big striped candy cane with a hook at the top and a green ribbon bow.
  candy_cane(g) {
    const stripe = M('#ffffff', { r: 0.3, map: 'cane' })
    const ribbon = M('#1fa83a', { r: 0.45 })
    const ribbonDark = M('#127a26', { r: 0.5 })
    const R = 0.05
    const pts = [v(0, -0.4, 0), v(0, 0.4, 0), v(0, 1.2, 0), v(0, 1.85, 0), v(0.04, 2.08, 0), v(0.17, 2.22, 0), v(0.32, 2.2, 0), v(0.42, 2.06, 0), v(0.44, 1.9, 0)]
    tube(g, stripe, pts, R, 120, 16)
    ball(g, M('#ffffff', { r: 0.3 }), pts[0], R, [1, 0.5, 1], 14)
    ball(g, M('#e01e2a', { r: 0.3 }), pts[pts.length - 1], R, [1, 0.6, 1], 14)
    // Bow at the grip.
    for (const s of [-1, 1]) {
      const loop = add(g, new TorusGeometry(0.055, 0.016, 8, 18), ribbon)
      loop.position.set(s * 0.06, 0.42, 0.045)
      loop.rotation.set(0.3, s * 0.4, 0)
      loop.scale.set(1, 0.65, 1)
      const tail = segAB(g, ribbonDark, v(s * 0.01, 0.4, 0.05), v(s * 0.06, 0.25, 0.06), 0.014, 0.012, 6)
      tail.scale.set(1, 1, 0.4)
    }
    ball(g, ribbonDark, v(0, 0.42, 0.055), 0.024, [1.2, 1, 0.8], 10)
    seg(g, ribbon, 0.39, 0.45, R * 1.08, R * 1.08, 16)
    // Gold guides up the shaft; the line leaves from the hook's end.
    const gold = M('#ffd21a', { r: 0.25, m: 0.85 })
    const lp = [v(0, 0.45, R + 0.012)]
    for (const y of [0.9, 1.35, 1.8]) {
      ring(g, gold, y, R * 1.06, 0.006, { sides: 16 })
      ring(g, gold, y, 0.014, 0.0045, { z: R + 0.022, sides: 10 })
      lp.push(v(0, y, R + 0.022))
    }
    lp.push(v(0.2, 2.25, 0.02))
    const tip = v(0.44, 1.84, 0)
    lp.push(tip)
    line(g, LINE(), lp)
    tipAt(g, tip)
  },
}

// A fresh model of rod `id` (falls back to the branch). userData.tip = line exit.
export function buildRodModel(id) {
  const g = new Group()
  g.name = `rod:${id}`
  ;(BUILD[id] ?? BUILD.branch)(g)
  if (!g.userData.tip) tipAt(g, v(0, 2.5, 0))
  return g
}

// Frees a model's geometry (materials and textures are shared and stay cached).
export function disposeRodModel(g) {
  g?.traverse((o) => o.geometry?.dispose())
}
