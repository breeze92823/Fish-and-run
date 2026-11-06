import './laneHud.css'
import { el, ot, pressable } from './hud.js'

// The lane's on-screen pieces, laid out on the HUD's --u grid (inside hud.root):
//  - zone banner ("FOREST") on a dark band, top centre, shown briefly on entering a zone,
//    with the zone's recommended speed under it (red while yours is lower)
//  - Cast button above the backpack (rod held, standing by a river)
//  - Swing button in the same spot (bat held out in the lane: bat.js)
//  - an action button in the same spot (setAction: the plot treadmill's Upgrade)
//  - Click Fast! bar: clicks so far, a fill growing out from the fish box, a Stop button
//  - RUN! (big red, top) when a fish is landed, and a red "Don't stop!" warning while chased
// createLaneHud(hudRoot, { onCast, onStop, onClick, onSwing }) -> controls below.
const FISH_SVG =
  '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M6 20c8-12 26-14 38-6l12-8v28l-12-8C32 34 14 32 6 20z" fill="#8a8f98" stroke="#3a3e46" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="18" r="2.5" fill="#222"/></svg>'

const BAT_SVG =
  '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 41l-3-3 3-4 4 3z" fill="#5a3a22" stroke="#1a0e06" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 36l22-26c3-3 7-3 9 0s1 6-2 8L13 39z" fill="#f2c27a" stroke="#1a0e06" stroke-width="2.5" stroke-linejoin="round"/><path d="M33 12c2-1 4-1 5 1" fill="none" stroke="#fff6dc" stroke-width="2" stroke-linecap="round"/></svg>'

