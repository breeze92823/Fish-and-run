// 2D DOM HUD laid over the game canvas.
//
//   const hud = createHud({ onAction(name, value) {} })
//   name: 'index' | 'speed' | 'fish' | 'gems' | 'offer'
//         | 'slowMode' (value = bool) | 'equip' (value = 1 | 2 | null)
//
// Sized from the 1920x992 reference with the CSS var --u (1 reference px). On
// every resize / orientation change / Boxity reserved-area change / touch-UI
// toggle, layout() measures the blocks once and moves them (by transform) so
// they clear Boxity's reserved areas, the touch controls (touch.js) and each
// other. update(dt) only touches the DOM when a displayed string changes.
import './hud.css'
import { SPEED_BOOST } from '../config.js'
import * as I from './icons.js'
import { onReservedAreas } from '../bloxity.js'

// When the "UPDATE IN ..." countdown reaches 0s.
export const UPDATE_AT = '2026-11-13T17:00:00Z'
// "Next event in hh:mm:ss" repeats on this wall-clock period (stable across reloads). Defaults
// until the server's `schedule` message arrives (setSchedule), which then rules both countdowns.
export const EVENT_PERIOD_S = 5 * 60 * 60

let updateAtMs = Date.parse(UPDATE_AT)
let eventPeriodS = EVENT_PERIOD_S
let clockOffset = 0 // server time minus this device's clock, so a wrong local clock doesn't skew them
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

// --- Formatting -------------------------------------------------------------------
function tier(n) {
  return n < 1000 ? 0 : Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3 + 1e-9))
}
function trimZeros(s) {
  return s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, '')
}
// 222500 -> "222.5K" (dec = max decimals; floored so it never shows more than you have).
export function formatShort(n, dec = 1) {
  n = Math.max(0, +n || 0)
  const i = tier(n)
  if (i === 0) return String(Math.floor(n))
  const p = 10 ** dec
  const v = Math.floor((n / 1000 ** i) * p) / p
  return trimZeros(v.toFixed(dec)) + SUFFIX[i]
}
export const formatMoney = (n, dec = 1) => '$' + formatShort(n, dec)
// Number that changes exactly when formatShort's output does (no string building).
function shortKey(n, dec) {
  n = Math.max(0, n)
  const i = tier(n)
  return i === 0 ? Math.floor(n) : i * 1e15 + Math.floor((n / 1000 ** i) * 10 ** dec)
}
function formatCountdown(s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
const pad2 = (n) => (n < 10 ? '0' : '') + n

// --- DOM helpers ------------------------------------------------------------------
function el(tag, cls, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html) e.innerHTML = html
  return e
}
function icon(cls, svg) {
  return el('span', cls, svg)
}
// Outlined text: { el, set(text) }; set() writes only when the text changes.
function ot(cls, text, grad = false) {
  const e = el('span', `ot ${grad ? 'grad ' : ''}${cls || ''}`)
  const fill = el('span', 'ot-fill')
  const node = document.createTextNode(text)
  fill.appendChild(node)
  e.appendChild(fill)
  e.dataset.t = text
  let cur = text
  return {
    el: e,
    set(s) {
      if (s === cur) return
      cur = s
      e.dataset.t = s
      node.nodeValue = s
    },
  }
}
// Tap/click with squash feedback. Fires on release inside the element; the
// pointerdown never reaches the canvas (no pointer lock grab).
function pressable(e, fn) {
  e.setAttribute('role', 'button')
  e.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return
    ev.stopPropagation()
    ev.preventDefault()
    e.classList.add('is-down')
    try {
      e.setPointerCapture(ev.pointerId)
    } catch {
      // Ignore.
    }
  })
  const end = (ev) => {
    if (!e.classList.contains('is-down')) return
    e.classList.remove('is-down')
    if (ev.type !== 'pointerup') return
    const r = e.getBoundingClientRect()
    const slack = 12
    if (ev.clientX >= r.left - slack && ev.clientX <= r.right + slack && ev.clientY >= r.top - slack && ev.clientY <= r.bottom + slack) fn()
  }
  e.addEventListener('pointerup', end)
  e.addEventListener('pointercancel', end)
  e.addEventListener('lostpointercapture', end)
}

// --- Layout: keep blocks off reserved areas, touch controls and each other --------
const GAP = 6
const SHRINK = [0.85, 0.72] // scales layout() tries when a block has no room at full size

