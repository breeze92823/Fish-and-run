// Every button in the game, without wiring each one: a soft tick when the mouse moves onto
// something clickable and the chunky press (sfx.press) the moment it is pressed. Windows that
// already play their own sound for the result (buy, sell, open...) get both, like a real button
// you feel click before the thing happens. installUiSounds() once at boot.
//
// "Clickable" = a <button>, an element with role="button", a link, or anything styled with
// cursor: pointer; walking up from the target to the first such ancestor. Elements (or an
// ancestor) with data-sfx="off" stay silent (the reel catcher and the touch Jump button, which
// make their own sounds).
import { A, now, voice } from './core.js'
import { limit, PLASTIC } from './kit.js'
import { bubble, modal, tone, vary } from './synth.js'
import { press } from './sfx.js'

// Mouse onto a button: a tiny, bright plastic tick with a soft rising blip.
export function hover(pan = 0) {
  if (!limit('hover', 35) || !voice(0.08)) return
  const t = now()
  modal({ t, f: vary(2600, 0.04), modes: PLASTIC, gain: 0.045, bus: A.ui, pan })
  tone({ t, f: 1500, f2: 1900, d: 0.035, a: 0.002, gain: 0.018, bus: A.ui, pan })
}

// A toast message popping up: a soft bubble pop.
export function toastPop() {
  if (!limit('toast', 150) || !voice(0.15)) return
  const t = now()
  bubble({ t, f: vary(680, 0.05), d: 0.06, gain: 0.12, rise: 0.8, bus: A.ui })
  modal({ t: t + 0.02, f: vary(1900, 0.03), modes: PLASTIC, gain: 0.04, bus: A.ui })
}

const MAX_DEPTH = 6
function clickable(node) {
  for (let e = node, i = 0; e && e !== document.body && i < MAX_DEPTH; e = e.parentElement, i++) {
    if (!(e instanceof HTMLElement)) continue
    if (e.dataset.sfx === 'off') return null
    if (e.tagName === 'BUTTON' || e.tagName === 'A' || e.getAttribute('role') === 'button') return e.matches(':disabled, [aria-disabled="true"]') ? null : e
    if (e.tagName === 'CANVAS') return null
    if (getComputedStyle(e).cursor === 'pointer') return e
  }
  return null
}
// Stereo position of an element: a button on the left of the screen clicks a little to the left.
const panOf = (e) => {
  const r = e.getBoundingClientRect()
  return Math.max(-1, Math.min(1, ((r.left + r.width / 2) / window.innerWidth) * 2 - 1)) * 0.35
}

let installed = false
export function installUiSounds() {
  if (installed) return
  installed = true
  let hovered = null
  // Hover is for mice only: a finger has no hover, and its emulated pointerover would double the press.
  window.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse' || document.pointerLockElement) return
      const b = clickable(e.target)
      if (b === hovered) return
      hovered = b
      if (b) hover(panOf(b))
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'pointerout',
    (e) => {
      if (!e.relatedTarget) hovered = null
    },
    { capture: true, passive: true },
  )
  // Capture phase: buttons stop the pointerdown from bubbling, but the window sees it first.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button > 0) return
      const b = clickable(e.target)
      if (b) press(panOf(b))
    },
    { capture: true, passive: true },
  )
}
