import './bat.css'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Mesh, ShaderMaterial, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { BAT, FISH, FONT_FAMILY, RARITY } from './config.js'
import { player } from './player.js'
import * as sfx from './audio/batSfx.js'
import { shake } from './camera.js'
import { onKey } from './input.js'
import { net, onNetMessage, sendNet } from './net.js'
import { fishThumb } from './fishThumbs.js'
import { stepSwing } from './tools.js'
import { el, ot } from './hud/hud.js'

// The bat (hotbar slot 2): swing it at another player out in the lane to knock them flying and steal
// the fish they carry overhead. The hub (z >= 0) is a safe zone.
//
// Flow: click / tap Swing / F -> the swing animation and a whoosh; at the strike the nearest player in
// front (one carrying a fish first) is the target and `swing` { target } goes to the server, which
// checks the hit (backend bonk.ts) and tells the whole room `bonk` { by, to, x, z, fish, byName,
// toName }. The attacker's hit is predicted (sound, sparks, hit-stop, shake land at the strike); the
// victim flies (lane.bonked), drops the catch and answers `giveFish` { weight }; the attacker's
// lane.receiveFish makes it leap into their hands, and `gotFish` brings its real weight. Everyone
// nearby sees the swing (`swing` { id }), the impact, a comic BONK!, chat bubbles over both heads,
// dizzy stars over the victim and a line in the bonk feed.
//
// createBat(ctx) -> { swing(), update(dt), timeScale(dt) }
// ctx: { scene, fx, hud, laneHud, lane, remotes, playerGroup, canvas, getAnimator(), getSlot() }

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const FONT = `${FONT_FAMILY}, 'Arial Rounded MT Bold', sans-serif`
const HEAD = 2.2 // m: a head, above the feet

