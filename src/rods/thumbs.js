// Rod card pictures: each rod's 3D model (models.js) rendered once, leaning from the
// bottom left to the top right like the shop reference, to a PNG data URL. A small
// offscreen renderer (with a room environment so metal reads as metal) is made on
// demand and released a moment after the last picture.
import { AmbientLight, Box3, DirectionalLight, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildRodModel, disposeRodModel } from './models.js'

const W = 300 // px; shown at ~300 x 380 design px
const H = 380
const cache = new Map()
let r = null
let scene = null
let cam = null
let envTex = null
let releaseTimer = 0

function setup() {
  r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(W * 2, H * 2, false)
  r.outputColorSpace = SRGBColorSpace
  r.toneMapping = NeutralToneMapping
  r.setClearColor(0x000000, 0)
  scene = new Scene()
  const pm = new PMREMGenerator(r)
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture
  pm.dispose()
  scene.environment = envTex
  scene.environmentIntensity = 0.55
  scene.add(new AmbientLight(0xffffff, 0.9))
  const sun = new DirectionalLight(0xffffff, 2.4)
  sun.position.set(-3, 5, 6)
  scene.add(sun)
  const rim = new DirectionalLight(0xffffff, 0.8)
  rim.position.set(4, -2, -3)
  scene.add(rim)
  cam = new PerspectiveCamera(30, W / H, 0.05, 50)
}

function release() {
  envTex?.dispose()
  r?.dispose()
  r?.forceContextLoss()
  r = scene = cam = envTex = null
}

const box = new Box3()
const centre = new Vector3()
const p = new Vector3()

// Pixel bounds (in the W*2 x H*2 image) of every vertex of `obj` seen through cam.
function screenBounds(obj) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  obj.traverse((o) => {
    const pos = o.geometry?.attributes?.position
    if (!pos) return
    const step = Math.max(1, Math.floor(pos.count / 400))
    for (let i = 0; i < pos.count; i += step) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(cam)
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
    }
  })
  const FW = W * 2
  const FH = H * 2
  return { x: ((x0 + 1) / 2) * FW, y: ((1 - y1) / 2) * FH, w: ((x1 - x0) / 2) * FW, h: ((y1 - y0) / 2) * FH }
}

export function rodThumb(id) {
  if (cache.has(id)) return cache.get(id)
  let url = ''
  try {
    if (!r) setup()
    const rod = buildRodModel(id)
    // Turn the reel side toward the viewer, lean the tip to the top right and away from the
    // camera (the grip comes out big at the bottom left, like the shop reference), and thicken
    // it a little so it reads at card size.
    rod.rotation.set(-0.5, -0.55, -0.6, 'XZY')
    rod.scale.set(1.35, 1, 1.35)
    scene.add(rod)
    rod.updateMatrixWorld(true)
    box.setFromObject(rod)
    box.getCenter(centre)
    cam.position.set(centre.x, centre.y, centre.z + 4.2)
    cam.lookAt(centre)
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
    // Crop the full render to the rod (keeping the card's aspect, a small margin).
    const b = screenBounds(rod)
    const aspect = W / H
    let w = b.w * 1.06
    let h = b.h * 1.06
    if (w / h > aspect) h = w / aspect
    else w = h * aspect
    cam.setViewOffset(W * 2, H * 2, b.x + b.w / 2 - w / 2, b.y + b.h / 2 - h / 2, w, h)
    r.render(scene, cam)
    url = r.domElement.toDataURL('image/png')
    scene.remove(rod)
    disposeRodModel(rod)
  } catch (e) {
    console.warn('[rodThumb]', id, e)
  }
  cache.set(id, url)
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(release, 1500)
  return url
}
