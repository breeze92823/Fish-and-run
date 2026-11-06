// The Fishing Rods window: every rod (config RODS) as a card in one sideways-scrolling
// row, coloured by rarity, with its 3D model, Luck and Catch Speed. A rod you own shows
// Equip (or Unequip on the one in hand, which goes back to the starter rod); one you
// don't shows its cash price, and pressing it buys and equips it. Opened by the FISHING
// RODS stall's pad (main.js, hub.onPad); Esc, the X or a tap outside closes it.
// Styles in rods.css, sounds in audio/sfx.js.
import './rods.css'
import { RODS } from '../config.js'
import { formatMoney } from '../hud/hud.js'
import { inventory, subscribe } from '../inventory.js'
import { sfx } from '../audio/index.js'
import { buyRod, equipRod, equippedRodId, isOwned, onRodsChange, startRodId } from './state.js'
import { rodThumb } from './thumbs.js'

// Title icon: a bent rod with a reel and a hook on the line.
const ROD_ICON = `<svg viewBox="0 0 100 88" aria-hidden="true">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 80 L58 22 Q70 8 82 10 Q90 12 88 26 L84 50" stroke="#111116" stroke-width="14"/>
    <path d="M12 80 L58 22 Q70 8 82 10 Q90 12 88 26 L84 50" stroke="#c0682a" stroke-width="7"/>
    <path d="M14 77 L28 60" stroke="#6a3416" stroke-width="7"/>
    <path d="M60 22 Q70 12 80 13" stroke="#e8a060" stroke-width="2.5"/>
    <path d="M84 50 L84 64 Q84 74 76 74 Q70 74 70 68" stroke="#111116" stroke-width="9"/>
    <path d="M84 50 L84 64 Q84 74 76 74 Q70 74 70 68" stroke="#c9ced8" stroke-width="4"/>
  </g>
  <circle cx="34" cy="62" r="11" fill="#c9ced8" stroke="#111116" stroke-width="5"/>
  <circle cx="34" cy="62" r="4" fill="#7a8290"/>
  <path d="M34 62 L44 70" stroke="#111116" stroke-width="5" stroke-linecap="round"/>
</svg>`

const COIN_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffd21f" stroke="#1b1b2a" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ff9d00" stroke-width="2"/></svg>`

const mult = (n) => `x${+n.toFixed(2)}`

// --- DOM ------------------------------------------------------------------------------------
const overlay = document.createElement('div')
overlay.className = 'rw-overlay'
overlay.hidden = true
overlay.innerHTML = `
  <div class="rw-win" role="dialog" aria-modal="true" aria-label="Fishing Rods">
    <div class="rw-head">
      <div class="rw-titlebar">
        <span class="rw-ticon">${ROD_ICON}</span>
        <h2 class="rw-out">Fishing Rods</h2>
      </div>
      <button type="button" class="rw-close" aria-label="Close"><span class="rw-out">X</span></button>
    </div>
    <div class="rw-body">
      <div class="rw-track" role="list" aria-label="Fishing rods"></div>
    </div>
    <div class="rw-fx" aria-hidden="true"></div>
  </div>`
document.body.append(overlay)

const win = overlay.querySelector('.rw-win')
const track = overlay.querySelector('.rw-track')
const fx = overlay.querySelector('.rw-fx')

const cards = new Map() // id -> { el, pic, btn, label }
for (const [i, r] of RODS.entries()) {
  const el = document.createElement('div')
  el.className = 'rw-card'
  el.dataset.rarity = r.rarity.toLowerCase()
  el.dataset.id = r.id
  el.setAttribute('role', 'listitem')
  el.style.setProperty('--i', i)
  el.innerHTML = `
    <img class="rw-pic" alt="" draggable="false">
    <div class="rw-name rw-out"></div>
    <div class="rw-rar rw-out"></div>
    <div class="rw-stat rw-luck"><span class="rw-out"><b>${mult(r.luck)}</b> Luck</span></div>
    <div class="rw-stat rw-speed"><span class="rw-out"><b>${mult(r.speed)}</b> Catch Speed</span></div>
    <div class="rw-act"><button type="button" class="rw-btn"><span class="rw-out"></span></button></div>`
  el.querySelector('.rw-name').textContent = r.name
  el.querySelector('.rw-rar').textContent = r.rarity
  const btn = el.querySelector('.rw-btn')
  btn.dataset.id = r.id
  track.append(el)
  cards.set(r.id, { el, pic: el.querySelector('.rw-pic'), btn, label: btn.querySelector('.rw-out') })
}

// --- State -> cards ----------------------------------------------------------------------------
let shown = false

function render() {
  const eq = equippedRodId()
  for (const r of RODS) {
    const c = cards.get(r.id)
    let kind
    let text
    if (!isOwned(r.id)) {
      kind = 'price'
      text = formatMoney(r.price)
    } else if (r.id === eq) {
      kind = 'unequip'
      text = 'Unequip'
    } else {
      kind = 'equip'
      text = 'Equip'
    }
    c.btn.className = `rw-btn ${kind}${kind === 'price' && inventory.money < r.price ? ' poor' : ''}`
    c.btn.dataset.kind = kind
    c.btn.setAttribute('aria-label', kind === 'price' ? `Buy ${r.name} for ${text}` : `${text} ${r.name}`)
    if (c.label.textContent !== text) c.label.textContent = text
    c.el.classList.toggle('equipped', r.id === eq)
  }
}

// Card pictures are rendered on first open, a couple per frame so the window opens at once.
let picsQueued = false
function loadPics() {
  if (picsQueued) return
  picsQueued = true
  const todo = RODS.map((r) => r.id)
  const step = () => {
    const t0 = performance.now()
    while (todo.length && performance.now() - t0 < 12) {
      const id = todo.shift()
      cards.get(id).pic.src = rodThumb(id)
    }
    if (todo.length) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
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
    const res = buyRod(id)
    if (res === 'poor') {
      sfx.deny()
      replay(btn, 'shake')
      float(btn, 'Not enough cash!', 'bad')
      return
    }
    if (res !== 'ok') return
    sfx.rodBuy()
    coinBurst(btn)
    equipRod(id)
    replay(c.el, 'bought')
    float(btn, 'Equipped!', 'good')
  } else if (kind === 'equip') {
    equipRod(id)
    sfx.rodEquip(true)
  } else if (kind === 'unequip') {
    if (id === startRodId) {
      sfx.deny()
      replay(btn, 'shake')
      float(btn, 'Your starter rod!', 'bad')
      return
    }
    equipRod(null)
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
export function openRods() {
  if (shown) return
  shown = true
  sfx.windowOpen()
  clearTimeout(closing)
  overlay.classList.remove('closing')
  render()
  overlay.hidden = false
  replay(win, 'pop')
  replay(track, 'cascade')
  loadPics()
  document.exitPointerLock?.() // the cursor has to be free to press the buttons
}

export function closeRods() {
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

export const rodsOpen = () => shown
export const toggleRods = () => (shown ? closeRods() : openRods())

overlay.querySelector('.rw-close').addEventListener('click', closeRods)
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === overlay) closeRods()
})
onRodsChange(() => shown && render())
subscribe(() => shown && render()) // money changes flip the "can't afford" look
setInterval(() => shown && render(), 1000) // income ticks into inventory.money without an event