function hits(x, y, w, h, obs) {
  for (const o of obs) {
    if (x < o.r + GAP && x + w + GAP > o.x && y < o.b + GAP && y + h + GAP > o.y) return true
  }
  return false
}

// r = natural rect {x, y, w, h}; spec = { anchor: 'left'|'right'|'center', dir: 'down'|'up', minScale }.
// Returns { x, y, s } (s = scale, center blocks only).
function place(r, spec, obs, B) {
  const { w, h } = r
  const down = spec.dir === 'down'
  const ys = [r.y]
  for (const o of obs) {
    const y = down ? o.b + GAP : o.y - GAP - h
    if (down ? y > r.y : y < r.y) ys.push(y)
  }
  ys.sort(down ? (a, b) => a - b : (a, b) => b - a)
  const inY = (y) => y >= B.t && y + h <= B.b

  if (spec.anchor === 'center') {
    const cx = r.x + w / 2
    const minScale = spec.minScale || 1
    for (const y of ys) {
      if (!inY(y)) continue
      // Free horizontal intervals in this band.
      const band = obs.filter((o) => y < o.b + GAP && y + h + GAP > o.y).sort((a, b) => a.x - b.x)
      let best = null
      let L = B.l
      const consider = (R) => {
        const span = R - L
        if (span >= w * minScale) {
          const s = Math.min(1, span / w)
          const sw = w * s
          const x = Math.min(Math.max(cx - sw / 2, L), R - sw)
          const score = (s < 1 ? 1e6 * (1 - s) : 0) + Math.abs(x + sw / 2 - cx)
          if (!best || score < best.score) best = { x, y, s, score }
        }
      }
      for (const o of band) {
        consider(o.x - GAP)
        L = Math.max(L, o.r + GAP)
      }
      consider(B.r)
      if (best) return best
    }
    return { x: r.x, y: r.y, s: 1, none: true }
  }

  const left = spec.anchor === 'left'
  const xs = [r.x]
  for (const o of obs) {
    const x = left ? o.r + GAP : o.x - GAP - w
    if (left ? x > r.x : x < r.x) xs.push(x)
  }
  xs.sort(left ? (a, b) => a - b : (a, b) => b - a)
  // x-major: slide vertically first, sideways only when the column is full
  // (yMajor: the other way round, stay high and slide sideways).
  if (spec.yMajor) {
    for (const y of ys) {
      if (!inY(y)) continue
      for (const x of xs) if (x >= B.l && x + w <= B.r && !hits(x, y, w, h, obs)) return { x, y, s: 1 }
    }
  } else {
    for (const x of xs) {
      if (x < B.l || x + w > B.r) continue
      for (const y of ys) {
        if (inY(y) && !hits(x, y, w, h, obs)) return { x, y, s: 1 }
      }
    }
  }
  return { x: r.x, y: r.y, s: 1, none: true } // no free spot at this size
}

