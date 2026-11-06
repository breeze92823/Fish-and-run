// Active Fish panel: opened by the HUD's Fish tile (hud.js -> toggleFishPanel()).
//   header  "3/7 Active"  "Total: $101/s"
//   list    one card per equipped fish, best first: picture, name, $/s, Unequip
//   buttons Equip Best | slots (more come from upgrading your base: hub/base.js)
//   ">"     red tab on its left edge that closes it
// It mounts itself on first use. While open, body has the class `fish-panel-open`
// (the HUD hides its Fish tile with it).
import './fishPanel.css'
import { activeCount, activeFish, equipBest, formatMoney, maxSlots, onEquipChange, state, totalEarn, unequip } from '../activeFish.js'
import { FISH } from '../config.js'
import { fishThumb } from '../fishThumbs.js'
import * as sound from '../audio/fishPanelSfx.js'

const CASCADE = 0.06 // s between cards popping in

let root = null
let els = null
let isOpen = false
const rows = new Map() // uid -> card element

function el(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function restart(node, cls) {
  node.classList.remove(cls)
  void node.offsetWidth // reflow so the animation plays again
  node.classList.add(cls)
}

export function mountFishPanel() {
  if (root) return root
  root = el('div', 'fp-root')
  const wrap = el('div', 'fp-wrap')
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-label', 'Active fish')

  const close = el('button', 'fp-close fp-txt', '>')
  close.type = 'button'
  close.setAttribute('aria-label', 'Close')
  close.addEventListener('click', () => closeFishPanel())

  const panel = el('div', 'fp-panel')
  const head = el('div', 'fp-head')
  const count = el('span', 'fp-count fp-txt')
  const total = el('span', 'fp-total fp-txt', 'Total: ')
  const totalVal = el('b', 'fp-txt')
  total.append(totalVal)
  head.append(count, total)
  const list = el('div', 'fp-list')
  const empty = el('div', 'fp-empty', 'No active fish. Tap Equip Best!')
  panel.append(head, list)

  const actions = el('div', 'fp-actions')
  const best = el('button', 'fp-btn fp-best fp-txt', 'Equip Best')
  best.type = 'button'
  best.addEventListener('click', onEquipBest)
  const slot = el('button', 'fp-btn fp-slot fp-txt')
  slot.type = 'button'
  slot.addEventListener('click', onBuySlot)
  actions.append(best, slot)

  wrap.append(close, panel, actions)
  root.append(wrap)
  document.body.append(root)
  els = { wrap, count, totalVal, list, empty, best, slot }

  // Keep the world from seeing presses / wheel on the panel.
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation())
  wrap.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
  window.addEventListener('keydown', (e) => {
    if (isOpen && e.code === 'Escape') {
      e.stopImmediatePropagation()
      closeFishPanel()
    }
  }, true)

  onEquipChange((reason) => render(reason))
  render()
  return root
}

// --- Rendering ------------------------------------------------------------------------------------
function makeRow(f) {
  const sp = FISH[f.species] ?? { name: f.species }
  const row = el('div', 'fp-row')
  const thumb = el('div', 'fp-thumb')
  const url = fishThumb(f.species)
  if (url) {
    const img = el('img')
    img.src = url
    img.alt = ''
    img.draggable = false
    thumb.append(img)
  }
  if (f.mutation === 'gold') thumb.append(el('span', 'fp-gold'))
  const info = el('div', 'fp-info')
  const name = el('div', 'fp-name fp-txt', sp.name)
  if (sp.name.length > 13) name.classList.add('long')
  const earn = el('div', 'fp-earn fp-txt', `${formatMoney(f.earn)}/s`)
  info.append(name, earn)
  const btn = el('button', 'fp-unequip fp-txt', 'Unequip')
  btn.type = 'button'
  btn.addEventListener('click', () => {
    if (!unequip(f.uid)) return
    sound.unequip()
  })
  row.append(thumb, info, btn)
  return row
}

function renderHeader() {
  els.count.textContent = `${activeCount()}/${state.slots} Active`
  els.totalVal.textContent = `${formatMoney(totalEarn())}/s`
  const max = state.slots >= maxSlots()
  if (!hintTimer) els.slot.textContent = max ? 'Max Slots' : 'More Slots'
  els.slot.classList.toggle('max', max)
}

function render(reason) {
  if (!els) return
  renderHeader()
  const fish = activeFish()
  const want = new Set(fish.map((f) => f.uid))

  // Cards whose fish left slide out, then go.
  for (const [uid, row] of rows) {
    if (want.has(uid)) continue
    rows.delete(uid)
    if (!isOpen) {
      row.remove()
      continue
    }
    row.classList.add('out')
    row.addEventListener('animationend', () => row.remove(), { once: true })
  }

  // New cards cascade in; all cards are put in best-first order.
  let fresh = 0
  let anchor = null
  for (const f of fish) {
    let row = rows.get(f.uid)
    if (!row) {
      row = makeRow(f)
      row.style.setProperty('--d', `${fresh++ * CASCADE}s`)
      rows.set(f.uid, row)
    }
    const next = anchor ? anchor.nextSibling : els.list.firstChild
    if (row !== next) els.list.insertBefore(row, next)
    anchor = row
  }

  const none = fish.length === 0
  if (none && !els.empty.isConnected) els.list.append(els.empty)
  if (!none) els.empty.remove()

  if (reason && reason !== 'sold') restart(els.count, reason === 'slot' ? 'gain' : 'bump')
  if (reason === 'equip-best' || reason === 'unequip') restart(els.totalVal, 'bump')
}

// --- Actions --------------------------------------------------------------------------------------
function onEquipBest() {
  const added = equipBest()
  sound.equipBest(added.length, CASCADE)
  if (!added.length) restart(els.best, 'bump')
}

// Slots come from the base level: the button says where to get more.
let hintTimer = 0
function onBuySlot() {
  if (state.slots >= maxSlots()) return restart(els.slot, 'bump')
  sound.deny()
  restart(els.slot, 'shake')
  els.slot.textContent = 'Upgrade your Base!'
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => {
    hintTimer = 0
    renderHeader()
  }, 1800)
}

// --- Open / close -----------------------------------------------------------------------------------
export function openFishPanel() {
  mountFishPanel()
  if (isOpen) return
  isOpen = true
  // Replay the card cascade each time it opens.
  let i = 0
  for (const row of els.list.querySelectorAll('.fp-row')) {
    row.style.setProperty('--d', `${0.12 + i++ * CASCADE}s`)
    restart(row, 'fp-row')
  }
  render()
  root.classList.add('open')
  document.body.classList.add('fish-panel-open')
  sound.open()
}

// Returns true if it was open (so Esc handlers can chain: closeFishPanel() || showMenu()).
export function closeFishPanel() {
  if (!isOpen) return false
  isOpen = false
  root.classList.remove('open')
  document.body.classList.remove('fish-panel-open')
  sound.close()
  return true
}

export function toggleFishPanel() {
  if (isOpen) closeFishPanel()
  else openFishPanel()
}

export const isFishPanelOpen = () => isOpen
