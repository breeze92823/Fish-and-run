// HUD icons: inline SVG strings, chunky cartoon style with dark outlines.
// Gradient ids are prefixed per icon so several icons can share a document.

const OUT = '#1a1420' // default outline

// Purple smiling devil face (flat, like the reference's emoji-style icon).
export const devil = `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs><linearGradient id="hdv-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b597e6"/><stop offset="1" stop-color="#9a7bd4"/></linearGradient></defs>
<path d="M10 6 L36 24 L17 44 Z M90 6 L64 24 L83 44 Z" fill="#a587dc"/>
<circle cx="50" cy="57" r="39" fill="url(#hdv-g)"/>
<path d="M22 41 L44 50 Q40 60 31 58 Q23 55 22 41 Z M78 41 L56 50 Q60 60 69 58 Q77 55 78 41 Z" fill="#5b3d8c"/>
<path d="M27 69 Q50 88 73 67" fill="none" stroke="#5b3d8c" stroke-width="7" stroke-linecap="round"/>
</svg>`

// Red shopping basket with a blue handle.
export const basket = `<svg viewBox="0 0 100 90" aria-hidden="true">
<defs>
<linearGradient id="hbs-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4d70"/><stop offset="1" stop-color="#c70f37"/></linearGradient>
<linearGradient id="hbs-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8aa0"/><stop offset="1" stop-color="#ff4f6f"/></linearGradient>
</defs>
<g transform="rotate(-10 50 50)">
<g stroke="${OUT}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M10 36 L92 30 L83 82 Q82 86 77 86 L25 87 Q20 87 19 83 Z" fill="url(#hbs-b)"/>
<path d="M10 36 L92 30 L90 44 L13 50 Z" fill="url(#hbs-r)"/>
</g>
<g fill="#8f0a27">
<rect x="27" y="57" width="7" height="20" rx="3.5"/><rect x="41" y="56" width="7" height="21" rx="3.5"/>
<rect x="55" y="55" width="7" height="21" rx="3.5"/><rect x="69" y="54" width="7" height="21" rx="3.5"/>
</g>
<path d="M22 40 C12 6 50 -2 56 32" fill="none" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/>
<path d="M22 40 C12 6 50 -2 56 32" fill="none" stroke="#3d74d9" stroke-width="7" stroke-linecap="round"/>
<path d="M19 26 C20 14 34 10 42 16" fill="none" stroke="#8fb6ff" stroke-width="2.5" stroke-linecap="round"/>
</g>
</svg>`

// Blue book seen at an angle, cream pages and a red bookmark.
export const book = `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs>
<linearGradient id="hbk-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8ff0"/><stop offset="1" stop-color="#1c4fb8"/></linearGradient>
</defs>
<g transform="rotate(32 50 50)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round">
<path d="M14 26 Q14 18 22 18 L80 18 Q86 18 86 24 L86 80 L22 80 Q14 80 14 72 Z" fill="#163c8e"/>
<path d="M22 66 L84 66 L84 78 L22 78 Q17 78 17 72 Q17 66 22 66 Z" fill="#fff4d8" stroke-width="4"/>
<path d="M14 24 Q14 14 24 14 L78 14 Q84 14 84 20 L84 66 L22 66 Q14 66 14 72 Z" fill="url(#hbk-c)"/>
<path d="M66 64 L66 90 L71 85 L76 90 L76 64 Z" fill="#e2263a" stroke-width="3.5"/>
</g>
<path d="M32 20 L58 36" stroke="#9cc4ff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
</svg>`

// Yellow-orange lightning bolt.
export const bolt = `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs><linearGradient id="hbt-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff46a"/><stop offset=".5" stop-color="#ffc61c"/><stop offset="1" stop-color="#ff8f00"/></linearGradient></defs>
<path d="M52 2 L92 2 L66 40 L84 40 L26 98 L40 56 L18 56 Z" fill="url(#hbt-g)" stroke="#c25400" stroke-width="4" stroke-linejoin="round"/>
<path d="M55 8 L84 8 L62 40" fill="none" stroke="#fffbd6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
</svg>`

