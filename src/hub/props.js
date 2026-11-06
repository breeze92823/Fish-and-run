import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { PLOT, TREADMILLS } from '../config.js'
import { createEmitter } from '../particles.js'
import { fontReady, neon, put } from '../propkit.js'
import { paintBelt, paintSign, paintWood, tex } from './paint.js'
import { bake } from '../bake.js'

// Merges a group of static boxes into one mesh per material (fewer draw calls on phones).
function bakeStatic(group) {
  const baked = bake(group, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  return baked
}

// Hand-built hub props. Each builder returns a Group in its own local frame
// (front = +Z unless noted) plus whatever needs animating.

const box = (sx, sy, sz) => new BoxGeometry(sx, sy, sz)
const mats = new Map()
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra)
  if (!mats.has(key)) mats.set(key, new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra }))
  return mats.get(key)
}
let woodMat = null
export function wood() {
  if (!woodMat) {
    const F = PLOT.fence
    woodMat = new MeshStandardMaterial({ map: tex(paintWood(F.color, F.dark, F.light), 1, 1, 8), roughness: 0.85 })
  }
  return woodMat
}

// A sprite from a canvas painter result ({ canvas, draw }), `height` m tall; repainted
// once the web font is ready.
export function canvasSprite(painted, height, { depthTest = true } = {}) {
  const t = new CanvasTexture(painted.canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest, fog: false }))
  const fit = () => s.scale.set((height * painted.canvas.width) / painted.canvas.height, height, 1)
  fit()
  fontReady.then(() => {
    painted.draw?.()
    t.dispose()
    t.needsUpdate = true
    fit()
  })
  return s
}

// --- Fence round a pool ------------------------------------------------------------------
// A fence on a low curb: posts every postEvery m, two rails, built into `root` round an L x W
// rectangle centred on the origin. opts: gate { x, width } leaves an opening in the front
// (+Z) side; material: the fence's material (default the wooden planks).
export function buildFence(root, L, W, { gate = null, material = null } = {}) {
  const F = PLOT.fence
  const b = F.border
  const front = W / 2 + b / 2
  const full = L + b * 2
  const sides = [
    { cx: 0, cz: -(W / 2 + b / 2), len: full, along: 'x' },
    { cx: -(L / 2 + b / 2), cz: 0, len: W, along: 'z' },
    { cx: L / 2 + b / 2, cz: 0, len: W, along: 'z' },
  ]
  if (gate) {
    // The front in two pieces either side of the opening.
    const left = gate.x - gate.width / 2 + full / 2
    const right = full / 2 - (gate.x + gate.width / 2)
    sides.push({ cx: -full / 2 + left / 2, cz: front, len: left, along: 'x' })
    sides.push({ cx: full / 2 - right / 2, cz: front, len: right, along: 'x' })
  } else sides.push({ cx: 0, cz: front, len: full, along: 'x' })
  const wm = material ?? wood()
  for (const s of sides) {
    const sx = s.along === 'x' ? s.len : b
    const sz = s.along === 'x' ? b : s.len
    put(root, box(sx, 0.3, sz), wm, s.cx, 0.15, s.cz) // curb
    // rails
    for (const y of [0.55, 0.92]) put(root, box(s.along === 'x' ? s.len : F.rail * 0.8, F.rail, s.along === 'x' ? F.rail * 0.8 : s.len), wm, s.cx, y, s.cz)
    // posts
    const n = Math.max(2, Math.round(s.len / F.postEvery) + 1)
    for (let i = 0; i < n; i++) {
      const k = -s.len / 2 + (i / (n - 1)) * s.len
      const px = s.along === 'x' ? s.cx + k : s.cx
      const pz = s.along === 'x' ? s.cz : s.cz + k
      put(root, box(F.post, F.height + 0.08, F.post), wm, px, (F.height + 0.08) / 2, pz)
    }
  }
}

