// The Index window (the fish collection), opened by the HUD's Index tile (main.js).
//   header   book + "Index", red X
//   left     one section per zone, scrolling: zone picture card | 4-wide grid of its fish
//            (unlocked: name + picture; locked: ??? + black silhouette; tinted by rarity)
//            and the zone's progress bar "2/8"; under it the "Unlocked: 3/88" bar
//   right    the picked fish (picture, name, rarity, $/s) and its Rewards (cash, gems)
//            with Claim! / Claimed! / Locked
// Esc, the X or a tap outside closes it. Data in fishIndex.js, styles in indexWindow.css.
import './indexWindow.css'
import { FISH } from '../config.js'
import { formatEarn } from '../hub/fish.js'
import { fishThumb } from '../fishThumbs.js'
import { allSpecies, canClaim, claim, indexZones, isClaimed, isUnlocked, onIndexChange, rewardOf, unlockedCount, zoneUnlocked } from '../fishIndex.js'
import { sfx } from '../audio/index.js'
import * as I from './icons.js'
import { zoneArt } from './zoneArt.js'

// Icons with their own gradient ids (the HUD's copies may be hidden).
const ids = (svg, pre) => svg.replace(/id="h(\w+)-(\w+)"/g, `id="${pre}$1-$2"`).replace(/url\(#h(\w+)-(\w+)\)/g, `url(#${pre}$1-$2)`)
const BOOK = (n) => ids(I.book, `ix${n}`)
const CASH = ids(I.cash, 'ixr')
const GEM = ids(I.shoe, 'ixr')
const COIN_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffd21f" stroke="#1b1b2a" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ff9d00" stroke-width="2"/></svg>`

// --- DOM ------------------------------------------------------------------------------------
function el(tag, cls, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const out = (cls, text) => {
  const e = el('span', `ix-out ${cls}`)
  e.textContent = text
  return e
}

const overlay = el('div', 'ix-overlay')
overlay.hidden = true
overlay.innerHTML = `
  <div class="ix-win" role="dialog" aria-modal="true" aria-label="Index">
    <div class="ix-head">
      <div class="ix-titlebar"><span class="ix-ticon">${BOOK(1)}</span><h2 class="ix-out">Index</h2></div>
      <button type="button" class="ix-close" aria-label="Close"><span class="ix-out">X</span></button>
    </div>
    <div class="ix-body">
      <div class="ix-left">
        <div class="ix-zones"></div>
        <div class="ix-unlock">
          <div class="ix-utrack"><div class="ix-ufill"></div><span class="ix-out ix-utext"></span></div>
          <span class="ix-ubook">${BOOK(2)}</span>
        </div>
      </div>
      <div class="ix-right">
        <div class="ix-detail">
          <img class="ix-dpic" alt="" draggable="false">
          <span class="ix-out ix-dname"></span>
          <span class="ix-out ix-drar"></span>
          <span class="ix-out ix-dearn"></span>
        </div>
        <div class="ix-rewards">
          <span class="ix-out ix-rtitle">Rewards:</span>
          <div class="ix-rtiles">
            <div class="ix-rtile"><span class="ix-rico ix-rcash">${CASH}</span><span class="ix-out ix-rcashv"></span></div>
            <div class="ix-rtile"><span class="ix-rico ix-rgem">${GEM}</span><span class="ix-out ix-rgemv"></span></div>
          </div>
          <button type="button" class="ix-claim"><span class="ix-out"></span></button>
        </div>
      </div>
    </div>
    <div class="ix-fx" aria-hidden="true"></div>
  </div>`
document.body.append(overlay)

const $ = (s) => overlay.querySelector(s)
const win = $('.ix-win')
const zonesEl = $('.ix-zones')
const ufill = $('.ix-ufill')
const utext = $('.ix-utext')
const detail = $('.ix-detail')
const dpic = $('.ix-dpic')
const dname = $('.ix-dname')
const drar = $('.ix-drar')
const dearn = $('.ix-dearn')
const rewardsEl = $('.ix-rewards')
const rcash = $('.ix-rcashv')
const rgem = $('.ix-rgemv')
const claimBtn = $('.ix-claim')
const claimText = claimBtn.firstElementChild
const fx = $('.ix-fx')

// Zone sections: { zone, bar fill, bar text, cells: Map(id -> cell) }.
const sections = indexZones.map((zone, zi) => {
  const sec = el('section', 'ix-zone')
  sec.setAttribute('aria-label', zone.name)
  const card = el('div', 'ix-zcard', zoneArt(zone, zi))
  card.append(out('ix-zname', zone.name))
  const main = el('div', 'ix-zmain')
  const grid = el('div', 'ix-grid')
  const cells = new Map()
  for (const id of zone.fish) {
    const sp = FISH[id]
    const c = el('button', `ix-cell r-${sp.rarity.toLowerCase()}`)
    c.type = 'button'
    c.dataset.id = id
    const name = out('ix-cname', '???')
    const pic = el('img', 'ix-cpic')
    pic.alt = ''
    pic.draggable = false
    c.append(name, pic, el('span', 'ix-badge', '<span class="ix-out">!</span>'))
    grid.append(c)
    cells.set(id, c)
  }
  const bar = el('div', 'ix-zbar')
  const fill = el('div', 'ix-zfill')
  const text = out('ix-ztext', '')
  bar.append(fill, text)
  main.append(grid, bar)
  sec.append(card, main)
  zonesEl.append(sec)
  return { zone, sec, fill, text, cells }
})

// --- State + render -------------------------------------------------------------------------
let shown = false
let picked = indexZones[0]?.fish[0] ?? null

const RARITY_NAME = (r) => r.charAt(0) + r.slice(1).toLowerCase()

function renderCell(id, c) {
  const on = isUnlocked(id)
  const sp = FISH[id]
  const name = c.firstElementChild
  const label = on ? sp.name : '???'
  if (name.textContent !== label) {
    name.textContent = label
    name.classList.toggle('long', label.length > 10)
    name.classList.toggle('xlong', label.length > 14)
    unfitted.add(c)
  }
  c.classList.toggle('locked', !on)
  c.classList.toggle('claim', canClaim(id))
  c.classList.toggle('sel', id === picked)
  c.setAttribute('aria-label', on ? `${sp.name}, ${RARITY_NAME(sp.rarity)}` : `Locked ${RARITY_NAME(sp.rarity)} fish`)
  c.setAttribute('aria-pressed', id === picked)
}

function renderDetail() {
  const id = picked
  const sp = id && FISH[id]
  detail.hidden = rewardsEl.hidden = !sp
  if (!sp) return
  const on = isUnlocked(id)
  const url = fishThumb(id)
  if (url && dpic.getAttribute('src') !== url) dpic.src = url
  detail.className = `ix-detail r-${sp.rarity.toLowerCase()}${on ? '' : ' locked'}`
  dname.textContent = on ? sp.name : '???'
  dname.classList.toggle('long', on && sp.name.length > 13)
  drar.textContent = RARITY_NAME(sp.rarity)
  dearn.textContent = on ? `${formatEarn(sp.earn)}/s` : '$???/s'
  const r = rewardOf(id)
  rcash.textContent = formatEarn(r.cash)
  rgem.textContent = `+${r.gems}`
  const state = !on ? 'locked' : isClaimed(id) ? 'claimed' : 'ready'
  claimBtn.dataset.state = state
  claimText.textContent = state === 'ready' ? 'Claim!' : state === 'claimed' ? 'Claimed!' : 'Locked'
  claimBtn.setAttribute('aria-disabled', state !== 'ready')
}

function render() {
  for (const s of sections) {
    for (const [id, c] of s.cells) renderCell(id, c)
    const n = zoneUnlocked(s.zone)
    const total = s.zone.fish.length
    s.fill.style.width = `${total ? (n / total) * 100 : 0}%`
    s.text.textContent = `${n}/${total}`
  }
  const n = unlockedCount()
  ufill.style.setProperty('--p', allSpecies.length ? n / allSpecies.length : 0)
  utext.textContent = `Unlocked: ${n}/${allSpecies.length}`
  renderDetail()
  if (shown) fitNames()
}

// Names wider than their cell are squeezed to fit (measured while the window shows; only
// names that changed, or all after a resize). Writes, then reads, then writes: one layout.
// The text's width comes from a Range, rescaled to layout px (the window may be mid pop-in).
const unfitted = new Set(sections.flatMap((s) => [...s.cells.values()]))
const range = document.createRange()
function fitNames() {
  if (!unfitted.size) return
  const list = [...unfitted]
  for (const c of list) c.firstElementChild.style.transform = ''
  const scales = list.map((c) => {
    const name = c.firstElementChild
    const box = name.getBoundingClientRect().width
    if (!box) return null
    range.selectNodeContents(name)
    const w = (range.getBoundingClientRect().width * name.offsetWidth) / box
    const max = c.clientWidth - 8
    return w > max ? max / w : 1
  })
  list.forEach((c, i) => {
    if (scales[i] == null) return
    unfitted.delete(c)
    if (scales[i] < 1) c.firstElementChild.style.transform = `scaleX(${scales[i].toFixed(3)})`
  })
}
window.addEventListener('resize', () => {
  for (const s of sections) for (const c of s.cells.values()) unfitted.add(c)
  if (shown) requestAnimationFrame(fitNames)
})

// Fish pictures cost ~0.1 s each the first time (the voxel model is built), so the cards get
// theirs a few at a time while the window is open, the ones in view first.
const needPic = new Set(sections.flatMap((s) => [...s.cells.values()]))
const inView = new Set()
const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) inView.add(e.target)
      else inView.delete(e.target)
    }
  },
  { root: zonesEl, rootMargin: '150px 0px' },
)
for (const c of needPic) seen.observe(c)
let pumping = 0
function pumpPics() {
  pumping = 0
  if (!shown || !needPic.size) return
  const t0 = performance.now()
  // Cached pictures are free, so keep going until one frame's budget is spent.
  while (needPic.size && performance.now() - t0 < 10) {
    let c = null
    for (const v of inView) if (needPic.has(v)) {
      c = v
      break
    }
    if (!c) {
      if (!inView.size) break // the observer hasn't reported yet
      c = needPic.values().next().value
    }
    needPic.delete(c)
    seen.unobserve(c)
    inView.delete(c)
    const url = fishThumb(c.dataset.id)
    if (url) c.querySelector('.ix-cpic').src = url
  }
  pumping = requestAnimationFrame(pumpPics)
}