// Generic hexagon coin (premium currency). Fill follows `currentColor`.
export const coin = `<svg viewBox="0 0 100 100" aria-hidden="true">
<path d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z" fill="currentColor" stroke="${OUT}" stroke-width="9" stroke-linejoin="round"/>
<path d="M50 24 L72.5 37 L72.5 63 L50 76 L27.5 63 L27.5 37 Z" fill="${OUT}"/>
<rect x="37" y="37" width="26" height="26" rx="6" fill="currentColor"/>
</svg>`

// Blue sneaker (the reference's gem/boost counter icon).
export const shoe = `<svg viewBox="0 0 100 80" aria-hidden="true">
<defs>
<linearGradient id="hsh-u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9bff"/><stop offset="1" stop-color="#1667e0"/></linearGradient>
<linearGradient id="hsh-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f8ff"/><stop offset="1" stop-color="#9ccaff"/></linearGradient>
</defs>
<g stroke="${OUT}" stroke-width="5" stroke-linejoin="round">
<path d="M6 56 Q4 72 18 74 L80 74 Q94 73 94 60 L92 52 L8 50 Z" fill="#1d6fe8"/>
<path d="M8 54 Q4 34 22 30 L42 26 Q50 8 70 8 Q90 8 92 30 L93 56 Q60 62 8 56 Z" fill="url(#hsh-u)"/>
<path d="M8 54 Q4 36 22 32 Q36 30 42 40 Q46 52 40 57 Q22 58 8 54 Z" fill="url(#hsh-t)" stroke-width="0"/>
</g>
<path d="M7 62 Q50 68 93 61" fill="none" stroke="#bfe0ff" stroke-width="4"/>
<g stroke="#d9ecff" stroke-width="5" stroke-linecap="round">
<path d="M44 26 L58 34"/><path d="M50 18 L64 26"/><path d="M57 12 L70 19"/>
</g>
</svg>`

// Green banknote stack.
export const cash = `<svg viewBox="0 0 100 80" aria-hidden="true">
<defs>
<linearGradient id="hcs-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6f25a"/><stop offset="1" stop-color="#5fcb1e"/></linearGradient>
</defs>
<g stroke="#0d2805" stroke-width="5" stroke-linejoin="round">
<path d="M6 40 Q4 34 10 32 L56 12 Q62 10 68 14 L94 34 Q97 38 96 44 L96 52 Q96 56 92 58 L46 76 Q40 78 36 75 L8 56 Q5 54 5 50 Z" fill="#3b9e12"/>
<path d="M6 40 Q4 34 10 32 L56 12 Q62 10 68 14 L94 34 Q98 40 92 43 L46 62 Q40 64 36 61 Z" fill="url(#hcs-t)"/>
</g>
<g stroke="#2a8410" stroke-width="2.5" fill="none">
<path d="M8 47 L38 67 L94 47"/><path d="M8 53 L40 72 L94 53"/>
</g>
<ellipse cx="51" cy="37" rx="15" ry="9" transform="rotate(-22 51 37)" fill="#4fb51a"/>
<circle cx="29" cy="40" r="4.5" fill="#4fb51a"/><circle cx="73" cy="33" r="4.5" fill="#4fb51a"/>
</svg>`

// Rolled parchment scroll (grey, like the reference).
export const scroll = `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs>
<linearGradient id="hsc-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9ccd3"/></linearGradient>
<linearGradient id="hsc-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f8"/><stop offset="1" stop-color="#a9adb6"/></linearGradient>
</defs>
<g stroke="${OUT}" stroke-width="5" stroke-linejoin="round">
<path d="M22 14 Q10 14 12 28 L28 82 L84 74 L70 18 Q68 10 60 10 Z" fill="url(#hsc-p)"/>
<path d="M22 14 Q32 12 34 22 Q36 30 26 30 Q18 30 16 22" fill="url(#hsc-r)"/>
<path d="M26 76 L82 66 Q94 66 94 76 Q94 86 84 88 L32 94 Q22 95 20 86 Q20 78 26 76 Z" fill="url(#hsc-r)"/>
</g>
<path d="M30 88 Q28 82 34 80" fill="none" stroke="#7d828c" stroke-width="3"/>
<g fill="#b4b8c1"><path d="M34 24 L62 21 L64 29 L36 32 Z"/><path d="M37 38 L67 34 L69 46 L40 50 Z"/><path d="M41 56 L71 52 L73 62 L43 66 Z"/></g>
</svg>`