// --- Treadmill -------------------------------------------------------------------------------
// Long axis along local Z: the console (handlebars + screen) at -Z, the belt running
// toward +Z. Returns { group, update(dt, elapsed), belt, flash() }: `belt` = m/s the belt
// surface moves (the demo treadmills keep their idle roll; the live one sets it), flash()
// lights the screen up for a moment (a speed gain).
const BELT_TILE = 4.6 / 4 // m of belt per texture repeat
export function buildTreadmill(tier) {
  const T = TREADMILLS[tier]
  const g = new Group()
  const st = new Group() // static parts, baked below
  const len = 5.2
  const wid = 2.1
  const shiny = tier === 'gold' ? { metalness: 0.55, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.4 } : {}
  const frame = mat(T.frame, shiny)
  const dark = mat(T.frameDark, shiny)
  const trim = mat(T.trim, shiny)
  put(st, box(wid, 0.32, len), dark, 0, 0.16, 0) // base
  put(st, box(0.28, 0.2, len), frame, -(wid / 2 - 0.14), 0.42, 0) // side rails
  put(st, box(0.28, 0.2, len), frame, wid / 2 - 0.14, 0.42, 0)
  put(st, box(wid, 0.36, 0.4), frame, 0, 0.3, len / 2 - 0.2) // rear roller cover
  // Belt (scrolling texture)
  const beltTex = tex(paintBelt(T.belt, tier === 'gold' ? '#fff0a0' : tier === 'amethyst' ? '#a070ff' : '#55576a'), 1, 4, 4)
  const beltMat = new MeshStandardMaterial({ map: beltTex, roughness: 0.8, ...(tier === 'amethyst' ? { emissive: '#4a1aa0', emissiveIntensity: 0.6 } : {}) })
  const belt = new Mesh(new PlaneGeometry(wid - 0.56, len - 0.6), beltMat)
  belt.rotation.x = -Math.PI / 2
  belt.position.set(0, 0.33, 0)
  belt.receiveShadow = true
  g.add(belt)
  // Console
  const cz = -len / 2 + 0.35
  put(st, box(wid, 0.5, 0.7), frame, 0, 0.5, cz)
  for (const s of [-1, 1]) {
    put(st, box(0.24, 1.6, 0.24), frame, s * (wid / 2 - 0.12), 1.1, cz)
    put(st, box(0.14, 0.14, 1.1), trim, s * (wid / 2 - 0.12), 1.45, cz + 0.55) // side handles
  }
  put(st, box(wid, 0.16, 0.16), trim, 0, 1.85, cz) // crossbar
  const screen = put(st, box(1.1, 0.7, 0.14), dark, 0, 2.15, cz - 0.05)
  screen.rotation.x = -0.35
  const face = new Mesh(new PlaneGeometry(0.9, 0.5), neon(T.screen, 1.6))
  face.position.set(0, 2.17, cz + 0.03)
  face.rotation.x = -0.35
  g.add(face)

  const flames = []
  if (T.spikes) {
    // Gothic fence of spikes across the console and two spiked posts.
    const spike = new ConeGeometry(0.07, 0.5, 4)
    for (let i = 0; i < 9; i++) {
      const x = -wid / 2 + 0.25 + (i / 8) * (wid - 0.5)
      put(st, box(0.08, 0.9, 0.08), frame, x, 2.15, cz + 0.1)
      put(st, spike, frame, x, 2.75, cz + 0.1)
    }
    put(st, box(wid, 0.1, 0.1), frame, 0, 2.4, cz + 0.1)
  }
  if (T.candles) {
    // Purple flame candles on the four corners.
    const candle = mat(T.frameDark)
    const flameMat = neon(T.candles, 3, { transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false })
    const corners = [[-1, -len / 2 + 0.1, 2.0], [1, -len / 2 + 0.1, 2.0], [-1, len / 2 - 0.2, 0.6], [1, len / 2 - 0.2, 0.6]]
    for (const [s, z, h] of corners) {
      const x = s * (wid / 2 - 0.05)
      put(st, box(0.36, h, 0.36), candle, x, h / 2, z)
      put(st, box(0.46, 0.12, 0.46), mat(T.frame), x, h, z)
      const f = new Mesh(new ConeGeometry(0.13, 0.42, 5), flameMat)
      f.position.set(x, h + 0.3, z)
      g.add(f)
      flames.push(f)
      createEmitter(g, { boxes: [{ x, y: h + 0.35, z, sx: 0.08, sy: 0.05, sz: 0.08 }], count: 10, life: 0.9, velocity: [0, 1.0, 0], spread: [0.15, 0.3, 0.15], size: 0.22, grow: 0.3, color: T.candles, intensity: 3, seed: x * 10 + z })
    }
  }
  if (T.sparkle) {
    createEmitter(g, { boxes: [{ x: 0, y: 0.9, z: 0, sx: wid / 2, sy: 0.7, sz: len / 2 }], count: 18, life: 1.4, velocity: [0, 0.3, 0], spread: [0.1, 0.2, 0.1], size: 0.4, color: '#fff6c0', intensity: 3, sprite: 'sparkle', twinkle: 7, seed: 77 })
  }
  g.add(bakeStatic(st))
  let flashT = 0
  return {
    group: g,
    belt: 0.9 * BELT_TILE,
    flash() {
      flashT = 0.35
    },
    update(dt, elapsed) {
      beltTex.offset.y = (beltTex.offset.y + (dt * this.belt) / BELT_TILE) % 1
      for (let i = 0; i < flames.length; i++) flames[i].scale.set(1, 0.85 + Math.sin(elapsed * 13 + i * 2) * 0.15, 1)
      if (flashT > 0) {
        flashT = Math.max(0, flashT - dt)
        const k = 1 + Math.sin((flashT / 0.35) * Math.PI) * 0.35
        face.scale.set(k, k, 1)
      }
    },
  }
}