function replay(node, cls) {
  node.classList.remove(cls)
  void node.offsetWidth
  node.classList.add(cls)
}
const panOf = (node) => {
  const r = node.getBoundingClientRect()
  return Math.max(-0.6, Math.min(0.6, ((r.left + r.width / 2) / window.innerWidth - 0.5) * 1.2))
}

// --- Actions --------------------------------------------------------------------------------
zonesEl.addEventListener('click', (e) => {
  const c = e.target.closest('.ix-cell')
  if (!c) return
  picked = c.dataset.id
  sfx.select(true, panOf(c))
  render()
  replay(c, 'bump')
  replay(detail, 'bump')
})

claimBtn.addEventListener('click', () => {
  const r = picked && claim(picked)
  if (!r) {
    sfx.deny()
    replay(claimBtn, 'shake')
    return
  }
  sfx.sell(1, r.cash)
  replay(claimBtn, 'bump')
  payout(r)
})

// Coins spray out of the Claim button and the reward floats up.
function payout(r) {
  const wr = win.getBoundingClientRect()
  const br = claimBtn.getBoundingClientRect()
  const x = br.left + br.width / 2 - wr.left
  const y = br.top + br.height / 2 - wr.top
  const scale = wr.width / 1070
  const plus = out('ix-plus', `+${formatEarn(r.cash)}  +${r.gems}`)
  plus.style.left = `${x}px`
  plus.style.top = `${y}px`
  plus.addEventListener('animationend', () => plus.remove())
  fx.append(plus)
  const n = matchMedia('(pointer: coarse)').matches ? 8 : 14
  for (let i = 0; i < n; i++) {
    const c = el('span', 'ix-coin', COIN_ICON)
    const size = (18 + Math.random() * 14) * scale
    c.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`
    fx.append(c)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const sp = (160 + Math.random() * 220) * scale
    const dx = Math.cos(a) * sp
    const dy = Math.sin(a) * sp
    c.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 240 * scale}px)) scale(0.8) rotate(${(Math.random() - 0.5) * 720}deg)`, opacity: 0 },
      ],
      { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => c.remove()
  }
}