export function createLaneHud(hudRoot, { onCast, onStop, onClick, onSwing }) {
  const root = el('div', 'lane')

  // Zone banner
  const banner = el('div', 'lane-banner')
  const bannerText = ot('lane-banner-text', '', true)
  const bannerSub = ot('lane-banner-sub', '')
  banner.append(bannerText.el, bannerSub.el)

  // Cast button
  const cast = el('div', 'lane-cast')
  cast.append(ot('lane-cast-text', 'Cast').el)
  pressable(cast, () => onCast?.())

  // Swing button: fires on press (not release), so a swing lands the moment you tap.
  const swing = el('div', 'lane-swing')
  swing.setAttribute('role', 'button')
  swing.append(el('span', 'lane-swing-ico', BAT_SVG), ot('lane-swing-text', 'Swing').el)
  swing.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return
    e.preventDefault()
    e.stopPropagation()
    swing.classList.remove('hit')
    void swing.offsetWidth
    swing.classList.add('hit')
    onSwing?.()
  })

  // Action button (the plot treadmill's Upgrade): a title and a price, shown while near it.
  const act = el('div', 'lane-act')
  const actTitle = ot('lane-act-title', '')
  const actPrice = ot('lane-act-price', '')
  act.append(actTitle.el, actPrice.el)
  let onAct = null
  pressable(act, () => onAct?.())

  // Click Fast! bar
  const clicker = el('div', 'lane-clicker')
  const clickLabel = ot('lane-click-label', 'Click Fast! (0)')
  const track = el('div', 'lane-track')
  const fillL = el('div', 'lane-fill lane-fill-l')
  const fillR = el('div', 'lane-fill lane-fill-r')
  const fishBox = el('div', 'lane-fishbox')
  const fishPic = el('div', 'lane-fishpic', FISH_SVG)
  fishBox.append(fishPic, ot('lane-q', '?').el)
  track.append(fillL, fillR, fishBox)
  const stop = el('div', 'lane-stop')
  stop.append(ot('lane-stop-text', 'Stop').el)
  pressable(stop, () => onStop?.())
  const row = el('div', 'lane-row')
  row.append(track, stop)
  clicker.append(clickLabel.el, row)
  // While reeling, a click/tap anywhere (but Stop) counts: a full-screen catcher above
  // the canvas, so the click never grabs pointer lock or turns the camera.
  const catcher = el('div', 'lane-catcher')
  catcher.dataset.sfx = 'off' // each click plays the reel's own sound (sfx.reelClick)
  catcher.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  })

  // RUN! + warning
  const run = el('div', 'lane-run')
  run.append(ot('lane-run-text', 'RUN!').el)
  const warn = el('div', 'lane-warn')
  warn.append(ot('lane-warn-text', "Don't stop! Keep running to escape the guard!").el)

  root.append(catcher, banner, cast, swing, act, clicker, run, warn)
  hudRoot.appendChild(root)

  let bannerTimer = 0
  let runTimer = 0
  // The Cast button, bar and warning sit just above the backpack wherever the HUD's
  // layout put it (phones size the hotbar in px), re-measured twice a second.
  let measureIn = 0
  let lastBottom = -1
  function anchor() {
    const pack = hudRoot.querySelector('.hud-pack')
    if (!pack) return
    const bottom = Math.round(window.innerHeight - pack.getBoundingClientRect().top + 6)
    if (bottom !== lastBottom) {
      lastBottom = bottom
      root.style.setProperty('--lane-bottom', `${bottom}px`)
    }
  }
  const show = (e, on) => e.classList.toggle('on', on)

  return {
    // sub: an optional second line (the zone's recommended speed); low = shown in red.
    banner(text, colors, hold, fade, sub = '', low = false) {
      bannerText.set(text)
      bannerSub.set(sub)
      bannerSub.el.style.display = sub ? '' : 'none'
      bannerSub.el.classList.toggle('low', low)
      bannerText.el.style.setProperty('--g1', colors[0])
      bannerText.el.style.setProperty('--g2', colors[1])
      banner.style.setProperty('--fade', `${fade}s`)
      banner.classList.remove('on')
      void banner.offsetWidth // restart the pop-in animation
      banner.classList.add('on')
      bannerTimer = hold
    },
    showCast(on) {
      show(cast, on)
    },
    // The bat's Swing button; `cool` 0..1 = how much of the cooldown is left (dims it).
    showSwing(on, cool = 0) {
      show(swing, on)
      swing.style.setProperty('--cool', String(cool))
    },
    // a = { title, price, ok (affordable), fn } or null to hide.
    setAction(a) {
      onAct = a?.fn ?? null
      show(act, !!a)
      if (!a) return
      actTitle.set(a.title)
      actPrice.set(a.price)
      act.classList.toggle('poor', !a.ok)
    },
    showClicker(on) {
      show(clicker, on)
      show(catcher, on)
      if (on) this.setClicks(0, 0, false)
    },
    // progress 0..1 fills the bar; `hooked` swaps the ? for the fish silhouette.
    setClicks(count, progress, hooked) {
      clickLabel.set(`Click Fast! (${count})`)
      const p = String(Math.max(0, Math.min(1, progress)))
      fillL.style.setProperty('--p', p)
      fillR.style.setProperty('--p', p)
      fishPic.classList.toggle('on', hooked)
    },
    pulseClick() {
      const c = 'translate(-50%, -50%)'
      fishBox.animate([{ transform: `${c} scale(1)` }, { transform: `${c} scale(1.12)` }, { transform: `${c} scale(1)` }], { duration: 160, easing: 'ease-out' })
    },
    run(seconds = 2.4) {
      runTimer = seconds
      run.classList.remove('on')
      void run.offsetWidth
      run.classList.add('on')
    },
    warn(on) {
      show(warn, on)
    },
    update(dt) {
      measureIn -= dt
      if (measureIn <= 0) {
        measureIn = 0.5
        anchor()
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt
        if (bannerTimer <= 0) banner.classList.remove('on')
      }
      if (runTimer > 0) {
        runTimer -= dt
        if (runTimer <= 0) run.classList.remove('on')
      }
    },
  }
}
