// The Sell Fish window: the backpack's fish as cards (weight, $/s, sell value), sorted
// by Weight or Value (press the lit sort again to flip it), picked one by one or with
// Select All; Sell turns the picked fish into money. Only fish the player is carrying
// (the backpack fish in the hotbar) are listed or sold; pool and plot fish stay out. Opened by the SELL FISH stall's pad (main.js,
// hub.onPad); Esc, the X or a tap outside closes it. Styles in sellFish.css, sounds in
// audio/sfx.js.
import './sellFish.css'
import { FISH } from './config.js'
import { formatEarn } from './hub/fish.js'
import { fishThumb } from './fishThumbs.js'
import { fishValue, inventory, isCarried, sellFish, subscribe } from './inventory.js'
import { isEquipped, onEquipChange } from './activeFish.js'
import { sfx } from './audio/index.js'

// --- Icons ----------------------------------------------------------------------------------
const FISH_ICON = `<svg viewBox="0 0 120 72" aria-hidden="true">
  <g stroke="#0d2350" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 36 L6 14 Q12 36 6 58 Z" fill="#2f7fe8"/>
    <path d="M52 14 Q64 2 80 8 L70 20 Z" fill="#2f7fe8"/>
    <path d="M24 36 Q46 8 82 10 Q110 14 116 36 Q110 58 82 62 Q46 64 24 36 Z" fill="#3aa2ff"/>
  </g>
  <path d="M30 38 Q52 58 84 58 Q104 56 112 42 Q90 50 62 46 Q44 44 30 38 Z" fill="#e8f4ff"/>
  <path d="M40 26 Q60 14 84 16" stroke="#9fd6ff" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M60 38 L74 48 L58 50 Z" fill="#2f7fe8" stroke="#0d2350" stroke-width="4" stroke-linejoin="round"/>
  <path d="M24 36 Q46 8 82 10 Q110 14 116 36 Q110 58 82 62 Q46 64 24 36 Z" fill="none" stroke="#0d2350" stroke-width="5" stroke-linejoin="round"/>
  <circle cx="96" cy="30" r="6.5" fill="#fff" stroke="#0d2350" stroke-width="3"/>
  <circle cx="97.5" cy="30" r="3" fill="#0d2350"/>
</svg>`

const CASH_ICON = `<svg viewBox="0 0 80 64" aria-hidden="true">
  <g stroke="#123a10" stroke-width="4" stroke-linejoin="round">
    <path d="M6 40 L40 24 L74 38 L40 56 Z" fill="#3fae2a"/>
    <path d="M6 40 L6 46 L40 62 L74 44 L74 38 L40 56 Z" fill="#2a8a1c"/>
    <path d="M6 30 L40 14 L74 28 L40 46 Z" fill="#52c836"/>
    <path d="M6 30 L6 36 L40 52 L74 34 L74 28 L40 46 Z" fill="#2f9a20"/>
    <path d="M6 20 L40 4 L74 18 L40 36 Z" fill="#7be04e"/>
    <path d="M6 20 L6 26 L40 42 L74 24 L74 18 L40 36 Z" fill="#38a826"/>
  </g>
  <ellipse cx="40" cy="20" rx="11" ry="6" fill="none" stroke="#2f8a1e" stroke-width="3.5"/>
  <path d="M14 21 L24 16" stroke="#c8ffa8" stroke-width="3" stroke-linecap="round"/>
</svg>`

const ARROW_ICON = `<svg viewBox="0 0 40 48" aria-hidden="true">
  <path d="M20 6 V40 M6 26 L20 40 L34 26" fill="none" stroke="#1b1b22" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 6 V40 M6 26 L20 40 L34 26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const CHECK_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="20" fill="#3fc21a" stroke="#1b1b22" stroke-width="4"/>
  <circle cx="24" cy="24" r="16" fill="none" stroke="#fff" stroke-width="3.5"/>
  <path d="M15 24.5 L21.5 31 L33.5 17.5" fill="none" stroke="#1b1b22" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 24.5 L21.5 31 L33.5 17.5" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const COIN_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffd21f" stroke="#1b1b2a" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ff9d00" stroke-width="2"/></svg>`

const fmtWeight = (kg) => `${+kg.toFixed(kg < 10 ? 2 : 1)}Kg`

