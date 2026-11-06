// Fish card pictures for the menus: each species' voxel model rendered once, side on
// (nose to the right, a little from above, like a Roblox item icon), to a PNG data URL.
// A small offscreen renderer is made on demand and released a moment after the last
// thumbnail, so it costs no GPU context while no window needs one.
import { AmbientLight, Box3, DirectionalLight, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { fishModel } from './hub/fish.js'

const SIZE = 160 // px; the cards show it at ~110 design px, so it stays crisp at 1.4x
const cache = new Map()
let r = null
let scene = null
let cam = null
let releaseTimer = 0

function setup() {
  r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(SIZE, SIZE, false)
  r.outputColorSpace = SRGBColorSpace
  r.setClearColor(0x000000, 0)
  scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.6))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(2, 5, 6)
  scene.add(sun)
  cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
}

function release() {
  r?.dispose()
  r?.forceContextLoss()
  r = scene = cam = null
}

const box = new Box3()
const centre = new Vector3()
const extent = new Vector3()

export function fishThumb(id) {
  if (cache.has(id)) return cache.get(id)
  let url = ''
  try {
    if (!r) setup()
    const model = fishModel(id)
    const mat = new MeshLambertMaterial({ vertexColors: true })
    const mesh = new Mesh(model.geo, mat)
    // Turn it a touch toward the viewer and tip the nose down a hair: reads as 3D, still side on.
    mesh.rotation.set(0.32, -0.38, -0.06)
    scene.add(mesh)
    mesh.updateMatrixWorld(true)
    box.setFromObject(mesh)
    box.getCenter(centre)
    box.getSize(extent)
    const half = Math.max(extent.x, extent.y) * 0.56
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.position.set(centre.x, centre.y, centre.z + 20)
    cam.lookAt(centre)
    cam.updateProjectionMatrix()
    r.render(scene, cam)
    url = r.domElement.toDataURL('image/png')
    scene.remove(mesh)
    mat.dispose()
  } catch (e) {
    console.warn('[fishThumb]', id, e)
  }
  cache.set(id, url)
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(release, 1500)
  return url
}