// --- Open / close ---------------------------------------------------------------------------
let closing = 0
export function openIndex() {
  if (shown) return
  shown = true
  sfx.windowOpen()
  clearTimeout(closing)
  overlay.classList.remove('closing')
  // Open on a fish with a reward waiting, else where it was left.
  const waiting = allSpecies.find(canClaim)
  if (waiting) picked = waiting
  overlay.hidden = false
  render()
  replay(win, 'pop')
  if (!pumping) pumping = requestAnimationFrame(pumpPics)
  const sel = sections.find((s) => s.cells.has(picked)) ?? sections[0]
  zonesEl.scrollTop = sel ? sel.sec.offsetTop - sections[0].sec.offsetTop : 0 // the list is the sections' offsetParent
  // Only the zone it opens on cascades in (restarting 80 card animations stalls the frame).
  if (sel) {
    for (const s of sections) if (s !== sel) s.sec.classList.remove('cascade')
    let i = 0
    for (const c of sel.cells.values()) c.style.setProperty('--i', i++)
    replay(sel.sec, 'cascade')
  }
  document.exitPointerLock?.() // the cursor has to be free to press the buttons
}

export function closeIndex() {
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

export const indexOpen = () => shown
export const toggleIndex = () => (shown ? closeIndex() : openIndex())

$('.ix-close').addEventListener('click', closeIndex)
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === overlay) closeIndex()
})
onIndexChange(() => shown && render())