// --- Upgrade sign beside the treadmill ---------------------------------------------------------
// Without state it shows a plain "Upgrade Treadmill" board (other players' treadmills). The
// live sign gets set({ title, line, price, ok }): e.g. "Treadmill Lv 2", "+3 > +10 /step",
// the price (green while affordable, grey otherwise; null = MAX at the top level).
function paintUpgradeSign() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  let st = null
  const text = (g, str, x, y, size, fill, line = 6) => {
    g.font = `700 ${size}px Fredoka, sans-serif`
    g.lineWidth = line
    g.strokeStyle = '#0b0e16'
    g.fillStyle = fill
    g.strokeText(str, x, y)
    g.fillText(str, x, y)
  }
  const btn = (g, x, w, col, label) => {
    g.fillStyle = col
    g.fillRect(x, 110, w, 52)
    g.strokeStyle = '#0b0e16'
    g.lineWidth = 4
    g.strokeRect(x, 110, w, 52)
    text(g, label, x + w / 2, 146, 28, '#ffffff', 5)
  }
  const draw = () => {
    const g = c.getContext('2d')
    g.fillStyle = '#1d2230'
    g.fillRect(0, 0, 256, 192)
    g.strokeStyle = '#3a4258'
    g.lineWidth = 10
    g.strokeRect(5, 5, 246, 182)
    g.textAlign = 'center'
    if (!st) {
      text(g, 'Upgrade', 128, 48, 30, '#ffffff')
      text(g, 'Treadmill', 128, 82, 30, '#ffffff')
      btn(g, 28, 200, '#5a6070', 'Upgrade')
      return
    }
    text(g, st.title, 128, 46, 28, '#ffffff')
    text(g, st.line, 128, 84, 26, '#7dff4a')
    btn(g, 28, 200, st.price == null ? '#c89a1a' : st.ok ? '#2fc84a' : '#5a6070', st.price ?? 'MAX')
  }
  draw()
  return {
    canvas: c,
    draw,
    set(next) {
      st = next
      draw()
    },
  }
}
export function buildUpgradeSign() {
  const g = new Group()
  put(g, box(0.18, 1.3, 0.18), mat('#2a2e3a'), 0, 0.65, 0)
  const board = put(g, box(1.5, 1.1, 0.12), mat('#1d2230'), 0, 1.75, 0)
  board.rotation.x = -0.25
  const painted = paintUpgradeSign()
  const t = new CanvasTexture(painted.canvas)
  t.colorSpace = SRGBColorSpace
  fontReady.then(() => {
    painted.draw()
    t.needsUpdate = true
  })
  const face = new Mesh(new PlaneGeometry(1.4, 1.0), new MeshBasicMaterial({ map: t }))
  face.position.set(0, 1.76, 0.075)
  face.rotation.x = -0.25
  g.add(face)
  return {
    group: g,
    // { title, line, price, ok } ready to print (see above).
    set(state) {
      painted.set(state)
      t.needsUpdate = true
    },
  }
}