// --- The HUD ----------------------------------------------------------------------
export function createHud({ onAction = () => {} } = {}) {
  const act = (name, value) => {
    try {
      onAction(name, value)
    } catch (err) {
      console.warn('[hud] onAction threw', err)
    }
  }

  const root = el('div', 'hud')
  root.dataset.mode = 'desk'

  // Top centre: offline earnings.
  const earn = el('div', 'hud-block hud-earn')
  const earnAmount = ot('green', '$0')
  earn.append(ot('', 'You earn ').el, earnAmount.el, ot('', '/Day offline!').el, icon('hud-devil', I.devil))

  // Top left: update countdown.
  const update = el('div', 'hud-block hud-update')
  const updateText = ot('', ' IN 0s')
  update.append(ot('green', 'UPDATE').el, updateText.el)

  // Left column tiles.
  const tiles = el('div', 'hud-block hud-tiles')
  const index = el('div', 'hud-tile hud-tile--index')
  index.append(icon('hud-tile-ico', I.book), ot('hud-tile-label', 'Index').el)
  const speed = el('div', 'hud-tile hud-tile--speed')
  speed.append(el('span', 'hud-rays'), icon('hud-tile-ico', I.bolt), ot('hud-tile-label', 'x2 Speed').el)
  const only = el('div', 'hud-only')
  const onlyLabel = ot('hud-only-label', '10 MIN')
  const onlyPrice = ot('hud-only-price', '0')
  only.append(onlyLabel.el, onlyPrice.el)
  tiles.append(index, speed, only)
  pressable(index, () => act('index'))
  pressable(speed, () => act('speed'))

  // Top right: offer card (the game draws the 3D model into offerBox() / offerRect()).
  const offer = el('div', 'hud-block hud-offer')
  const offerPct = ot('hud-offer-pct', '135% Of Best')
  const offerName = ot('hud-offer-name', 'Rainbow Mosasaur', true)
  const offerBox = el('div', 'hud-offer-box')
  offerBox.append(el('span', 'hud-rays'))
  for (const [x, y, s, delay] of [
    [104, 34, 46, 0],
    [206, 56, 40, 0.8],
    [162, 80, 38, 1.6],
  ]) {
    const sp = icon('hud-spark', I.sparkle)
    sp.style.cssText = `left:calc(${x - s / 2} * var(--u));top:calc(${y - s / 2} * var(--u));width:calc(${s} * var(--u));height:calc(${s} * var(--u));animation-delay:${delay}s`
    offerBox.append(sp)
  }
  const offerPrice = el('div', 'hud-offer-price')
  const offerPriceText = ot('', '0', true)
  offerPrice.append(offerPriceText.el)
  offer.append(offerPct.el, offerName.el, offerBox, offerPrice)
  offerBox.addEventListener('pointerdown', (e) => e.stopPropagation())
  offerBox.addEventListener('click', () => act('offer'))
  offerPrice.setAttribute('role', 'button')
  pressable(offerPrice, () => act('offer'))

  // Right edge: fish tile.
  const fishTile = el('div', 'hud-block hud-fish')
  fishTile.append(icon('hud-ico', I.fish))
  pressable(fishTile, () => act('fish'))

  // Bottom left: slow mode toggle, trained speed (the shoe row, still classed hud-gems), speed multiplier, cash.
  const leftStack = el('div', 'hud-block hud-left')
  const toggle = el('div', 'hud-toggle')
  toggle.append(el('span', 'hud-knob'))
  const gemsRow = el('div', 'hud-row hud-gems')
  const gemsIco = icon('hud-ico', I.shoe)
  gemsIco.append(icon('hud-plus', I.plusBox))
  const gemsNum = ot('hud-gems-num', '0', true)
  gemsRow.append(gemsIco, gemsNum.el)
  const speedRow = el('div', 'hud-row hud-speed')
  const speedNum = ot('hud-speed-num', '1', true)
  speedRow.append(icon('hud-ico', I.bolt), speedNum.el, ot('hud-speed-unit', 'Speed').el)
  const cashRow = el('div', 'hud-row hud-cash')
  const cashNum = ot('hud-cash-num', '$0', true)
  cashRow.append(icon('hud-ico', I.cash), cashNum.el)
  leftStack.append(toggle, ot('hud-toggle-label', 'Slow Mode').el, gemsRow, speedRow, cashRow)
  let slow = false
  pressable(toggle, () => {
    setSlowMode(!slow)
    act('slowMode', slow)
  })
  pressable(gemsIco, () => act('gems'))

  // Bottom centre: backpack bar + hotbar.
  const pack = el('div', 'hud-block hud-pack')
  const bar = el('div', 'hud-pack-bar')
  bar.append(ot('', 'BACKPACK').el)
  const slotsRow = el('div', 'hud-slots')
  const slots = [I.rod, I.bat].map((svg, i) => {
    const s = el('div', 'hud-slot')
    s.append(ot('hud-slot-num', String(i + 1)).el, icon('hud-ico', svg))
    pressable(s, () => userEquip(i + 1))
    slotsRow.append(s)
    return s
  })
  pack.append(bar, slotsRow)

  // Bottom right: next event.
  const event = el('div', 'hud-block hud-event')
  const eventText = ot('hud-event-text', 'Next event in 30:00', true)
  event.append(eventText.el, icon('hud-scroll', I.scroll))

  const toastEl = el('div', 'hud-toast')

  root.append(earn, update, tiles, offer, fishTile, leftStack, pack, event, toastEl)
  document.body.appendChild(root)

  // --- State setters ------------------------------------------------------------
  function counter(text, dec, prefix) {
    return { text, dec, prefix, target: 0, shown: 0, key: -1, init: false }
  }
  const money = counter(cashNum, 1, '$')
  const trainedSpeed = counter(gemsNum, 1, '')
  function renderCounter(c) {
    const k = shortKey(c.shown, c.dec)
    if (k === c.key) return
    c.key = k
    c.text.set(c.prefix + formatShort(c.shown, c.dec))
  }
  function setCounter(c, n) {
    n = Math.max(0, +n || 0)
    if (!c.init) {
      c.init = true
      c.shown = n
    } else if (n > c.target && shortKey(n, c.dec) !== c.key) {
      c.text.el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
    }
    c.target = n
    renderCounter(c)
  }
  function stepCounter(c, dt) {
    if (c.shown === c.target) return
    const diff = c.target - c.shown
    c.shown += diff * Math.min(1, dt * 7)
    if (Math.abs(c.target - c.shown) < Math.max(0.5, Math.abs(c.target) * 2e-4)) c.shown = c.target
    renderCounter(c)
  }

  function setSlowMode(on) {
    slow = !!on
    toggle.classList.toggle('on', slow)
  }

  // Fish slots after the tools (3, 4, ...): [{ img, label, count }] from setBackpackFish.
  let fishSlots = []
  function setBackpackFish(items) {
    for (const s of fishSlots) s.remove()
    fishSlots = items.slice(0, 7).map((it, i) => {
      const n = i + 3
      const s = el('div', 'hud-slot hud-slot-fish')
      const img = document.createElement('img')
      img.className = 'hud-fish-img'
      img.alt = ''
      if (it.img) img.src = it.img
      s.append(ot('hud-slot-num', String(n)).el, img, ot('hud-slot-kg', it.label ?? '').el)
      if (it.count > 1) s.append(ot('hud-slot-count', `x${it.count}`).el)
      pressable(s, () => userEquip(n))
      slotsRow.append(s)
      return s
    })
    if (equipped > 2 && equipped - 3 >= fishSlots.length) setEquipped(null)
    else setEquipped(equipped)
    queueLayout()
  }

  let equipped = null
  // Replaces a tool slot's icon (1 = rod, 2 = bat) with a picture (data URL); '' restores the icon.
  function setSlotImage(n, src) {
    const s = slots[n - 1]
    if (!s) return
    let img = s.querySelector('.hud-tool-img')
    s.querySelector('.hud-ico').style.display = src ? 'none' : ''
    if (!src) return img?.remove()
    if (!img) {
      img = document.createElement('img')
      img.className = 'hud-tool-img'
      img.alt = ''
      img.draggable = false
      s.append(img)
    }
    if (img.src !== src) img.src = src
  }

  function setEquipped(n) {
    equipped = n >= 1 && n <= 2 + fishSlots.length ? n : null
    slots.forEach((s, i) => s.classList.toggle('sel', equipped === i + 1))
    fishSlots.forEach((s, i) => s.classList.toggle('sel', equipped === i + 3))
  }
  function userEquip(n) {
    setEquipped(equipped === n ? null : n)
    act('equip', equipped)
  }
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t && (t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) return
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
    if (m && +m[1] <= 2 + fishSlots.length) userEquip(+m[1])
  }
  window.addEventListener('keydown', onKey)

  let offerVisible = true
  function setOffer(o) {
    offerVisible = !!o
    offer.classList.toggle('hidden', !offerVisible)
    if (o) {
      offerPct.set(`${Math.round(o.percent ?? 0)}% Of Best`)
      offerName.set(String(o.name ?? ''))
      offerPriceText.set(formatMoney(o.price ?? 0, 1))
    }
    queueLayout()
  }

  // x2 Speed tile: the cash price, or the time left while the boost runs.
  function setSpeedBoost({ price, secondsLeft = 0 }) {
    if (secondsLeft > 0) {
      onlyLabel.set('ACTIVE')
      onlyPrice.set(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`)
    } else {
      onlyLabel.set(`${Math.round(SPEED_BOOST.duration / 60)} MIN`)
      onlyPrice.set(formatMoney(price, 1))
    }
  }

  // --- Countdowns -----------------------------------------------------------------
  let lastSec = -1
  function tickClock() {
    const now = Date.now() + clockOffset
    const sec = Math.floor(now / 1000)
    if (sec === lastSec) return
    lastSec = sec
    updateText.set(' IN ' + formatCountdown(Math.max(0, Math.ceil((updateAtMs - now) / 1000))))
    const left = eventPeriodS - (sec % eventPeriodS)
    eventText.set(`Next event in ${pad2(Math.floor(left / 3600))}:${pad2(Math.floor((left % 3600) / 60))}:${pad2(left % 60)}`)
  }
  // The server's schedule { eventEveryMs, updateAt, serverTime }: both countdowns follow its clock.
  function setSchedule(sc) {
    if (!sc) return
    if (Number.isFinite(sc.serverTime)) clockOffset = sc.serverTime - Date.now()
    if (sc.eventEveryMs >= 1000) eventPeriodS = Math.floor(sc.eventEveryMs / 1000)
    if (Number.isFinite(sc.updateAt)) updateAtMs = sc.updateAt
    lastSec = -1
    tickClock()
  }

  // --- Layout ---------------------------------------------------------------------
  const flow = [
    { el: pack, anchor: 'center', dir: 'up' },
    { el: event, anchor: 'right', dir: 'up' },
    { el: earn, anchor: 'center', dir: 'down', minScale: 0.72 },
    { el: offer, anchor: 'right', dir: 'down' },
    { el: update, anchor: 'left', dir: 'down' },
    { el: tiles, anchor: 'left', dir: 'down' },
    { el: fishTile, anchor: 'right', dir: 'down' },
    { el: leftStack, anchor: 'left', dir: 'up' },
  ]
  const DEFAULT_ORDER = flow.map((_, i) => i)
  const LAND_ORDER = [0, 1, 2, 3, 5, 4, 6, 7] // tiles before update
  let reserved = []
  let offerCache = null
  let layoutQueued = false

  function queueLayout() {
    if (layoutQueued) return
    layoutQueued = true
    requestAnimationFrame(layout)
  }

  function layout() {
    layoutQueued = false
    const vw = window.innerWidth
    const vh = window.innerHeight
    const touch = document.body.classList.contains('touch-ui')
    const mode = vh < 520 && vw > vh ? 'land' : vw < 760 || (vw < 1000 && vh > vw) ? 'port' : 'desk'
    let u
    if (mode === 'desk') u = Math.max(Math.min(vw / 1920, vh / 992), touch ? 0.5 : 0.36)
    else if (mode === 'port') u = Math.min(vw / 720, vh / 1250, 0.9)
    else u = Math.min(vh / 840, vw / 1800)
    root.dataset.mode = mode
    root.style.setProperty('--u', `${u.toFixed(4)}px`)

    // Write phase 1: back to the CSS positions. Transitions off while measuring and
    // moving (some blocks animate `transform` for their press bounce), or the read
    // below would catch them mid-way at their old spot and every re-layout (rotation,
    // panel toggles) would drift them further.
    root.classList.add('hud-measuring')
    for (const b of flow) b.el.style.transform = ''

    // Read phase (one forced layout).
    const cs = getComputedStyle(root)
    const B = {
      l: parseFloat(cs.paddingLeft) + 2,
      r: vw - parseFloat(cs.paddingRight) - 2,
      t: parseFloat(cs.paddingTop) + 2,
      b: vh - parseFloat(cs.paddingBottom) - 2,
    }
    const obs = []
    for (const a of reserved) {
      if (!(a.width > 0 && a.height > 0)) continue
      obs.push({ x: a.left, y: a.top, r: a.left + a.width, b: a.top + a.height })
    }
    if (touch) {
      for (const sel of ['.touch-top', '.touch-cluster', '.joy-base']) {
        const e = document.querySelector(sel)
        if (!e || e.classList.contains('active')) continue
        const r = e.getBoundingClientRect()
        if (r.width > 0) obs.push({ x: r.left, y: r.top, r: r.right, b: r.bottom })
      }
    }
    const rects = flow.map((b) => b.el.getBoundingClientRect())
    const box = offerBox.getBoundingClientRect()

    // Place in priority order; each placed block becomes an obstacle. On short
    // landscape screens the tiles go first so they get the spot beside the chat.
    const order = mode === 'land' ? LAND_ORDER : DEFAULT_ORDER
    const moves = new Array(flow.length)
    for (const i of order) {
      const b = flow[i]
      const r = rects[i]
      moves[i] = placeBlock(b, r)
    }
    function placeBlock(b, r) {
      if (r.width === 0) return null
      const spec = mode === 'land' && b.el === tiles ? { ...b, yMajor: true } : b
      let p = place({ x: r.left, y: r.top, w: r.width, h: r.height }, spec, obs, B)
      // Small screens (a 320 px phone, Boxity's fixed-size chat and the thumb
      // controls): no free spot at full size, so try the block a little smaller,
      // keeping its anchored edges where they were, before giving up and overlapping.
      for (const k of SHRINK) {
        if (!p.none) break
        const w = r.width * k
        const h = r.height * k
        const x = b.anchor === 'right' ? r.right - w : b.anchor === 'center' ? r.left + (r.width - w) / 2 : r.left
        const y = b.dir === 'up' ? r.bottom - h : r.top
        const q = place({ x, y, w, h }, spec, obs, B)
        if (!q.none) p = { ...q, s: q.s * k }
      }
      if (p.none) p = { x: r.left, y: r.top, s: 1 }
      obs.push({ x: p.x, y: p.y, r: p.x + r.width * p.s, b: p.y + r.height * p.s })
      return { dx: p.x - r.left, dy: p.y - r.top, s: p.s }
    }

    // Write phase 2.
    flow.forEach((b, i) => {
      const m = moves[i]
      if (!m || (Math.abs(m.dx) < 0.5 && Math.abs(m.dy) < 0.5 && m.s === 1)) return
      b.el.style.transform = `translate(${m.dx.toFixed(1)}px, ${m.dy.toFixed(1)}px)${m.s < 1 ? ` scale(${m.s.toFixed(3)})` : ''}`
    })
    void root.offsetWidth // commit the new transforms before transitions come back
    root.classList.remove('hud-measuring')
    const om = moves[flow.findIndex((b) => b.el === offer)]
    offerCache = offerVisible && om && box.width > 0 ? new DOMRect(box.left + om.dx, box.top + om.dy, box.width, box.height) : null
  }

  const offReserved = onReservedAreas((areas) => {
    reserved = areas
    queueLayout()
  })
  window.addEventListener('resize', queueLayout)
  window.visualViewport?.addEventListener('resize', queueLayout)
  const bodyWatch = new MutationObserver(queueLayout) // touch-ui toggles
  bodyWatch.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  document.fonts?.ready?.then(queueLayout)
  document.fonts?.addEventListener?.('loadingdone', queueLayout)

  // --- Toast ----------------------------------------------------------------------
  let toastAnim = null
  function toast(msg) {
    toastEl.textContent = String(msg)
    toastAnim?.cancel()
    toastAnim = toastEl.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 12px) scale(0.9)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.1 },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.75 },
        { opacity: 0, transform: 'translate(-50%, -10px) scale(1)' },
      ],
      { duration: 2000, easing: 'ease-out' },
    )
  }

  // Defaults (the game overrides them).
  setOffer({ percent: 135, name: 'Rainbow Mosasaur', price: 115 })
  setOfflinePerDay(0)
  setEquipped(null)
  tickClock()
  layout()

  function setOfflinePerDay(n) {
    earnAmount.set(formatMoney(n, 2))
  }
  function setMoney(n) {
    setCounter(money, n)
  }
  // Trained speed as shown (stat x SPEED.display); counts up with a pop on a gain.
  function setTrainedSpeed(n) {
    setCounter(trainedSpeed, n)
  }
  // The speed multiplier (trail x boost), already formatted (speed.js formatMult); bump = a small pop on a gain.
  function setSpeedMult(text, bump = false) {
    speedNum.set(text)
    if (bump) speedRow.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' })
  }

  return {
    setMoney,
    setTrainedSpeed,
    setSpeedMult,
    setOfflinePerDay,
    setOffer,
    setSpeedBoost,
    setSchedule,
    setSlowMode,
    setEquipped,
    setSlotImage,
    setBackpackFish,
    toast,
    // DOMRect (CSS px) of the empty model box in the offer card, or null if hidden.
    offerRect: () => (offerVisible ? offerCache : null),
    // The (empty) model box element. A <canvas> appended to it is stretched to
    // fill it, above the ray burst and under the sparkles (see hud.css).
    offerBox: () => offerBox,
    root,
    update(dt = 1 / 60) {
      tickClock()
      stepCounter(money, dt)
      stepCounter(trainedSpeed, dt)
    },
    layout: queueLayout,
    dispose() {
      offReserved?.()
      window.removeEventListener('resize', queueLayout)
      window.visualViewport?.removeEventListener('resize', queueLayout)
      window.removeEventListener('keydown', onKey)
      bodyWatch.disconnect()
      root.remove()
    },
  }
}

// Shared with the lane HUD (laneHud.js): element, outlined text and press helpers.
export { el, ot, pressable }
