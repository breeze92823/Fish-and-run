import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial } from 'three'
import { mulberry32 } from './textures.js'

// Sky dressing round the hub: puffy cartoon clouds all round the horizon, mostly
// ahead (-Z, up the lane). The hub itself (ground, walls, plots, stalls) is src/hub/.

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 30; i++) {
    // Mostly ahead (-Z), a few all around.
    const ang = i < 15 ? -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25 : rand() * Math.PI * 2
    const dist = 260 + rand() * 170
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.82, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat) // flat underside
    flat.scale.set(len * 0.62, 4, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 30 + rand() * 70, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

export function createWorld(scene) {
  const clouds = makeClouds()
  scene.add(clouds)
  return {
    update(dt, elapsed) {
      clouds.rotation.y = elapsed * 0.0015 // a slow drift
    },
  }
}
