import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from '../textures.js'

// Canvas painters for the hub's look: the studded lime baseplate, the mottled
// orange walls, the finish-line checker, pool water caustics and wood grain.
// All tile seamlessly. `tex()` wraps a canvas in a repeating sRGB texture.

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function tex(c, repeatX = 1, repeatY = repeatX, anisotropy = 16) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = anisotropy
  return t
}

// Baseplate studs: each cell is a stud seen from above, a darker crescent on its
// lower edge and a light rim on its upper edge (reads as the reference's little
// "U" marks at a grazing angle). `cells` studs per side.
export function paintStuds(base, dark, light, cells = 4, px = 64) {
  const size = cells * px
  const c = canvas(size)
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  const r = px * 0.3
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const cx = (i + 0.5) * px
      const cy = (j + 0.5) * px
      g.lineCap = 'round'
      g.lineWidth = px * 0.075
      g.strokeStyle = dark
      g.beginPath()
      g.arc(cx, cy, r, Math.PI * 0.05, Math.PI * 0.95)
      g.stroke()
      g.lineWidth = px * 0.05
      g.strokeStyle = light
      g.globalAlpha = 0.55
      g.beginPath()
      g.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85)
      g.stroke()
      g.globalAlpha = 1
    }
  }
  return c
}

// Orange wall: blotchy blocks in three shades plus a faint stud grid, like the
// reference's pebbly orange plastic.
export function paintWall(base, dark, light, size = 256, seed = 9) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  const shades = [dark, light, base, dark]
  for (let i = 0; i < 420; i++) {
    const w = 6 + Math.floor(rand() * 18)
    const h = 4 + Math.floor(rand() * 10)
    const x = Math.floor(rand() * size)
    const y = Math.floor(rand() * size)
    g.fillStyle = shades[Math.floor(rand() * shades.length)]
    g.globalAlpha = 0.35 + rand() * 0.4
    for (const ox of [-size, 0]) for (const oy of [-size, 0]) g.fillRect(x + ox + (x + w > size ? size : 0), y + oy + (y + h > size ? size : 0), w, h)
  }
  g.globalAlpha = 0.18
  g.fillStyle = dark
  const step = size / 16
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) g.fillRect(i * step + step * 0.2, j * step + step * 0.62, step * 0.6, step * 0.12)
  g.globalAlpha = 1
  return c
}

// Finish-line checker: 2 rows x 2 columns (repeat along X for the full line).
export function paintChecker(a = '#ffffff', b = '#151a1c', px = 64) {
  const c = canvas(px * 2, px * 2)
  const g = c.getContext('2d')
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? b : a
      g.fillRect(i * px, j * px, px, px)
    }
  return c
}

// Pool water: bright cyan with a web of lighter caustic lines (Voronoi cell edges).
export function paintCaustics(base, light, deep, size = 256, cells = 7, seed = 5) {
  const rand = mulberry32(seed)
  const pts = []
  for (let i = 0; i < cells * cells; i++) pts.push([rand() * size, rand() * size])
  const c = canvas(size)
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  const parse = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const B = parse(base)
  const L = parse(light)
  const D = parse(deep)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = 1e9
      let d2 = 1e9
      for (const [px, py] of pts) {
        let dx = Math.abs(x - px)
        let dy = Math.abs(y - py)
        if (dx > size / 2) dx = size - dx
        if (dy > size / 2) dy = size - dy
        const d = dx * dx + dy * dy
        if (d < d1) {
          d2 = d1
          d1 = d
        } else if (d < d2) d2 = d
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1) // 0 on a cell edge
      const line = Math.max(0, 1 - edge / 3.2)
      const shade = Math.min(1, Math.sqrt(d1) / (size / cells)) // darker toward cell centres
      const i = (y * size + x) * 4
      for (let k = 0; k < 3; k++) {
        const v = B[k] + (D[k] - B[k]) * shade * 0.35
        img.data[i + k] = v + (L[k] - v) * line
      }
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

// Wood plank grain for fences, stalls and benches.
export function paintWood(base, dark, light, size = 128, seed = 3) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 60; i++) {
    const y = rand() * size
    g.strokeStyle = rand() < 0.6 ? dark : light
    g.globalAlpha = 0.25 + rand() * 0.3
    g.lineWidth = 1 + rand() * 2
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.5)
    g.stroke()
  }
  g.globalAlpha = 1
  return c
}

// Moving treadmill belt: dark rubber with lighter slats.
export function paintBelt(base, slat, size = 64) {
  const c = canvas(size)
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  g.fillStyle = slat
  for (let i = 0; i < 4; i++) g.fillRect(0, i * (size / 4), size, size / 16)
  return c
}

// Outlined, optionally gradient-filled sign text ('rainbow' or [top, bottom] colours).
// Returns the canvas; draw() repaints once the web font is ready.
export function paintSign(text, { fill = '#ffffff', outline = '#1a1a2a', font = '700 110px Fredoka, "Arial Black", sans-serif', outlineWidth = 18, pad = 22 } = {}) {
  const c = canvas(8, 8)
  const draw = () => {
    const g = c.getContext('2d')
    g.font = font
    const w = g.measureText(text).width
    const px = parseInt(font.match(/(\d+)px/)[1], 10)
    c.width = Math.ceil(w + pad * 2 + outlineWidth)
    c.height = Math.ceil(px * 1.25 + pad * 2)
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    const cx = c.width / 2
    const cy = c.height / 2 + px * 0.04
    g.lineWidth = outlineWidth
    g.strokeStyle = outline
    g.strokeText(text, cx, cy)
    let style = fill
    if (fill === 'rainbow') {
      style = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
      ;['#22e04a', '#c8f020', '#ffd21a', '#ff7a1a', '#ff3a6a', '#d040ff'].forEach((col, i, a) => style.addColorStop(i / (a.length - 1), col))
    } else if (Array.isArray(fill)) {
      style = g.createLinearGradient(0, cy - px / 2, 0, cy + px / 2)
      style.addColorStop(0, fill[0])
      style.addColorStop(1, fill[1])
    }
    g.fillStyle = style
    g.fillText(text, cx, cy)
  }
  draw()
  return { canvas: c, draw }
}
