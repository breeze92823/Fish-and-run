// The Trails window: every trail (config TRAILS) as a card in one sideways-scrolling row,
// coloured by rarity, with its colour swatch and Speed multiplier. A trail you own shows
// Equip (or Unequip on the one you wear, which takes it off); one you don't shows its
// cash price, and pressing it buys and equips it. Opened by the TRAILS stall's pad
// (main.js, hub.onPad); Esc, the X or a tap outside closes it.
// Shares the window shell and card styles with the Fishing Rods window (rods.css);
// trails.css holds the differences (magenta header, the swatch ball).
import '../rods/rods.css'
import './trails.css'
import { TRAILS } from '../config.js'
import { formatMoney } from '../hud/hud.js'
import { inventory, subscribe } from '../inventory.js'
import { sfx } from '../audio/index.js'
import { buyTrail, equipTrail, equippedTrailId, isTrailOwned, onTrailsChange } from './state.js'

// Title icon: a little runner with a pink sparkly trail streaming behind.
const TRAIL_ICON = `<svg viewBox="0 0 100 88" aria-hidden="true">
  <path d="M6 52 Q4 36 18 32 Q24 20 38 26 Q48 20 56 30 L62 44 Q60 62 44 64 Q34 72 22 66 Q8 68 6 52 Z" fill="#ff5ab4" stroke="#111116" stroke-width="5" stroke-linejoin="round"/>
  <path d="M14 46 Q16 38 24 38 Q30 30 40 34" fill="none" stroke="#ffb4dc" stroke-width="5" stroke-linecap="round"/>
  <path d="M22 50 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z" fill="#fff" stroke="#111116" stroke-width="2"/>
  <path d="M44 40 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z" fill="#fff" stroke="#111116" stroke-width="1.6"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M70 34 L64 52 M64 52 L56 64 M64 52 L74 60 L72 72 M68 38 L58 42 M70 38 L82 32" stroke="#111116" stroke-width="12"/>
    <path d="M70 34 L64 52 M64 52 L56 64 M64 52 L74 60 L72 72 M68 38 L58 42 M70 38 L82 32" stroke="#ffd21a" stroke-width="6"/>
  </g>
  <circle cx="74" cy="20" r="10" fill="#ffd21a" stroke="#111116" stroke-width="5"/>
  <circle cx="77" cy="18" r="2" fill="#111116"/>
</svg>`

const COIN_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffd21f" stroke="#1b1b2a" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ff9d00" stroke-width="2"/></svg>`

const mult = (n) => `x${+n.toFixed(2)}`
// The swatch: the trail's colours as a diagonal gradient, top-left to bottom-right.
const ballFill = (stops) => `linear-gradient(135deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})`

// --- DOM ------------------------------------------------------------------------------------
const overlay = document.createElement('div')
overlay.className = 'rw-overlay tw'
overlay.hidden = true
overlay.innerHTML = `
  <div class="rw-win" role="dialog" aria-modal="true" aria-label="Trails">
    <div class="rw-head">
      <div class="rw-titlebar">
        <span class="rw-ticon">${TRAIL_ICON}</span>
        <h2 class="rw-out">Trails</h2>
      </div>
      <button type="button" class="rw-close" aria-label="Close"><span class="rw-out">X</span></button>
    </div>
    <div class="rw-body">
      <div class="rw-track" role="list" aria-label="Trails"></div>
    </div>
    <div class="rw-fx" aria-hidden="true"></div>
  </div>`
document.body.append(overlay)

const win = overlay.querySelector('.rw-win')
const track = overlay.querySelector('.rw-track')
const fx = overlay.querySelector('.rw-fx')

const cards = new Map() // id -> { el, btn, label }
for (const [i, t] of TRAILS.entries()) {
  const el = document.createElement('div')
  el.className = 'rw-card'
  el.dataset.rarity = t.rarity.toLowerCase()
  el.dataset.id = t.id
  el.setAttribute('role', 'listitem')
  el.style.setProperty('--i', i)
  el.innerHTML = `
    <div class="tw-ball"></div>
    <div class="rw-name rw-out"></div>
    <div class="rw-rar rw-out"></div>
    <div class="rw-stat rw-speed"><span class="rw-out"><b>${mult(t.speed)}</b> Speed</span></div>
    <div class="rw-act"><button type="button" class="rw-btn"><span class="rw-out"></span></button></div>`
  el.querySelector('.rw-name').textContent = t.name
  el.querySelector('.rw-rar').textContent = t.rarity
  el.querySelector('.tw-ball').style.background = ballFill(t.ball)
  const btn = el.querySelector('.rw-btn')
  btn.dataset.id = t.id
  track.append(el)
  cards.set(t.id, { el, btn, label: btn.querySelector('.rw-out') })
}

// --- State -> cards ----------------------------------------------------------------------------
let shown = false

