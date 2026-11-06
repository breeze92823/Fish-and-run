// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio } from './audio/index.js'
// installAudio() once at boot (the context starts on the first gesture), then
// sfx.<name>() for one-shots. Everything is synthesised (core.js + synth.js + sfx.js).
import { installAudio, isMuted, setMuted, setVolume, toggleMuted } from './core.js'
import * as sfx from './sfx.js'

export { sfx, installAudio, setVolume, setMuted, isMuted, toggleMuted }