// --- DOM ------------------------------------------------------------------------------------
const overlay = document.createElement('div')
overlay.className = 'sf-overlay'
overlay.hidden = true
overlay.innerHTML = `
  <div class="sf-win" role="dialog" aria-modal="true" aria-label="Sell Fish">
    <div class="sf-head">
      <div class="sf-titlebar">
        <span class="sf-ticon">${FISH_ICON}</span>
        <h2 class="sf-out">Sell Fish</h2>
      </div>
      <button type="button" class="sf-close" aria-label="Close"><span class="sf-out">X</span></button>
    </div>
    <div class="sf-main">
      <div class="sf-side">
        <div class="sf-sortby sf-out">Sort By:</div>
        <button type="button" class="sf-btn sf-sort" data-key="weight" aria-pressed="false"><span class="sf-ico sf-arrow">${ARROW_ICON}</span><span class="sf-out">Weight</span></button>
        <button type="button" class="sf-btn sf-sort" data-key="value" aria-pressed="true"><span class="sf-ico sf-arrow">${ARROW_ICON}</span><span class="sf-out">Value</span></button>
        <div class="sf-rule" role="separator"></div>
        <button type="button" class="sf-btn sf-all green"><span class="sf-ico sf-check">${CHECK_ICON}</span><span class="sf-out">Select All</span></button>
      </div>
      <div class="sf-gridwrap">
        <div class="sf-grid" role="listbox" aria-multiselectable="true" aria-label="Your fish"></div>
        <div class="sf-empty sf-out" hidden>No fish to sell!<small>Catch some fish and come back.</small></div>
      </div>
    </div>
    <div class="sf-foot">
      <span class="sf-total-label sf-out">Total Value:</span>
      <span class="sf-cash">${CASH_ICON}</span>
      <span class="sf-total sf-out">$0</span>
      <button type="button" class="sf-sell"><span class="sf-out">Sell</span></button>
    </div>
    <div class="sf-fx" aria-hidden="true"></div>
  </div>`
document.body.append(overlay)

const win = overlay.querySelector('.sf-win')
const grid = overlay.querySelector('.sf-grid')
const empty = overlay.querySelector('.sf-empty')
const totalEl = overlay.querySelector('.sf-total')
const sellBtn = overlay.querySelector('.sf-sell')
const allBtn = overlay.querySelector('.sf-all')
const sortBtns = [...overlay.querySelectorAll('.sf-sort')]
const fx = overlay.querySelector('.sf-fx')

// --- State ----------------------------------------------------------------------------------
const sort = { key: 'value', desc: true }
const picked = new Set() // uids
const cards = new Map() // uid -> card element
let shown = false

// The fish on offer: only what the player is carrying, i.e. exactly the backpack fish in the
// hotbar (main.js refreshHotbar uses the same rule). Fish in the pool (equipped) or stored on
// the plot are not theirs to sell here.
const sellable = () => inventory.fish.filter((f) => isCarried(f) && !isEquipped(f.uid))

function sorted() {
  const k = sort.key === 'weight' ? (f) => f.weight : fishValue
  const dir = sort.desc ? -1 : 1
  return sellable().sort((a, b) => (k(a) - k(b)) * dir || a.uid - b.uid)
}

function makeCard(f) {
  const sp = FISH[f.species]
  const c = document.createElement('button')
  c.type = 'button'
  c.className = 'sf-card'
  c.setAttribute('role', 'option')
  c.dataset.uid = f.uid
  c.setAttribute('aria-label', `${sp?.name ?? f.species}, ${fmtWeight(f.weight)}, ${formatEarn(fishValue(f))}`)
  c.innerHTML = `
    <span class="sf-kg sf-out">(${fmtWeight(f.weight)})</span>
    <span class="sf-pick" aria-hidden="true">${CHECK_ICON}</span>
    <img class="sf-pic" alt="" draggable="false">
    <span class="sf-earn sf-out">${formatEarn(f.earn)}/s</span>
    <span class="sf-price"><span class="sf-cash">${CASH_ICON}</span><span class="sf-out">${formatEarn(fishValue(f))}</span></span>`
  const url = sp ? fishThumb(f.species) : ''
  if (url) c.querySelector('.sf-pic').src = url
  return c
}

function render() {
  const list = sorted()
  const live = new Set(list.map((f) => f.uid))
  for (const [uid, el] of cards) {
    if (!live.has(uid)) {
      el.remove()
      cards.delete(uid)
      picked.delete(uid)
    }
  }
  for (const f of list) {
    let el = cards.get(f.uid)
    if (!el) cards.set(f.uid, (el = makeCard(f)))
    el.classList.toggle('picked', picked.has(f.uid))
    el.setAttribute('aria-selected', picked.has(f.uid))
    grid.append(el) // re-appending moves it into sorted order
  }
  empty.hidden = list.length > 0
  for (const b of sortBtns) {
    const on = b.dataset.key === sort.key
    b.classList.toggle('green', on)
    b.classList.toggle('asc', on && !sort.desc)
    b.setAttribute('aria-pressed', on)
  }
  allBtn.classList.toggle('all', list.length > 0 && picked.size === list.length)
  updateTotal()
}

