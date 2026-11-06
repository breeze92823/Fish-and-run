// Zone pictures for the Index window's zone cards: one drawn SVG scene per zone id
// (150 x 360, cropped to the card). Unknown ids get their banner colours with hills.
// zoneArt(zone, i) -> SVG markup string.

const SVG = (body, defs = '') => `<svg viewBox="0 0 150 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const bg = (id) => `<rect width="150" height="360" fill="url(#${id})"/>`
const dots = (pts, r, fill) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('')

// --- Shared pieces --------------------------------------------------------------------------
function tree(x, y, s, c1, c2, trunk = '#6b4424') {
  return `<rect x="${x - 3 * s}" y="${y}" width="${6 * s}" height="${30 * s}" fill="${trunk}"/>
  <circle cx="${x}" cy="${y - 4 * s}" r="${16 * s}" fill="${c1}"/><circle cx="${x - 10 * s}" cy="${y + 4 * s}" r="${11 * s}" fill="${c1}"/>
  <circle cx="${x + 10 * s}" cy="${y + 3 * s}" r="${12 * s}" fill="${c1}"/><circle cx="${x - 4 * s}" cy="${y - 10 * s}" r="${8 * s}" fill="${c2}"/>`
}
function pine(x, y, s, c, snow) {
  let p = `<rect x="${x - 2.5 * s}" y="${y + 34 * s}" width="${5 * s}" height="${10 * s}" fill="#5a3a20"/>`
  for (let i = 0; i < 3; i++) {
    const ty = y + i * 11 * s
    const w = (10 + i * 5) * s
    p += `<path d="M${x} ${ty} L${x + w} ${ty + 18 * s} L${x - w} ${ty + 18 * s} Z" fill="${c}"/>`
    if (snow) p += `<path d="M${x} ${ty} L${x + w * 0.55} ${ty + 10 * s} Q${x} ${ty + 13 * s} ${x - w * 0.55} ${ty + 10 * s} Z" fill="#fff"/>`
  }
  return p
}
// Palm: curved trunk from (x, y) up to the crown, five fronds.
function palm(x, y, h, lean, s = 1) {
  const tx = x + lean
  const ty = y - h
  let p = `<path d="M${x - 4 * s} ${y} Q${x + lean * 0.2} ${y - h * 0.5} ${tx - 2 * s} ${ty} L${tx + 2 * s} ${ty} Q${x + lean * 0.2 + 6 * s} ${y - h * 0.5} ${x + 4 * s} ${y} Z" fill="#8a5a2a"/>`
  for (let i = 1; i < 6; i++) p += `<path d="M${x - 4 * s + (lean * i) / 7} ${y - (h * i) / 6} h${8 * s}" stroke="#6a4218" stroke-width="${1.4 * s}"/>`
  for (const [a, l] of [[-160, 30], [-120, 26], [-60, 26], [-20, 30], [-90, 18]]) {
    const r = (a * Math.PI) / 180
    const ex = tx + Math.cos(r) * l * s
    const ey = ty + Math.sin(r) * l * s + 10 * s
    p += `<path d="M${tx} ${ty} Q${(tx + ex) / 2} ${ty + Math.sin(r) * l * s * 0.9 - 6 * s} ${ex} ${ey}" stroke="#2f9a2a" stroke-width="${7 * s}" fill="none" stroke-linecap="round"/>`
  }
  return p + `<circle cx="${tx}" cy="${ty + 2 * s}" r="${4 * s}" fill="#6a4218"/>`
}
function cactus(x, y, h, s = 1) {
  const w = 8 * s
  return `<g fill="#3fae4a" stroke="#2a7a30" stroke-width="${1.5 * s}">
  <path d="M${x - w} ${y} V${y - h + w} a${w} ${w} 0 0 1 ${2 * w} 0 V${y} Z"/>
  <path d="M${x - w} ${y - h * 0.45} h${-8 * s} a${4 * s} ${4 * s} 0 0 1 ${-4 * s} ${-4 * s} V${y - h * 0.75} a${4 * s} ${4 * s} 0 0 1 ${8 * s} 0 V${y - h * 0.53} h${4 * s} Z"/>
  <path d="M${x + w} ${y - h * 0.35} h${8 * s} a${4 * s} ${4 * s} 0 0 0 ${4 * s} ${-4 * s} V${y - h * 0.62} a${4 * s} ${4 * s} 0 0 0 ${-8 * s} 0 V${y - h * 0.43} h${-4 * s} Z"/></g>
  <path d="M${x - 2 * s} ${y - h + 6 * s} V${y - 4 * s}" stroke="#6fd06a" stroke-width="${2 * s}"/>`
}
function deadTree(x, y, s = 1) {
  const c = '#3a2e22'
  return `<g stroke="${c}" stroke-linecap="round" fill="none">
  <path d="M${x} ${y} L${x + 2 * s} ${y - 60 * s} L${x - 6 * s} ${y - 90 * s}" stroke-width="${6 * s}"/>
  <path d="M${x + 1 * s} ${y - 40 * s} L${x + 20 * s} ${y - 62 * s} L${x + 26 * s} ${y - 58 * s}" stroke-width="${3.5 * s}"/>
  <path d="M${x + 1 * s} ${y - 62 * s} L${x - 16 * s} ${y - 76 * s}" stroke-width="${3 * s}"/>
  <path d="M${x - 4 * s} ${y - 82 * s} L${x + 8 * s} ${y - 100 * s}" stroke-width="${2.5 * s}"/></g>
  <path d="M${x + 6 * s} ${y - 62 * s} q${3 * s} ${12 * s} ${-1 * s} ${22 * s} M${x - 10 * s} ${y - 72 * s} q${3 * s} ${10 * s} 0 ${18 * s}" stroke="#7a9a5a" stroke-width="${1.6 * s}" fill="none"/>`
}
function crystal(x, y, h, w, a, c1, c2) {
  return `<g transform="rotate(${a} ${x} ${y})"><path d="M${x - w} ${y} L${x - w} ${y - h * 0.7} L${x} ${y - h} L${x + w} ${y - h * 0.7} L${x + w} ${y} Z" fill="${c1}"/>
  <path d="M${x} ${y} L${x} ${y - h} L${x + w} ${y - h * 0.7} L${x + w} ${y} Z" fill="${c2}"/>
  <path d="M${x - w * 0.55} ${y - h * 0.15} L${x - w * 0.55} ${y - h * 0.65}" stroke="#fff" stroke-width="${w * 0.25}" stroke-linecap="round" opacity=".7"/></g>`
}
function mushroom(x, y, h, r, cap, spots = '#fff') {
  return `<path d="M${x - r * 0.28} ${y} Q${x - r * 0.18} ${y - h * 0.5} ${x - r * 0.2} ${y - h} H${x + r * 0.2} Q${x + r * 0.18} ${y - h * 0.5} ${x + r * 0.28} ${y} Z" fill="#f4e8d0"/>
  <path d="M${x - r * 0.2} ${y - h} Q${x} ${y - h + r * 0.18} ${x + r * 0.2} ${y - h}" fill="#d8c8a8"/>
  <path d="M${x - r} ${y - h} Q${x - r} ${y - h - r * 0.95} ${x} ${y - h - r * 0.95} Q${x + r} ${y - h - r * 0.95} ${x + r} ${y - h} Q${x} ${y - h + r * 0.22} ${x - r} ${y - h} Z" fill="${cap}"/>
  ${dots([[x - r * 0.5, y - h - r * 0.35], [x + r * 0.15, y - h - r * 0.65], [x + r * 0.6, y - h - r * 0.25], [x - r * 0.1, y - h - r * 0.2]], r * 0.12, spots)}`
}
function blossom(x, y, s = 1) {
  return `<path d="M${x - 4 * s} ${y} Q${x - 2 * s} ${y - 30 * s} ${x - 12 * s} ${y - 52 * s} M${x} ${y - 24 * s} Q${x + 10 * s} ${y - 38 * s} ${x + 16 * s} ${y - 54 * s}" stroke="#5a3424" stroke-width="${5 * s}" fill="none" stroke-linecap="round"/>
  <path d="M${x - 4 * s} ${y} L${x - 2 * s} ${y - 26 * s} L${x + 3 * s} ${y - 26 * s} L${x + 4 * s} ${y} Z" fill="#5a3424"/>
  ${dots([[x - 16 * s, y - 56 * s], [x + 16 * s, y - 60 * s], [x, y - 66 * s]], 20 * s, '#ff9ac8')}
  ${dots([[x - 28 * s, y - 48 * s], [x + 30 * s, y - 50 * s], [x - 4 * s, y - 50 * s]], 15 * s, '#ffb4d6')}
  ${dots([[x - 10 * s, y - 72 * s], [x + 10 * s, y - 74 * s], [x + 24 * s, y - 64 * s]], 9 * s, '#ffd0e6')}`
}
function lollipop(x, y, h, r, c) {
  return `<rect x="${x - 2}" y="${y - h}" width="4" height="${h}" fill="#fff" stroke="#d8c8d8" stroke-width=".8"/>
  <circle cx="${x}" cy="${y - h}" r="${r}" fill="#fff"/>
  <path d="M${x} ${y - h} m${-r * 0.15} 0 a${r * 0.15} ${r * 0.15} 0 1 1 ${r * 0.3} 0 a${r * 0.35} ${r * 0.35} 0 1 1 ${-r * 0.7} 0 a${r * 0.55} ${r * 0.55} 0 1 1 ${r * 1.1} 0 a${r * 0.75} ${r * 0.75} 0 1 1 ${-r * 1.5} 0" fill="none" stroke="${c}" stroke-width="${r * 0.18}"/>
  <circle cx="${x}" cy="${y - h}" r="${r}" fill="none" stroke="${c}" stroke-width="${r * 0.08}"/>`
}
function cane(x, y, h, flip = 1) {
  const d = `M${x} ${y} V${y - h} a${9 * flip} 9 0 0 1 ${18 * flip} 0 v6`
  return `<path d="${d}" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="${d}" stroke="#ff3a4a" stroke-width="7" fill="none" stroke-linecap="butt" stroke-dasharray="5 5"/>`
}

// --- Scenes ---------------------------------------------------------------------------------
const ART = {
  forest: () =>
    SVG(
      `${bg('ixa-f')}<rect width="150" height="360" fill="url(#ixa-fl)"/>
  ${pine(52, 150, 1, '#5aa860')}${pine(98, 140, 1.1, '#4e9a58')}${pine(75, 168, 0.8, '#68b86a')}
  ${tree(124, 205, 1.3, '#3f9a3a', '#5ebc48')}${tree(22, 215, 1.2, '#3a8f35', '#58b443')}
  <path d="M0 252 Q75 236 150 252 V360 H0 Z" fill="#5fbb34"/>
  <path d="M62 250 Q75 246 88 250 L120 360 H30 Z" fill="#d9c48a"/><path d="M68 252 L82 252 L96 360 H54 Z" fill="#e8d7a2"/>
  <rect x="2" y="0" width="16" height="250" fill="#6b4424"/><rect x="6" y="0" width="5" height="250" fill="#86582f"/>
  <rect x="132" y="0" width="16" height="262" fill="#6b4424"/><rect x="136" y="0" width="5" height="262" fill="#86582f"/>
  ${dots([[10, 20], [140, 24]], 40, '#2f7d2a')}${dots([[40, -4], [110, -6]], 30, '#3f9a3a')}${dots([[-4, 62], [154, 70]], 25, '#2a7326')}${dots([[30, 12], [122, 10]], 12, '#56b247')}
  ${dots([[8, 300], [146, 296]], 30, '#2f8d2a')}${dots([[34, 322], [120, 324]], 24, '#3ea235')}${dots([[0, 350], [150, 352]], 26, '#378f2f')}
  ${dots([[26, 300], [124, 306], [40, 336]], 3, '#fff')}${dots([[26, 300], [124, 306], [40, 336]], 1.2, '#ffe14a')}${dots([[112, 286], [16, 330]], 2.6, '#ff6a8a')}`,
      `${sky('ixa-f', ['#d8f4ff', '#bfe9b0', '#6cc23a'])}<radialGradient id="ixa-fl" cx=".5" cy=".42" r=".4"><stop offset="0" stop-color="#fffbe0" stop-opacity=".95"/><stop offset="1" stop-color="#fffbe0" stop-opacity="0"/></radialGradient>`,
    ),
  winter: () =>
    SVG(
      `${bg('ixa-w')}
  <path d="M-10 190 L30 110 L58 160 L92 90 L130 150 L160 120 V220 H-10 Z" fill="#b8cbe6"/>
  <path d="M30 110 L40 130 L34 126 L26 134 L20 128 Z M92 90 L104 112 L96 108 L88 116 L80 110 Z" fill="#fff"/>
  <path d="M0 214 Q75 190 150 214 V360 H0 Z" fill="#eef5fc"/><path d="M0 250 Q75 232 150 250 V360 H0 Z" fill="#fafdff"/>
  <path d="M64 248 Q75 245 86 248 L112 360 H38 Z" fill="#cfe6f7"/>
  ${pine(20, 150, 1.5, '#2f6a52', true)}${pine(130, 140, 1.6, '#2f6a52', true)}${pine(60, 180, 0.8, '#3c7a60', true)}${pine(98, 172, 0.9, '#3c7a60', true)}
  ${pine(8, 260, 1.4, '#2a5e48', true)}${pine(142, 262, 1.4, '#2a5e48', true)}
  ${dots([[20, 40], [70, 70], [120, 34], [44, 110], [108, 96], [80, 20], [30, 200], [118, 230]], 1.8, '#fff')}`,
      sky('ixa-w', ['#9fd2ff', '#e2f2ff', '#ffffff']),
    ),
  jungle: () =>
    SVG(
      `${bg('ixa-j')}
  ${dots([[10, 200], [50, 190], [95, 196], [140, 186]], 34, '#2e8a3a')}${dots([[30, 214], [75, 210], [120, 212]], 28, '#1f7030')}
  <path d="M0 250 Q75 236 150 250 V360 H0 Z" fill="#2f8f2a"/>
  <path d="M40 252 Q75 244 110 252 L130 300 Q75 290 20 300 Z" fill="#3ab8c8"/><path d="M50 262 Q75 258 100 262" stroke="#9ff0ff" stroke-width="2" fill="none"/>
  ${palm(26, 300, 150, 22, 1)}${palm(128, 310, 130, -20, 1)}${palm(76, 250, 80, 6, 0.7)}
  <g stroke="#2a8a26" stroke-width="3" fill="none" stroke-linecap="round"><path d="M14 0 Q20 50 10 90"/><path d="M60 0 Q54 40 64 70"/><path d="M104 0 Q110 34 100 60"/><path d="M140 0 Q134 60 144 110"/></g>
  ${dots([[10, 90], [64, 70], [100, 60], [144, 110], [12, 50], [58, 36], [138, 60]], 4, '#4ec23a')}
  ${dots([[0, 340], [36, 352], [116, 350], [152, 336]], 26, '#1f7a26')}${dots([[22, 330], [134, 326]], 4, '#ff4a7a')}`,
      sky('ixa-j', ['#c8f5d8', '#7ad88a', '#3fae4a']),
    ),
  desert: () =>
    SVG(
      `${bg('ixa-d')}<circle cx="104" cy="70" r="24" fill="#fff6c8"/><circle cx="104" cy="70" r="34" fill="#fff6c8" opacity=".35"/>
  <path d="M-10 230 V170 h16 l6 -10 h40 l6 10 h10 V230 Z" fill="#d9763a"/><path d="M-10 175 h82 v6 h-82 Z" fill="#c05a2a"/>
  <path d="M86 230 V150 l6 -8 h34 l6 8 h40 V230 Z" fill="#c8663a"/><path d="M86 156 h86 v6 h-86 Z" fill="#a84a22"/>
  <path d="M-10 240 Q40 214 90 236 T170 232 V360 H-10 Z" fill="#f2c46a"/><path d="M-10 280 Q60 252 120 276 T170 270 V360 H-10 Z" fill="#ffd88a"/>
  <path d="M60 236 Q75 300 40 360" stroke="#e8b45a" stroke-width="10" fill="none" opacity=".6"/>
  ${cactus(30, 300, 74, 1)}${cactus(122, 290, 60, 0.9)}${cactus(80, 250, 32, 0.5)}
  ${dots([[50, 320], [100, 336], [20, 346]], 3, '#c89a4a')}`,
      sky('ixa-d', ['#ffe3a8', '#ffc670', '#ffb05a']),
    ),
  swamp: () =>
    SVG(
      `${bg('ixa-sw')}
  ${dots([[20, 210], [70, 200], [120, 206]], 34, '#4a5e34')}
  <rect y="230" width="150" height="130" fill="#3e5a3a"/><path d="M0 236 Q75 228 150 236" stroke="#6a8a5a" stroke-width="3" fill="none"/>
  <g stroke="#7a9a6a" stroke-width="1.5" fill="none" opacity=".7"><path d="M20 270 h30"/><path d="M90 290 h34"/><path d="M40 320 h28"/></g>
  ${deadTree(28, 250, 1.2)}${deadTree(120, 244, 1)}${deadTree(78, 232, 0.55)}
  <rect y="120" width="150" height="40" fill="#e8f0d8" opacity=".25"/><rect y="200" width="150" height="24" fill="#e8f0d8" opacity=".3"/>
  ${[[30, 290, 12], [96, 306, 10], [62, 336, 13], [126, 336, 9]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" fill="#5aa040"/><path d="M${x} ${y} L${x + r} ${y - r * 0.15} L${x + r} ${y + r * 0.15} Z" fill="#3e5a3a"/>`).join('')}
  <circle cx="96" cy="303" r="3" fill="#ff8ac8"/>
  <g stroke="#5a7a3a" stroke-width="2.5" stroke-linecap="round"><path d="M6 360 V300"/><path d="M12 360 V312"/><path d="M144 360 V296"/><path d="M138 360 V316"/></g>
  ${dots([[6, 298], [144, 294]], 3.5, '#6a4a2a')}`,
      sky('ixa-sw', ['#b8c8a0', '#8a9a6a', '#5a6e44']),
    ),
  cave: () =>
    SVG(
      `${bg('ixa-c')}<ellipse cx="75" cy="200" rx="60" ry="90" fill="#3a4a8a" opacity=".45"/>
  <path d="M0 0 H40 Q20 80 30 160 Q10 240 26 360 H0 Z" fill="#241a40"/><path d="M150 0 H110 Q132 90 118 170 Q138 250 122 360 H150 Z" fill="#241a40"/>
  <path d="M30 0 L38 30 L46 0 M70 0 L76 40 L84 0 M100 0 L106 26 L112 0" fill="#2e2250"/>
  <path d="M0 290 Q75 270 150 290 V360 H0 Z" fill="#2e2250"/>
  ${crystal(28, 300, 70, 10, -14, '#5ad8ff', '#2a9ce8')}${crystal(44, 300, 44, 8, 8, '#8ae8ff', '#3ab0f0')}
  ${crystal(120, 296, 80, 11, 12, '#5ad8ff', '#2a9ce8')}${crystal(104, 300, 40, 7, -10, '#8ae8ff', '#3ab0f0')}
  ${crystal(75, 286, 34, 7, 0, '#a8f0ff', '#4ac0f8')}${crystal(18, 120, 30, 6, 60, '#5ad8ff', '#2a9ce8')}${crystal(134, 90, 28, 6, -62, '#5ad8ff', '#2a9ce8')}
  ${dots([[60, 150], [92, 120], [76, 220], [50, 240], [104, 210]], 1.8, '#c8f4ff')}`,
      sky('ixa-c', ['#141a36', '#22306a', '#1a2050']),
    ),
  coral: () =>
    SVG(
      `${bg('ixa-co')}
  <g fill="#fff" opacity=".18"><path d="M30 0 L50 0 L20 240 L6 240 Z"/><path d="M80 0 L96 0 L80 240 L66 240 Z"/><path d="M120 0 L134 0 L140 220 L128 220 Z"/></g>
  <path d="M-10 280 Q40 262 90 278 T170 272 V360 H-10 Z" fill="#f2dc9a"/><path d="M-10 310 Q60 292 120 306 T170 300 V360 H-10 Z" fill="#ffe8b0"/>
  <g stroke="#ff6a9a" stroke-width="6" stroke-linecap="round" fill="none"><path d="M24 290 V240 M24 262 L10 244 M24 252 L38 230 M10 244 V230 M38 230 L44 218"/></g>
  <path d="M100 292 Q96 240 124 226 Q150 250 140 292 Z" fill="#ff9a3a"/><g stroke="#e0701a" stroke-width="1.5" fill="none"><path d="M120 292 L122 232 M120 290 L108 246 M120 290 L136 246"/></g>
  <g fill="#9a5ae8" stroke="#6a32b8" stroke-width="1.5"><rect x="58" y="262" width="9" height="30" rx="4"/><rect x="69" y="250" width="9" height="42" rx="4"/><rect x="80" y="268" width="9" height="24" rx="4"/></g>
  ${dots([[62, 264], [73, 252], [84, 270]], 2.5, '#4a1a8a')}
  <path d="M40 300 q6 -16 12 0 q6 -16 12 0" fill="#3ac87a"/><path d="M130 312 q5 -18 10 0" fill="#3ac87a"/>
  <g fill="none" stroke="#fff" stroke-width="1.5" opacity=".8">${[[50, 200, 4], [56, 180, 3], [48, 160, 2.5], [110, 150, 4], [104, 126, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
  <path d="M84 110 q10 -8 20 0 q-10 8 -20 0 Z M84 110 l-7 -5 v10 Z" fill="#ffd21a"/>`,
      sky('ixa-co', ['#8aeaff', '#3ab8f0', '#1a7ad0']),
    ),
  mushroom: () =>
    SVG(
      `${bg('ixa-m')}${dots([[20, 40], [110, 30], [70, 80], [130, 110]], 1.6, '#fff')}
  <path d="M0 260 Q75 244 150 260 V360 H0 Z" fill="#5abf4a"/><path d="M0 300 Q75 286 150 300 V360 H0 Z" fill="#4aa83c"/>
  ${mushroom(108, 262, 120, 46, '#9a4ae8')}${mushroom(34, 270, 150, 50, '#e83a3a')}${mushroom(78, 268, 50, 22, '#ff8a3a')}
  ${mushroom(16, 320, 24, 14, '#9a4ae8')}${mushroom(132, 326, 30, 16, '#e83a3a')}
  ${dots([[50, 330], [100, 340], [70, 310]], 3, '#ffe14a')}`,
      sky('ixa-m', ['#f0dcff', '#c8a0f4', '#a070e0']),
    ),
  sakura: () =>
    SVG(
      `${bg('ixa-sk')}<circle cx="96" cy="80" r="22" fill="#fff" opacity=".7"/>
  <path d="M-10 220 Q30 170 70 210 T170 196 V260 H-10 Z" fill="#c8a8d8" opacity=".6"/>
  <path d="M0 262 Q75 246 150 262 V360 H0 Z" fill="#9ad87a"/><path d="M0 300 Q75 288 150 300 V360 H0 Z" fill="#ffd0e4"/>
  <path d="M62 262 Q75 258 88 262 L110 360 H40 Z" fill="#f4e8d8"/>
  ${blossom(26, 270, 1.1)}${blossom(126, 266, 1)}${blossom(78, 240, 0.55)}
  ${[[40, 120], [90, 150], [60, 200], [120, 190], [20, 220], [100, 300], [30, 330], [130, 320]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.8" transform="rotate(${i * 40} ${x} ${y})" fill="#ff9ac8"/>`).join('')}`,
      sky('ixa-sk', ['#ffeef6', '#ffd4e8', '#f8b8d8']),
    ),
  candy: () =>
    SVG(
      `${bg('ixa-ca')}${dots([[30, 60], [44, 54], [58, 62]], 14, '#fff')}${dots([[110, 100], [124, 94], [136, 102]], 12, '#fff')}
  ${[[20, 250, 30, '#ff7ac0'], [70, 246, 26, '#7ad8ff'], [124, 250, 32, '#b88aff']].map(([x, y, r, c]) => `<path d="M${x - r} ${y} Q${x - r} ${y - r * 1.4} ${x} ${y - r * 1.4} Q${x + r} ${y - r * 1.4} ${x + r} ${y} Z" fill="${c}"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.9}" rx="${r * 0.2}" ry="${r * 0.12}" fill="#fff" opacity=".6"/>`).join('')}
  <path d="M0 256 Q75 240 150 256 V360 H0 Z" fill="#ffb4d8"/><path d="M0 300 Q75 286 150 300 V360 H0 Z" fill="#ff9ac8"/>
  ${lollipop(30, 320, 110, 20, '#ff3a8a')}${lollipop(116, 330, 96, 17, '#3ac0ff')}${cane(66, 320, 60, 1)}${cane(144, 340, 40, -1)}
  ${dots([[50, 300], [96, 312], [20, 340], [130, 300]], 3, '#ffe14a')}${dots([[60, 340], [110, 346]], 3, '#7ad8ff')}`,
      sky('ixa-ca', ['#bfe8ff', '#ffe0f2', '#ffc4e4']),
    ),
}
ART.snow = ART.winter

// Zones without a drawn picture: their banner colours, with hills and a sun.
function fallbackArt(z, i) {
  const [a, b] = z.banner ?? ['#bfe9ff', '#6cc23a']
  return SVG(
    `${bg(`ixa-g${i}`)}<circle cx="108" cy="92" r="26" fill="#fff" opacity=".55"/>
  <path d="M-10 250 Q40 200 90 240 T170 230 V360 H-10 Z" fill="#000" opacity=".12"/>
  <path d="M-10 290 Q50 250 110 285 T170 280 V360 H-10 Z" fill="#000" opacity=".2"/>`,
    sky(`ixa-g${i}`, [a, b]),
  )
}

export const zoneArt = (z, i) => (ART[z.id] ? ART[z.id]() : fallbackArt(z, i))
