// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio } from './audio/index.js'
// installAudio() once at boot (the context starts on the first gesture; it also hooks the
// hover / press sounds of every button, uiSfx.js), then sfx.<name>() for one-shots and
// sfx.chaseUpdate() each frame. Everything is synthesised (core.js + synth.js + kit.js +
// sfx.js, gameSfx.js, uiSfx.js).
import { installAudio as installCore, isMuted, setMuted, setVolume, toggleMuted } from './core.js'
import * as sfx from './sfx.js'

function installAudio() {
  installCore()
  sfx.installUiSounds()
}

export { sfx, installAudio, setVolume, setMuted, isMuted, toggleMuted }