// --- Blocky shopkeeper ---------------------------------------------------------------------------
const KEEPERS = {
  rods: { shirt: '#1c1c22', trim: '#ffffff', skin: '#f2c79a', hair: '#2a1a12', hat: null },
  trails: { shirt: '#ffd21a', trim: '#1c1c22', skin: '#f2c79a', hair: '#141414', hat: '#141414' },
  sell: { shirt: '#f4f4f4', trim: '#c84a3a', skin: '#f2c79a', hair: '#e8e8e8', hat: null },
}
export function buildKeeper(kind) {
  const K = KEEPERS[kind]
  const g = new Group()
  const body = new Group()
  g.add(body)
  put(body, box(0.85, 0.85, 0.42), mat(K.shirt), 0, 1.55, 0)
  put(body, box(0.87, 0.12, 0.44), mat(K.trim), 0, 1.92, 0)
  for (const s of [-1, 1]) put(body, box(0.36, 0.8, 0.38), mat(K.shirt), s * 0.62, 1.55, 0.05)
  for (const s of [-1, 1]) put(body, box(0.4, 0.8, 0.42), mat('#24242c'), s * 0.21, 0.75, 0)
  const head = new Group()
  head.position.set(0, 2.0, 0)
  body.add(head)
  put(head, box(0.62, 0.58, 0.58), mat(K.skin), 0, 0.32, 0)
  put(head, box(0.66, 0.2, 0.62), mat(K.hair), 0, 0.66, -0.02)
  put(head, box(0.66, 0.4, 0.2), mat(K.hair), 0, 0.45, -0.24)
  if (K.hat) put(head, box(0.7, 0.14, 0.8), mat(K.hat), 0, 0.78, 0.06)
  const eye = mat('#101010')
  for (const s of [-1, 1]) put(head, box(0.08, 0.12, 0.02), eye, s * 0.13, 0.38, 0.3, false)
  put(head, box(0.22, 0.04, 0.02), eye, 0, 0.2, 0.3, false)
  return {
    group: g,
    update(elapsed, seed) {
      body.position.y = Math.sin(elapsed * 2 + seed) * 0.03
      head.rotation.y = Math.sin(elapsed * 0.6 + seed) * 0.5
    },
  }
}

