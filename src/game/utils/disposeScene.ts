import { Mesh, Texture, type BufferGeometry, type Material, type Object3D } from 'three'

/**
 * 释放场景树中所有 Mesh 共享或独占的 geometry、material 和 texture。
 * 使用 Set 去重，避免同一资源被多次 dispose。
 */
export function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return

    geometries.add(object.geometry)

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        materials.add(material)
      }
    } else {
      materials.add(object.material)
    }
  })

  const textures = new Set<Texture>()
  for (const material of materials) {
    const values: unknown[] = Object.values(material)
    for (const value of values) {
      if (value instanceof Texture) {
        textures.add(value)
      }
    }
    material.dispose()
  }

  for (const texture of textures) {
    texture.dispose()
  }

  for (const geometry of geometries) {
    geometry.dispose()
  }
}