function render() {
  const eq = equippedTrailId()
  for (const t of TRAILS) {
    const c = cards.get(t.id)
    let kind
    let text
    if (!isTrailOwned(t.id)) {
      kind = 'price'
      text = formatMoney(t.price)
    } else if (t.id === eq) {
      kind = 'unequip'
      text = 'Unequip'
    } else {
      kind = 'equip'
      text = 'Equip'
    }
    c.btn.className = `rw-btn ${kind}${kind === 'price' && inventory.money < t.price ? ' poor' : ''}`
    c.btn.dataset.kind = kind
    c.btn.setAttribute('aria-label', kind === 'price' ? `Buy ${t.name} for ${text}` : `${text} ${t.name}`)
    if (c.label.textContent !== text) c.label.textContent = text
    c.el.classList.toggle('equipped', t.id === eq)
  }
}

// --- Effects ---------------------------------------------------------------------------------
function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}
function float(btn, text, cls) {
  const wr = win.getBoundingClientRect()
  const br = btn.getBoundingClientRect()
  const e = document.createElement('span')
  e.className = `rw-float rw-out ${cls}`
  e.textContent = text
  e.style.left = `${br.left + br.width / 2 - wr.left}px`
  e.style.top = `${br.top - wr.top}px`
  e.addEventListener('animationend', () => e.remove())
  fx.append(e)
}
function coinBurst(btn) {
  const wr = win.getBoundingClientRect()
  const br = btn.getBoundingClientRect()
  const x = br.left + br.width / 2 - wr.left
  const y = br.top + br.height / 2 - wr.top
  const scale = wr.width / 1016
  const n = matchMedia('(pointer: coarse)').matches ? 8 : 14
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span')
    c.className = 'rw-coin'
    c.innerHTML = COIN_ICON
    const size = (18 + Math.random() * 14) * scale
    c.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`
    fx.append(c)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const sp = (160 + Math.random() * 220) * scale
    const dx = Math.cos(a) * sp
    const dy = Math.sin(a) * sp
    c.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 240 * scale}px)) scale(0.8) rotate(${(Math.random() - 0.5) * 720}deg)`, opacity: 0 },
      ],
      { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => c.remove()
  }
}

// --- Actions ---------------------------------------------------------------------------------
function press(btn) {
  const id = btn.dataset.id
  const kind = btn.dataset.kind
  const c = cards.get(id)
  if (kind === 'price') {
    const res = buyTrail(id)
    if (res === 'poor') {
      sfx.deny()
      replay(btn, 'shake')
      float(btn, 'Not enough cash!', 'bad')
      return
    }
    if (res !== 'ok') return
    sfx.rodBuy()
    coinBurst(btn)
    equipTrail(id)
    replay(c.el, 'bought')
    float(btn, 'Equipped!', 'good')
  } else if (kind === 'equip') {
    equipTrail(id)
    sfx.rodEquip(true)
  } else if (kind === 'unequip') {
    equipTrail(null)
    sfx.rodEquip(false)
  }
  replay(cards.get(id).btn, 'bump')
}

track.addEventListener('click', (e) => {
  const btn = e.target.closest('.rw-btn')
  if (btn && !dragMoved) press(btn)
})

// Mouse: drag the row sideways and turn the wheel into sideways scrolling. Touch scrolls natively.
let drag = null
let dragMoved = false
track.addEventListener('pointerdown', (e) => {
  dragMoved = false
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  drag = { x: e.clientX, left: track.scrollLeft, id: e.pointerId }
})
track.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  if (!dragMoved && Math.abs(dx) > 6) {
    dragMoved = true
    track.classList.add('dragging')
    try {
      track.setPointerCapture(e.pointerId)
    } catch {
      // Ignore.
    }
  }
  if (dragMoved) track.scrollLeft = drag.left - dx
})
const endDrag = () => {
  drag = null
  track.classList.remove('dragging')
  setTimeout(() => (dragMoved = false), 0) // swallow the click that ends a drag
}
track.addEventListener('pointerup', endDrag)
track.addEventListener('pointercancel', endDrag)
track.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    track.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 32 : 1), behavior: 'auto' })
  },
  { passive: false },
)

// --- Open / close ---------------------------------------------------------------------------
let closing = 0
export function openTrails() {
  if (shown) return
  shown = true
  sfx.windowOpen()
  clearTimeout(closing)
  overlay.classList.remove('closing')
  render()
  overlay.hidden = false
  replay(win, 'pop')
  replay(track, 'cascade')
  document.exitPointerLock?.() // the cursor has to be free to press the buttons
}

export function closeTrails() {
  if (!shown) return false
  shown = false
  sfx.windowClose()
  overlay.classList.add('closing')
  closing = setTimeout(() => {
    overlay.hidden = true
    overlay.classList.remove('closing')
  }, 170)
  return true
}

export const trailsOpen = () => shown
export const toggleTrails = () => (shown ? closeTrails() : openTrails())

overlay.querySelector('.rw-close').addEventListener('click', closeTrails)
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === overlay) closeTrails()
})
onTrailsChange(() => shown && render())
subscribe(() => shown && render()) // money changes flip the "can't afford" look
setInterval(() => shown && render(), 1000) // income ticks into inventory.money without an event