// Blue fish, facing right.
export const fish = `<svg viewBox="0 0 100 80" aria-hidden="true">
<defs>
<linearGradient id="hfs-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e64d8"/><stop offset=".5" stop-color="#3f9cff"/><stop offset="1" stop-color="#eaf7ff"/></linearGradient>
<linearGradient id="hfs-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#0f55c8"/></linearGradient>
</defs>
<g transform="rotate(-20 52 42)" stroke="#0a2a66" stroke-width="3" stroke-linejoin="round">
<path d="M26 44 Q14 34 4 26 Q12 44 6 64 Q16 54 28 50 Z" fill="url(#hfs-f)"/>
<path d="M46 24 Q56 10 74 14 L66 26 Z" fill="url(#hfs-f)"/>
<path d="M48 58 L44 72 L60 62 Z" fill="url(#hfs-f)"/>
<path d="M22 47 Q40 20 72 20 Q94 20 97 38 Q94 52 72 60 Q44 68 22 50 Z" fill="url(#hfs-b)"/>
<path d="M50 42 Q60 34 70 40 Q62 50 50 46 Z" fill="#3a8ef5"/>
<path d="M30 40 Q44 30 60 32 M36 48 Q50 40 66 42" fill="none" stroke="#1f63c9" stroke-width="2.5" opacity=".7"/>
<circle cx="85" cy="32" r="4.5" fill="#0a1a3a" stroke="none"/><circle cx="86.5" cy="30.5" r="1.4" fill="#fff" stroke="none"/>
</g>
<path d="M38 30 Q52 18 70 16" stroke="#c9e8ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>
</svg>`

// Fishing rod (hotbar slot 1): thin brown rod, dark grip, blue reel band.
export const rod = `<svg viewBox="0 0 100 100" aria-hidden="true">
<path d="M84 4 L24 96" stroke="#2a1606" stroke-width="7.5" stroke-linecap="round"/>
<path d="M84 4 L24 96" stroke="#b06a2c" stroke-width="4" stroke-linecap="round"/>
<path d="M70 26 L68 29 M58 44 L56 47" stroke="#5a3010" stroke-width="4"/>
<path d="M38 74 L24 96" stroke="#3a1e14" stroke-width="5.5" stroke-linecap="round"/>
<path d="M43 66 L38 74" stroke="#2c3d8a" stroke-width="9"/>
<path d="M43 66 L38 74" stroke="#5a78d8" stroke-width="5"/>
</svg>`

// Baseball bat (hotbar slot 2).
export const bat = `<svg viewBox="14 14 72 72" aria-hidden="true">
<defs><linearGradient id="hbat-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2b8"/><stop offset="1" stop-color="#e9a862"/></linearGradient></defs>
<g transform="rotate(-48 50 50)" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round">
<path d="M8 50 Q8 44 13 44 L16 46.5 L48 45 Q72 41 88 41 Q97 41 97 50 Q97 59 88 59 Q72 59 48 55 L16 53.5 L13 56 Q8 56 8 50 Z" fill="url(#hbat-g)"/>
</g>
<path d="M60 30 Q70 20 80 16" stroke="#fff4e2" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
</svg>`

// Small yellow "+" box (gems: buy more).
export const plusBox = `<svg viewBox="0 0 100 100" aria-hidden="true">
<rect x="5" y="5" width="90" height="90" rx="8" fill="#f4c800" stroke="${OUT}" stroke-width="9"/>
<rect x="9" y="72" width="82" height="19" fill="#4f9a00"/>
<rect x="9" y="9" width="82" height="63" fill="#ffe01f"/>
<path d="M41 22 H59 V41 H78 V59 H59 V78 H41 V59 H22 V41 H41 Z" fill="#fff" stroke="${OUT}" stroke-width="7" stroke-linejoin="round"/>
</svg>`

// 4-point sparkle (white star).
export const sparkle = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 C53 38 62 47 100 50 C62 53 53 62 50 100 C47 62 38 53 0 50 C38 47 47 38 50 0 Z" fill="#fff"/></svg>`

// All icons as one object too (`import { icons } from './icons.js'` or the
// default export); `icons.fish` is shared with the Fish panel.
export const icons = { devil, basket, book, bolt, coin, shoe, cash, scroll, fish, rod, bat, plusBox, sparkle }
export default icons