// --- Stall -------------------------------------------------------------------------------------
// Wooden booth with a striped, slanted awning; counter at the front (+Z), keeper
// behind it, glowing pad on the ground in front, sign floating above.
export function buildStall(def) {
  const g = new Group()
  const st = new Group() // static parts, baked below
  const W = 4.6
  const D = 3.2
  const wm = wood()
  put(st, box(W, 0.3, D), wm, 0, 0.15, 0) // floor
  put(st, box(W, 1.0, 0.5), wm, 0, 0.8, D / 2 - 0.25) // counter
  put(st, box(W + 0.2, 0.16, 0.8), mat('#8f96e0'), 0, 1.38, D / 2 - 0.2) // countertop (lavender trim)
  put(st, box(W, 0.12, 0.7), mat('#8f96e0'), 0, 0.42, D / 2 + 0.1) // kick plate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(st, box(0.28, 3.3, 0.28), wm, sx * (W / 2 - 0.14), 1.65, sz * (D / 2 - 0.14))
  put(st, box(W, 1.6, 0.2), wm, 0, 2.3, -D / 2 + 0.1) // back board (upper)
  // Awning: stripes from back (high) to front (low), alternating colours, blocky scallops.
  const stripes = 6
  const sw = (W + 0.6) / stripes
  const awning = new Group()
  awning.position.set(0, 3.55, 0.1)
  awning.rotation.x = 0.28
  st.add(awning)
  for (let i = 0; i < stripes; i++) {
    const col = i % 2 === 0 ? def.awning[0] : def.awning[1]
    put(awning, box(sw, 0.28, D + 1.0), mat(col), -(W + 0.6) / 2 + sw * (i + 0.5), 0, 0)
    put(awning, box(sw, 0.42, 0.28), mat(col), -(W + 0.6) / 2 + sw * (i + 0.5), -0.3, (D + 1.0) / 2 - 0.14) // front valance
  }
  g.add(bakeStatic(st))
  // Glowing pad in front.
  const pad = new Group()
  pad.position.set(0, 0.04, D / 2 + 2.2)
  g.add(pad)
  const padFill = new Mesh(new PlaneGeometry(3.4, 2.0), neon(def.pad, 1.6, { transparent: true, opacity: 0.75 }))
  padFill.rotation.x = -Math.PI / 2
  pad.add(padFill)
  const edge = neon(def.pad, 3.5)
  for (const [sx, sz, x, z] of [[3.6, 0.12, 0, -1.0], [3.6, 0.12, 0, 1.0], [0.12, 2.0, -1.74, 0], [0.12, 2.0, 1.74, 0]]) {
    const e = new Mesh(new BoxGeometry(sx, 0.05, sz), edge)
    e.position.set(x, 0.02, z)
    pad.add(e)
  }
  const halo = new Mesh(new PlaneGeometry(4.6, 3.2), new MeshBasicMaterial({ color: def.pad, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.01
  pad.add(halo)
  createEmitter(pad, { boxes: [{ x: 0, y: 0.1, z: 0, sx: 1.6, sy: 0, sz: 0.9 }], count: 22, life: 1.8, velocity: [0, 0.9, 0], spread: [0.05, 0.3, 0.05], size: 0.18, color: def.pad, intensity: 2.5, seed: def.x })

  const keeper = buildKeeper(def.keeper)
  keeper.group.position.set(0, 0.3, -0.2)
  g.add(keeper.group)

  const sign = canvasSprite(paintSign(def.label, { fill: def.labelFill, outline: def.labelOutline }), 1.25)
  sign.position.set(0, 5.0, 0.6)
  g.add(sign)

  return {
    group: g,
    padWorld: null,
    update(elapsed) {
      keeper.update(elapsed, def.x)
      padFill.material.opacity = 0.6 + Math.sin(elapsed * 3 + def.x) * 0.15
      halo.material.opacity = 0.16 + Math.sin(elapsed * 3 + def.x) * 0.08
    },
  }
}

// --- Leaderboard ----------------------------------------------------------------------------
function paintBoard(title, rows, you) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 640
  const draw = () => {
    const g = c.getContext('2d')
    g.fillStyle = '#23283a'
    g.fillRect(0, 0, 512, 640)
    g.textBaseline = 'middle'
    // Title
    g.textAlign = 'center'
    g.font = '700 54px Fredoka, sans-serif'
    g.lineJoin = 'round'
    g.lineWidth = 10
    g.strokeStyle = '#0d1a08'
    g.strokeText(title, 256, 48)
    const grad = g.createLinearGradient(0, 22, 0, 74)
    grad.addColorStop(0, '#e8ff3a')
    grad.addColorStop(1, '#38e000')
    g.fillStyle = grad
    g.fillText(title, 256, 48)
    const all = [...rows.map((r, i) => [`#${i + 1}`, r[0], r[1]]), ['---', you[0], you[1]]]
    all.forEach(([rank, name, value], i) => {
      const y = 96 + i * 58
      g.fillStyle = i % 2 ? '#2c3248' : '#333a54'
      g.fillRect(24, y, 464, 50)
      g.strokeStyle = '#4a5578'
      g.lineWidth = 3
      g.strokeRect(24, y, 464, 50)
      g.textAlign = 'left'
      g.font = '700 28px Fredoka, sans-serif'
      g.lineWidth = 5
      g.strokeStyle = '#0b0e16'
      g.fillStyle = '#ffffff'
      g.strokeText(rank, 36, y + 26)
      g.fillText(rank, 36, y + 26)
      g.font = '600 26px Fredoka, sans-serif'
      g.strokeText(name, 100, y + 26)
      g.fillText(name, 100, y + 26)
      g.textAlign = 'right'
      g.font = '700 24px Fredoka, sans-serif'
      g.fillStyle = '#3cff3c'
      g.strokeText(value, 476, y + 26)
      g.fillText(value, 476, y + 26)
    })
  }
  draw()
  return { canvas: c, draw }
}
export function buildLeaderboard(def, youName, youValue) {
  const g = new Group()
  const W = 5.4
  const H = 6.6
  const frame = mat('#353a52')
  put(g, box(W + 0.5, H + 0.5, 0.45), frame, 0, 1.2 + H / 2, 0)
  for (const s of [-1, 1]) put(g, box(0.5, 1.4, 0.5), frame, s * (W / 2 - 0.4), 0.7, 0)
  const gem = mat('#bfe6ff', { emissive: '#4aa8ff', emissiveIntensity: 0.5 })
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(g, box(0.42, 0.42, 0.55), gem, sx * (W / 2 + 0.12), 1.2 + H / 2 + sy * (H / 2 + 0.12), 0)
  const painted = paintBoard(def.title, def.rows, [youName, youValue])
  const t = new CanvasTexture(painted.canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  const face = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: t }))
  face.position.set(0, 1.2 + H / 2, 0.235)
  g.add(face)
  let rows = def.rows
  let you = [youName, youValue]
  const repaint = () => {
    const next = paintBoard(def.title, rows, you)
    painted.canvas.getContext('2d').drawImage(next.canvas, 0, 0)
    t.needsUpdate = true
  }
  fontReady.then(() => {
    painted.draw()
    t.needsUpdate = true
  })
  return {
    group: g,
    setYou(name, value) {
      you = [name, value]
      repaint()
    },
    // [[name, value text], ...] (the server's board), replacing the placeholder rows.
    setRows(next) {
      rows = next
      repaint()
    },
  }
}