// --- Total (counts to the new value) -----------------------------------------------------------
let shownTotal = 0
let tween = 0
function totalPicked() {
  let v = 0
  for (const f of sellable()) if (picked.has(f.uid)) v += fishValue(f)
  return v
}
function updateTotal(instant = false) {
  const target = totalPicked()
  sellBtn.classList.toggle('ready', target > 0)
  cancelAnimationFrame(tween)
  const from = shownTotal
  if (instant || from === target) {
    shownTotal = target
    totalEl.textContent = formatEarn(target)
    return
  }
  const t0 = performance.now()
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 260)
    shownTotal = from + (target - from) * (1 - (1 - k) ** 3)
    totalEl.textContent = formatEarn(k < 1 ? shownTotal : target)
    if (k < 1) tween = requestAnimationFrame(step)
    else shownTotal = target
  }
  tween = requestAnimationFrame(step)
  replay(totalEl, 'bump')
}

// Restarts a one-shot CSS animation class.
function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

const panOf = (el) => {
  const r = el.getBoundingClientRect()
  return Math.max(-0.6, Math.min(0.6, ((r.left + r.width / 2) / window.innerWidth - 0.5) * 1.2))
}

// --- Actions --------------------------------------------------------------------------------
grid.addEventListener('click', (e) => {
  const card = e.target.closest('.sf-card')
  if (!card || card.classList.contains('gone')) return
  const uid = Number(card.dataset.uid)
  const on = !picked.has(uid)
  if (on) picked.add(uid)
  else picked.delete(uid)
  sfx.select(on, panOf(card))
  render()
  replay(card, 'bump')
})

for (const b of sortBtns) {
  b.addEventListener('click', () => {
    if (sort.key === b.dataset.key) sort.desc = !sort.desc
    else {
      sort.key = b.dataset.key
      sort.desc = true
    }
    sfx.sort(!sort.desc)
    render()
    replay(b, 'bump')
    grid.scrollTop = 0
  })
}

allBtn.addEventListener('click', () => {
  replay(allBtn, 'bump')
  const list = sellable()
  if (!list.length) return sfx.deny()
  const all = picked.size === list.length
  picked.clear()
  if (!all) for (const f of list) picked.add(f.uid)
  sfx.selectAll(!all, list.length)
  render()
  if (!all) for (const el of cards.values()) replay(el, 'bump')
})

sellBtn.addEventListener('click', () => {
  // Re-check at the moment of sale: a picked fish may have been equipped or dropped since.
  const ok = new Set(sellable().map((f) => f.uid))
  const uids = [...picked].filter((uid) => ok.has(uid))
  if (!uids.length) {
    picked.clear()
    render()
    sfx.deny()
    replay(sellBtn, 'shake')
    return
  }
  // The picked cards pop away first, then the sale lands.
  for (const uid of uids) cards.get(uid)?.classList.add('gone')
  const { count, value } = sellFish(uids)
  sfx.sell(count, value)
  replay(sellBtn, 'bump')
  payout(value)
})

// Coins spray out of the Sell button and the take floats up.
function payout(value) {
  const wr = win.getBoundingClientRect()
  const br = sellBtn.getBoundingClientRect()
  const x = br.left + br.width / 2 - wr.left
  const y = br.top + br.height / 2 - wr.top
  const scale = wr.width / 940
  const plus = document.createElement('span')
  plus.className = 'sf-plus sf-out'
  plus.textContent = `+${formatEarn(value)}`
  plus.style.left = `${x}px`
  plus.style.top = `${y}px`
  plus.addEventListener('animationend', () => plus.remove())
  fx.append(plus)
  const n = matchMedia('(pointer: coarse)').matches ? 9 : 16
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span')
    c.className = 'sf-coin'
    c.innerHTML = COIN_ICON
    const size = (18 + Math.random() * 14) * scale
    c.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`
    fx.append(c)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const sp = (180 + Math.random() * 260) * scale
    const dx = Math.cos(a) * sp
    const dy = Math.sin(a) * sp
    c.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 260 * scale}px)) scale(0.8) rotate(${(Math.random() - 0.5) * 720}deg)`, opacity: 0 },
      ],
      { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => c.remove()
  }
}

// --- Open / close ---------------------------------------------------------------------------
let closing = 0
export function openSellFish() {
  if (shown) return
  shown = true
  sfx.windowOpen()
  clearTimeout(closing)
  overlay.classList.remove('closing')
  picked.clear()
  render()
  updateTotal(true)
  overlay.hidden = false
  replay(win, 'pop')
  let i = 0
  for (const el of cards.values()) el.style.setProperty('--i', Math.min(i++, 24))
  replay(grid, 'cascade')
  grid.scrollTop = 0
  document.exitPointerLock?.() // the cursor has to be free to press the buttons
}

export function closeSellFish() {
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

export const sellFishOpen = () => shown
export const toggleSellFish = () => (shown ? closeSellFish() : openSellFish())

overlay.querySelector('.sf-close').addEventListener('click', closeSellFish)
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === overlay) closeSellFish()
})

// Sold cards finish their exit before the grid closes the gap.
subscribe(() => {
  if (!shown) return
  setTimeout(render, 230)
  updateTotal()
})
// A fish equipped / unequipped elsewhere joins or leaves the list.
onEquipChange(() => shown && render())
