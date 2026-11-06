import { AmbientLight, DirectionalLight, NeutralToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { fishMesh } from './hub/fish.js'

// The spinning "best fish" model in the HUD's top-right offer card. It draws into
// its own small transparent canvas placed inside the card's model box, so the
// card's ray burst stays behind it and the HUD's layering is untouched. Renders at
// ~30 fps; pauses when the box is hidden (zero size).
export function createOfferView(box) {
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
  box.style.position ||= 'relative'
  box.appendChild(canvas)
  let renderer = null
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch {
    return { setFish() {}, update() {} } // no second WebGL context: the card just shows its burst
  }
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NeutralToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const scene = new Scene()
  scene.add(new AmbientLight('#ffffff', 1.6))
  const sun = new DirectionalLight('#ffffff', 2.2)
  sun.position.set(2, 4, 5)
  scene.add(sun)
  const camera = new PerspectiveCamera(30, 1, 0.1, 100)
  let fish = null
  let size = 1
  const span = { x: 1, y: 1, z: 1 }
  let w = 0
  let h = 0
  let last = -1

  function fit() {
    const r = box.getBoundingClientRect()
    if (r.width === w && r.height === h) return
    w = r.width
    h = r.height
    if (w < 2 || h < 2) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Frame the model's bounds (length across, height up) to fill the box.
    const t = Math.tan((camera.fov * Math.PI) / 360)
    const dist = Math.max((span.x * 0.56) / (t * camera.aspect), (span.y * 0.6) / t) + span.z * 0.5
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
  }

  return {
    setFish(id) {
      if (fish) scene.remove(fish)
      fish = fishMesh(id, { labels: false, aura: false })
      size = fish.userData.size
      const bb = fish.userData.mesh.geometry.boundingBox
      span.x = bb.max.x - bb.min.x
      span.y = bb.max.y - bb.min.y
      span.z = bb.max.z - bb.min.z
      fish.userData.mesh.position.set(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2)
      scene.add(fish)
      w = h = 0
    },
    update(elapsed) {
      if (!fish || elapsed - last < 1 / 30) return
      last = elapsed
      fit()
      if (w < 2 || h < 2) return
      // Nose to the left and tipped up, as in the reference card.
      fish.rotation.set(0.1, Math.PI + 0.3 + Math.sin(elapsed * 0.8) * 0.2, -0.22 + Math.sin(elapsed * 1.3) * 0.04)
      fish.position.y = Math.sin(elapsed * 1.6) * size * 0.02
      renderer.render(scene, camera)
    },
  }
}