// --- Canvas pictures ------------------------------------------------------------------------------
function texture(canvas) {
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

// A comic-book impact word on a jagged starburst.
const wordCache = new Map()
function wordTexture(word) {
  if (wordCache.has(word)) return wordCache.get(word)
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 288
  const g = c.getContext('2d')
  const cx = 256
  const cy = 144
  const spikes = 14
  g.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2
    const r = i % 2 ? 0.62 + Math.random() * 0.08 : 1
    g.lineTo(cx + Math.cos(a) * 245 * r, cy + Math.sin(a) * 135 * r)
  }
  g.closePath()
  g.fillStyle = '#ffe23a'
  g.strokeStyle = '#1a0a02'
  g.lineWidth = 12
  g.lineJoin = 'round'
  g.stroke()
  g.fill()
  g.beginPath()
  g.ellipse(cx, cy, 170, 82, 0, 0, Math.PI * 2)
  g.fillStyle = '#ff7a1a'
  g.fill()
  let size = 104
  g.font = `700 ${size}px ${FONT}`
  while (g.measureText(word).width > 400 && size > 40) g.font = `700 ${(size -= 6)}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.translate(cx, cy + 6)
  g.rotate(-0.08)
  g.lineWidth = 22
  g.strokeStyle = '#1a0a02'
  g.strokeText(word, 0, 0)
  const grad = g.createLinearGradient(0, -size / 2, 0, size / 2)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.5, '#fff27a')
  grad.addColorStop(1, '#ffb81a')
  g.fillStyle = grad
  g.fillText(word, 0, 0)
  const t = { tex: texture(c), aspect: c.width / c.height }
  wordCache.set(word, t)
  return t
}

// A speech bubble: white rounded box, dark outline, a tail pointing down at the speaker.
function bubbleTexture(text, angry = false) {
  const c = document.createElement('canvas')
  const g = c.getContext('2d')
  const size = 56
  g.font = `600 ${size}px ${FONT}`
  const w = Math.ceil(g.measureText(text).width) + 64
  const h = 96
  c.width = w + 12
  c.height = h + 40
  const ctx = c.getContext('2d')
  ctx.font = `600 ${size}px ${FONT}`
  const x = 6
  const y = 6
  const r = 40
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.lineTo(x + w / 2 + 18, y + h)
  ctx.lineTo(x + w / 2 - 4, y + h + 28)
  ctx.lineTo(x + w / 2 - 16, y + h)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fillStyle = angry ? '#ffe8e4' : '#ffffff'
  ctx.strokeStyle = angry ? '#a01a10' : '#1a1c26'
  ctx.lineWidth = 8
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.fill()
  ctx.fillStyle = angry ? '#c0180c' : '#1a1c26'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2 + 3)
  return { tex: texture(c), aspect: c.width / c.height }
}

let starTex = null
function starTexture() {
  if (starTex) return starTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const r = i % 2 ? 12 : 28
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
  }
  g.closePath()
  g.fillStyle = '#ffe23a'
  g.strokeStyle = '#7a4a00'
  g.lineWidth = 4
  g.lineJoin = 'round'
  g.stroke()
  g.fill()
  return (starTex = texture(c))
}

function sprite(tex, height, aspect) {
  const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }))
  s.renderOrder = 20
  s.scale.set(height * aspect, height, 1)
  s.userData.h = height
  s.userData.aspect = aspect
  return s
}

// --- The swoosh: a bright arc swept in front of the swinger -------------------------------------
function swooshGeometry(seg = 28, r0 = 0.55, r1 = 2.1, arc = 2.5) {
  const pos = new Float32Array((seg + 1) * 2 * 3)
  const k = new Float32Array((seg + 1) * 2 * 2)
  const index = []
  for (let i = 0; i <= seg; i++) {
    const a = i / seg
    const th = -arc / 2 + a * arc // right side (-X, the bat hand) to the left
    for (let j = 0; j < 2; j++) {
      const r = j ? r1 : r0
      const v = i * 2 + j
      pos.set([Math.sin(th) * r, j * 0.35 - a * 0.25, Math.cos(th) * r], v * 3)
      k.set([a, j], v * 2)
    }
    if (i < seg) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('k', new BufferAttribute(k, 2))
  geo.setIndex(index)
  return geo
}
const swooshMaterial = () =>
  new ShaderMaterial({
    uniforms: { uHead: { value: 0 }, uFade: { value: 1 }, uColor: { value: new Color('#fff4c8') } },
    vertexShader: /* glsl */ `
      attribute vec2 k;
      varying vec2 vK;
      void main() { vK = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uHead;
      uniform float uFade;
      uniform vec3 uColor;
      varying vec2 vK;
      void main() {
        float tail = smoothstep(uHead - 0.7, uHead, vK.x) * step(vK.x, uHead);
        float edge = mix(0.25, 1.0, vK.y);
        float a = tail * edge * uFade;
        gl_FragColor = vec4(uColor * a * 2.6, min(1.0, a * 1.3));
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })

export function createBat(ctx) {
  const { scene, fx, hud, laneHud, lane, remotes, playerGroup } = ctx
  const anim = () => ctx.getAnimator()

  // --- World effects: each { obj, t, life, step(e, dt) -> false when done } ---
  const effects = []
  function addEffect(obj, life, step) {
    scene.add(obj)
    effects.push({ obj, t: 0, life, step })
  }
  function dropEffect(e) {
    scene.remove(e.obj)
    e.obj.traverse((o) => {
      if (o.userData.ownTex) o.material.map?.dispose()
      o.material?.dispose()
    })
  }

  // This player's id in the room ('me' offline, so the dev simulate hook works without a server).
  const myId = () => net.sessionId ?? 'me'
  // Where a player stands, as drawn: you, or a remote (null once they are gone / hidden).
  const posOf = (id) => {
    if (id === myId()) return player.renderPosition
    const r = remotes.get(id)
    return r?.group.visible ? r.group.position : null
  }
  const yawOf = (id) => (id === myId() ? player.facing : remotes.get(id)?.group.rotation.y ?? 0)
  // 0..1 loudness of something `d` m away (1 within 6 m, silent past 60 m).
  const nearness = (pos) => (pos ? Math.max(0, Math.min(1, 1 - (Math.hypot(pos.x - player.renderPosition.x, pos.z - player.renderPosition.z) - 6) / 54)) : 0)

  // Swoosh pool.
  const swooshGeo = swooshGeometry()
  const swooshes = Array.from({ length: 4 }, () => {
    const m = new Mesh(swooshGeo, swooshMaterial())
    m.visible = false
    m.frustumCulled = false
    m.renderOrder = 6
    scene.add(m)
    return { m, t: 1 }
  })
  let swooshNext = 0
  function swoosh(pos, yaw) {
    const s = swooshes[swooshNext]
    swooshNext = (swooshNext + 1) % swooshes.length
    s.m.position.set(pos.x, pos.y + 1.05, pos.z)
    s.m.rotation.set(0, yaw, 0.12)
    s.t = 0
    s.m.visible = true
  }
  const pending = [] // swooshes waiting for a remote's wind-up: { at, id }
  // Game-time callbacks (hit-stop and dev pause slow them like everything else): { at, fn }.
  const timers = []
  const later = (seconds, fn) => timers.push({ at: seconds, fn })

  // The comic word popping out of an impact.
  function comicWord(word, pos) {
    const { tex, aspect } = wordTexture(word)
    const s = sprite(tex, 1.5, aspect)
    s.position.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + HEAD + 0.6, pos.z)
    s.material.rotation = (Math.random() - 0.5) * 0.35
    const y0 = s.position.y
    addEffect(s, 1.0, (e) => {
      const k = e.t / e.life
      const pop = k < 0.12 ? (k / 0.12) * 1.35 : k < 0.22 ? 1.35 - ((k - 0.12) / 0.1) * 0.35 : 1
      s.scale.set(s.userData.h * s.userData.aspect * pop, s.userData.h * pop, 1)
      s.position.y = y0 + k * 0.9
      s.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
    })
  }

  // A chat bubble over a player's head (follows them; one per player, a new one replaces it).
  const bubbles = new Map() // id -> effect
  function say(id, text, { angry = false, delay = 0 } = {}) {
    setTimeout(() => {
      const old = bubbles.get(id)
      if (old) old.t = old.life
      const { tex, aspect } = bubbleTexture(text, angry)
      const s = sprite(tex, 0.62, aspect)
      s.userData.ownTex = true
      const e = { obj: s, t: 0, life: BAT.bubble, step: null }
      e.step = () => {
        const p = posOf(id)
        if (!p) return false
        const k = e.t / e.life
        const pop = k < 0.06 ? k / 0.06 : 1
        const wob = 1 + Math.sin(Math.min(1, e.t * 6) * Math.PI) * 0.12
        s.scale.set(s.userData.h * s.userData.aspect * pop * wob, s.userData.h * pop * wob, 1)
        s.position.set(p.x, p.y + HEAD + 1.15 + Math.sin(e.t * 3) * 0.04, p.z)
        s.material.opacity = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1
      }
      scene.add(s)
      effects.push(e)
      bubbles.set(id, e)
      sfx.batBubble(nearness(posOf(id)), angry)
    }, delay * 1000)
  }

  // Dizzy stars circling over the victim while they fly and lie there.
  function dizzy(id, seconds) {
    const tex = starTexture()
    for (let i = 0; i < 4; i++) {
      const s = sprite(tex, 0.34, 1)
      addEffect(s, seconds, (e) => {
        const p = posOf(id)
        if (!p) return false
        const a = e.t * 5 + (i / 4) * Math.PI * 2
        const k = e.t / e.life
        s.position.set(p.x + Math.cos(a) * 0.55, p.y + 0.9 + Math.sin(a * 2) * 0.08, p.z + Math.sin(a) * 0.55)
        s.material.opacity = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1
        s.material.rotation = e.t * 4
      })
    }
  }

  // The bonked player comes down: a thud (and, for someone else, a dust puff: your own landing
  // puffs in lane/index.js), then the dizzy birds tweet while they lie there.
  function landed(id) {
    const p = posOf(id)
    if (!p) return
    const near = nearness(p)
    sfx.batLand(near)
    sfx.batDizzy(near * 0.9, BAT.knock.lie)
    if (id !== myId()) fx.burst({ x: p.x, y: p.y + 0.2, z: p.z }, { kind: 'puff', count: 12, color: '#f0f8e0', speed: 2.5, up: 1, size: 0.8, grow: 2, life: 0.9, gravity: 0 })
  }

  // The hit itself, at the victim's position: sparks, stars, a dust puff, a shock ring, the word.
  function impact(pos, { near = 1, big = false, word = pick(BAT.bonks) } = {}) {
    const at = { x: pos.x, y: pos.y + 1.3, z: pos.z }
    fx.burst(at, { kind: 'spark', count: big ? 26 : 18, color: '#fff27a', speed: 7, up: 5, size: 0.55, life: 0.7, gravity: 8, drag: 2 })
    fx.burst(at, { kind: 'glow', count: 14, color: '#ffffff', speed: 5, up: 3, size: 0.5, life: 0.35, gravity: 0, drag: 4 })
    fx.burst(at, { kind: 'glow', count: 10, color: '#ff8a2a', speed: 3.5, up: 4, size: 0.4, life: 0.6, gravity: 6 })
    fx.burst({ x: pos.x, y: pos.y + 0.2, z: pos.z }, { kind: 'puff', count: 10, color: '#f4f0e0', speed: 2.5, up: 0.6, size: 0.9, grow: 2.2, life: 0.8, gravity: 0 })
    fx.ring({ x: pos.x, y: pos.y + 0.08, z: pos.z }, { size: 3.2, life: 0.5, color: '#ffe23a' })
    if (big) fx.burst(at, { kind: 'spark', count: 12, color: '#7af0ff', speed: 4, up: 6, size: 0.5, life: 1, gravity: 5 })
    comicWord(word, pos)
    sfx.batHit(near, 0, big)
  }

  // --- HUD: the centre pop-up, the red / gold screen flash, the bonk feed -----------------------
  const layer = el('div', 'bat')
  const flash = el('div', 'bat-flash')
  const pop = el('div', 'bat-pop')
  const popTitle = ot('bat-pop-title', '', true)
  const popRow = el('div', 'bat-pop-row')
  const popImg = el('img', 'bat-pop-img')
  popImg.alt = ''
  const popSub = el('div', 'bat-pop-sub')
  popRow.append(popImg, popSub)
  pop.append(popTitle.el, popRow)
  const feed = el('div', 'bat-feed')
  layer.append(flash, pop, feed)
  hud.root.appendChild(layer)

  let popTimer = null
  function popup(kind, title, html, fish = null) {
    pop.className = `bat-pop ${kind}`
    popTitle.set(title)
    popSub.innerHTML = html
    const img = fish ? fishThumb(fish) : ''
    popImg.style.display = img ? '' : 'none'
    if (img) popImg.src = img
    void pop.offsetWidth
    pop.classList.add('on')
    clearTimeout(popTimer)
    popTimer = setTimeout(() => pop.classList.remove('on'), kind === 'steal' ? 2600 : 1900)
  }
  function screenFlash(kind) {
    flash.className = `bat-flash ${kind}`
    void flash.offsetWidth
    flash.classList.add('on')
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const fishHtml = (id) => `<b style="color:${RARITY[FISH[id]?.rarity] ?? '#fff'}">${esc(FISH[id]?.name ?? 'fish')}</b>`
  function feedLine(m) {
    const me = myId()
    const by = m.by === me ? 'You' : esc(m.byName)
    const to = m.to === me ? 'you' : esc(m.toName)
    const line = el('div', `bat-feed-line${m.by === me || m.to === me ? ' mine' : ''}`)
    line.innerHTML = `<span class="bat-feed-by">${by}</span><span class="bat-feed-ico">\u{1F3CF}</span><span class="bat-feed-to">${to}</span>${m.fish ? ` <span class="bat-feed-fish">stole ${fishHtml(m.fish)}</span>` : ''}`
    feed.prepend(line)
    while (feed.children.length > BAT.feedMax) feed.lastChild.remove()
    setTimeout(() => {
      line.classList.add('out')
      setTimeout(() => line.remove(), 400)
    }, BAT.feedHold * 1000)
  }

  // --- Swinging -------------------------------------------------------------------------------------
  let cooldown = 0
  let swingT = -1
  let struck = false
  let stop = 0 // s of hit-stop left
  const immune = new Map() // sessionId -> ms until it can be hit again (as far as we know)
  let predicted = { id: '', at: 0 }
  let combo = 0
  let comboAt = 0
  let safeAt = 0

  function canSwingNow() {
    return ctx.getSlot() === 2 && lane.canSwing && !player.frozen && cooldown <= 0
  }

  function swing() {
    if (!canSwingNow()) return false
    cooldown = BAT.cooldown
    swingT = 0
    struck = false
    stepSwing(anim(), -1, 0, BAT.windup, BAT.swing)
    sfx.batWhoosh(1)
    return true
  }

  // The strike: pick the target, tell the server, and predict the hit so it lands right now.
  function strike() {
    const me = player.position
    const fwdX = Math.sin(player.facing)
    const fwdZ = Math.cos(player.facing)
    const now = performance.now()
    let best = null
    let safe = false
    remotes.forEachVisible((id, r) => {
      const g = r.group.position
      const dx = g.x - me.x
      const dz = g.z - me.z
      const d = Math.hypot(dx, dz)
      if (d > BAT.range || Math.abs(g.y - me.y) > 3) return
      const dot = d > 0.01 ? (dx * fwdX + dz * fwdZ) / d : 1
      if (dot < BAT.cone && d > BAT.range * 0.45) return // behind you, unless right next to you
      if (me.z >= 0 || g.z >= 0 || r.p.z >= 0) return void (safe = true)
      if (r.p.knocked || (immune.get(id) ?? 0) > now) return
      const score = d - dot - (r.p.hold ? 3 : 0) // a fish carrier first
      if (!best || score < best.score) best = { id, r, score, dx, dz, hold: !!r.p.hold }
    })
    swoosh(player.renderPosition, player.facing)
    sendNet('swing', best ? { target: best.id } : {})
    if (best) {
      player.facing = Math.atan2(best.dx, best.dz) // square up to them
      immune.set(best.id, now + BAT.immune * 1000)
      predicted = { id: best.id, at: now }
      impact(best.r.group.position, { big: best.hold })
      stop = BAT.hitStop
      shake(BAT.shake.hit)
      screenFlash('hit')
    } else if (safe && now - safeAt > 1500) {
      safeAt = now
      sfx.batSafe()
      hud.toast('\u{1F6E1}️ No bonking in the hub, it\'s a safe zone!')
    }
  }

  // --- The room's messages -------------------------------------------------------------------------
  function onSwing(m) {
    const r = remotes.get(m?.id)
    if (!r?.group.visible) return
    r.swing()
    sfx.batWhoosh(nearness(r.group.position) * 0.8)
    pending.push({ at: BAT.windup, id: m.id })
  }
  onNetMessage('swing', onSwing)

  function onBonk(m) {
    if (!m || typeof m.to !== 'string') return
    const me = myId()
    const now = performance.now()
    immune.set(m.to, now + BAT.immune * 1000)
    feedLine(m)
    const fish = FISH[m.fish] ? m.fish : ''
    const lie = BAT.knock.flight + BAT.knock.lie
    dizzy(m.to, lie + 0.3)
    later(BAT.knock.flight, () => landed(m.to))

    if (m.to === me) {
      // You got bonked.
      const lost = lane.bonked(+m.x || 0, +m.z || 1)
      if (lost && fish) sendNet('giveFish', { weight: lost.weight })
      impact(player.renderPosition, { big: !!lost, word: 'BONK!' })
      sfx.batBonked(!!lost)
      stop = BAT.hitStop
      shake(BAT.shake.bonked)
      screenFlash('hurt')
      popup('hurt', 'BONKED!', lost ? `<b>${esc(m.byName)}</b> stole your ${fishHtml(lost.species)}!` : `<b>${esc(m.byName)}</b> bonked you!`)
      say(me, pick(BAT.ouch), { angry: true, delay: 0.35 })
      say(m.by, fish ? pick(BAT.taunts) : pick(BAT.bonks))
      return
    }

    const pos = posOf(m.to)
    if (m.by === me) {
      // Your hit, confirmed: the impact already played at the strike (unless it wasn't predicted).
      if (!(predicted.id === m.to && now - predicted.at < 1500) && pos) impact(pos, { big: !!fish })
      predicted = { id: '', at: 0 }
      if (fish && lane.receiveFish(fish, { x: pos?.x ?? player.position.x, y: (pos?.y ?? 0) + 2.4, z: pos?.z ?? player.position.z })) {
        sfx.batSteal()
        laneHud.run()
        screenFlash('steal')
        popup('steal', 'STOLEN!', `${fishHtml(fish)} from <b>${esc(m.toName)}</b><br><span class="bat-pop-hint">Run it home!</span>`, fish)
        say(me, pick(BAT.taunts))
      } else {
        combo = now - comboAt < 6000 ? combo + 1 : 1
        comboAt = now
        popup('hit', combo > 1 ? `BONK! x${combo}` : 'BONK!', `You bonked <b>${esc(m.toName)}</b>!`)
        say(me, pick(BAT.bonks))
      }
      say(m.to, pick(BAT.ouch), { angry: true, delay: 0.35 })
      return
    }

    // Someone else's hit.
    if (pos) impact(pos, { near: nearness(pos), big: !!fish })
    say(m.by, fish ? pick(BAT.taunts) : pick(BAT.bonks))
    say(m.to, pick(BAT.ouch), { angry: true, delay: 0.35 })
    if (fish && pos) flyFish(fish, pos, m.by) // the catch arcs over to the thief
  }
  onNetMessage('bonk', onBonk)

  // The real weight of the fish you stole.
  onNetMessage('gotFish', (m) => lane.setCarryWeight(+m?.weight))

  // Seen from the side: the stolen fish leaps from the victim to the thief.
  function flyFish(id, from, to) {
    const thumb = sprite(texture(Object.assign(document.createElement('canvas'), { width: 4, height: 4 })), 1, 1)
    thumb.userData.ownTex = true
    const img = new Image()
    img.onload = () => {
      thumb.material.map.image = img
      thumb.material.map.needsUpdate = true
    }
    img.src = fishThumb(id)
    const a = { x: from.x, y: from.y + 2.2, z: from.z }
    addEffect(thumb, 0.7, (e) => {
      const b = posOf(to)
      if (!b) return false
      const k = e.t / e.life
      thumb.position.set(a.x + (b.x - a.x) * k, a.y + (b.y + 2.6 - a.y) * k + Math.sin(k * Math.PI) * 3, a.z + (b.z - a.z) * k)
      thumb.material.rotation = k * 8
    })
  }

  // --- Input: click on the world, F, or the lane HUD's Swing button ---
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || ctx.getSlot() !== 2) return
    if (e.target === ctx.canvas || document.pointerLockElement) swing()
  })
  onKey('KeyF', swing)

  return {
    swing,
    // Dev only: play the room's messages without a server, e.g. simulate('bonk', { by: 'x', to: 'me', x: 0, z: 1, fish: '' }).
    simulate: import.meta.env.DEV ? (type, m) => (type === 'bonk' ? onBonk(m) : type === 'swing' ? onSwing(m) : lane.setCarryWeight(+m?.weight)) : undefined,
    // Hit-stop: the frame's dt is scaled by this (nearly frozen for a beat after a hit).
    timeScale(dt) {
      if (stop <= 0) return 1
      stop -= dt
      return 0.06
    },
    update(dt) {
      const wasCooling = cooldown > 0
      cooldown -= dt
      // The bat is ready again: a soft tick, while it is still in hand out in the lane.
      if (wasCooling && cooldown <= 0 && ctx.getSlot() === 2 && lane.canSwing && player.position.z < 0) sfx.batReady()
      for (let i = timers.length - 1; i >= 0; i--) {
        if ((timers[i].at -= dt) > 0) continue
        const { fn } = timers.splice(i, 1)[0]
        fn()
      }
      // The swing: animation keys, and the strike once the wind-up is done.
      if (swingT >= 0) {
        if (!lane.canSwing) swingT = -1 // a stolen catch (or a bonk) took over the arms
        else {
          const prev = swingT
          swingT += dt
          if (!struck && swingT >= BAT.windup) {
            struck = true
            strike()
          }
          if (!stepSwing(anim(), prev, swingT, BAT.windup, BAT.swing)) swingT = -1
        }
      }
      laneHud.showSwing(ctx.getSlot() === 2 && lane.canSwing && player.position.z < 0, Math.max(0, cooldown / BAT.cooldown))
      for (let i = pending.length - 1; i >= 0; i--) {
        const s = pending[i]
        s.at -= dt
        if (s.at > 0) continue
        pending.splice(i, 1)
        const p = posOf(s.id)
        if (p) swoosh(p, yawOf(s.id))
      }
      for (const s of swooshes) {
        if (!s.m.visible) continue
        s.t += dt
        const k = s.t / 0.22
        s.m.material.uniforms.uHead.value = Math.min(1.7, k * 1.9)
        s.m.material.uniforms.uFade.value = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4)
        if (k >= 1) s.m.visible = false
      }
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i]
        e.t += dt
        if (e.t >= e.life || e.step(e, dt) === false) {
          dropEffect(e)
          effects.splice(i, 1)
          for (const [id, b] of bubbles) if (b === e) bubbles.delete(id)
        }
      }
    },
  }
}