// --- Owner tag: round head-shot + name ----------------------------------------------------------
function drawHead(g, cx, cy, r, h) {
  g.save()
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = '#16161c'
  g.fill()
  g.clip()
  // Blocky head
  const s = r * 1.15
  g.fillStyle = h.skin
  g.fillRect(cx - s / 2, cy - s * 0.38, s, s)
  // Hair / hat
  g.fillStyle = h.hair
  g.fillRect(cx - s * 0.56, cy - s * 0.52, s * 1.12, s * 0.3)
  g.fillRect(cx - s * 0.56, cy - s * 0.4, s * 0.16, s * 0.5)
  g.fillRect(cx + s * 0.4, cy - s * 0.4, s * 0.16, s * 0.5)
  if (h.hat) {
    g.fillStyle = h.hat
    g.fillRect(cx - s * 0.58, cy - s * 0.68, s * 1.16, s * 0.26)
    g.fillRect(cx - s * 0.2, cy - s * 0.46, s * 0.86, s * 0.1)
  }
  // Face
  g.fillStyle = '#141414'
  const ey = cy - s * 0.02
  if (h.face === 'shades') {
    g.fillStyle = '#8a3aff'
    g.fillRect(cx - s * 0.42, ey - s * 0.1, s * 0.36, s * 0.18)
    g.fillRect(cx + s * 0.06, ey - s * 0.1, s * 0.36, s * 0.18)
    g.fillStyle = '#141414'
    g.fillRect(cx - s * 0.06, ey - s * 0.06, s * 0.12, s * 0.05)
  } else if (h.face === 'goggles') {
    g.fillStyle = '#2a2a30'
    g.beginPath()
    g.arc(cx - s * 0.2, ey, s * 0.15, 0, Math.PI * 2)
    g.arc(cx + s * 0.2, ey, s * 0.15, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#d02a2a'
    g.beginPath()
    g.arc(cx - s * 0.2, ey, s * 0.08, 0, Math.PI * 2)
    g.arc(cx + s * 0.2, ey, s * 0.08, 0, Math.PI * 2)
    g.fill()
  } else {
    g.fillRect(cx - s * 0.24, ey - s * 0.1, s * 0.1, s * 0.16)
    g.fillRect(cx + s * 0.14, ey - s * 0.1, s * 0.1, s * 0.16)
  }
  g.strokeStyle = '#141414'
  g.lineWidth = s * 0.06
  g.beginPath()
  if (h.face === 'grin') g.arc(cx, ey + s * 0.12, s * 0.2, 0.1 * Math.PI, 0.9 * Math.PI)
  else if (h.face === 'smirk') g.arc(cx + s * 0.05, ey + s * 0.14, s * 0.14, 0.15 * Math.PI, 0.7 * Math.PI)
  else g.arc(cx, ey + s * 0.1, s * 0.16, 0.2 * Math.PI, 0.8 * Math.PI)
  g.stroke()
  // Torso peeking in at the bottom
  g.fillStyle = h.hat ?? h.hair
  g.fillRect(cx - s * 0.7, cy + s * 0.64, s * 1.4, s * 0.6)
  g.restore()
  g.lineWidth = r * 0.08
  g.strokeStyle = '#0b0b10'
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.stroke()
}
export function ownerTag(name, head) {
  const c = document.createElement('canvas')
  const draw = () => {
    const g = c.getContext('2d')
    g.font = '700 46px Fredoka, sans-serif'
    const w = Math.max(220, g.measureText(name).width + 40)
    c.width = Math.ceil(w)
    c.height = 290
    const r = 92
    drawHead(g, c.width / 2, 104, r, head)
    g.font = '700 46px Fredoka, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 10
    g.strokeStyle = '#121218'
    g.strokeText(name, c.width / 2, 250)
    g.fillStyle = '#ffffff'
    g.fillText(name, c.width / 2, 250)
  }
  draw()
  return canvasSprite({ canvas: c, draw }, 4.4)
}

// "Your plot" house marker (sprite).
export function houseIcon() {
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const g = c.getContext('2d')
  g.lineJoin = 'round'
  g.lineWidth = 9
  g.strokeStyle = '#3a0a0a'
  // body
  g.fillStyle = '#ffe2c8'
  g.beginPath()
  g.rect(36, 70, 88, 70)
  g.fill()
  g.stroke()
  // roof
  g.fillStyle = '#ff3a2a'
  g.beginPath()
  g.moveTo(14, 82)
  g.lineTo(80, 18)
  g.lineTo(146, 82)
  g.lineTo(126, 92)
  g.lineTo(80, 50)
  g.lineTo(34, 92)
  g.closePath()
  g.fill()
  g.stroke()
  // window + door
  g.fillStyle = '#3a8cff'
  g.fillRect(50, 88, 26, 24)
  g.strokeRect(50, 88, 26, 24)
  g.fillStyle = '#ff6a3a'
  g.fillRect(88, 96, 24, 44)
  g.strokeRect(88, 96, 24, 44)
  return canvasSprite({ canvas: c }, 2.2)
}
