import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  TorusGeometry,
  type Material,
  type Object3D,
} from 'three'

import { ARENA } from './arenaLayout'

export interface World {
  readonly root: Group
  update(deltaSeconds: number): void
}

function createMaterials() {
  return {
    stone: new MeshStandardMaterial({
      color: '#1b2836',
      roughness: 0.92,
      metalness: 0.06,
    }),
    metal: new MeshStandardMaterial({
      color: '#152231',
      roughness: 0.55,
      metalness: 0.62,
    }),
    trim: new MeshStandardMaterial({
      color: '#0d2733',
      roughness: 0.35,
      metalness: 0.7,
      emissive: '#39d7ff',
      emissiveIntensity: 1.15,
    }),
    crystal: new MeshStandardMaterial({
      color: '#9df6ff',
      roughness: 0.18,
      metalness: 0.15,
      emissive: '#2fd8ff',
      emissiveIntensity: 2.2,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    }),
  }
}

export function createWorld(): World {
  const root = new Group()
  root.name = 'world'

  const materials = createMaterials()
  const unitBox = new BoxGeometry(1, 1, 1)

  const addBox = (
    parent: Object3D,
    material: Material,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    rotationY = 0,
  ): Mesh => {
    const mesh = new Mesh(unitBox, material)
    mesh.scale.set(...size)
    mesh.position.set(...position)
    mesh.rotation.y = rotationY
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  const addCylinder = (
    parent: Object3D,
    material: Material,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    position: readonly [number, number, number],
    radialSegments = 8,
  ): Mesh => {
    const mesh = new Mesh(
      new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      material,
    )
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  // 大型八边形地面平台，作为整个场景的基底
  const platform = new Group()
  platform.name = 'platform'
  root.add(platform)

  const platformBase = new Mesh(
    new CylinderGeometry(ARENA.platformRadius, ARENA.platformRadius * 1.06, 1.4, 8),
    materials.stone,
  )
  platformBase.position.y = -0.7
  platformBase.receiveShadow = true
  platform.add(platformBase)

  const platformPlate = new Mesh(new CylinderGeometry(11.6, 11.6, 0.18, 8), materials.metal)
  platformPlate.position.y = 0.09
  platformPlate.receiveShadow = true
  platform.add(platformPlate)

  const energyRing = new Mesh(new TorusGeometry(9.4, 0.07, 8, 96), materials.trim)
  energyRing.rotation.x = -Math.PI / 2
  energyRing.position.y = 0.22
  platform.add(energyRing)

  // 一圈高低错落的边界墙，明确可行走范围
  const boundaryRadius = ARENA.boundaryRadius
  for (let index = 0; index < ARENA.boundarySegments; index += 1) {
    const angle = (index / ARENA.boundarySegments) * Math.PI * 2
    const height = index % 4 === 0 ? 1.15 : 2.05
    const x = Math.sin(angle) * boundaryRadius
    const z = Math.cos(angle) * boundaryRadius

    addBox(
      root,
      materials.stone,
      [ARENA.wallWidth, height, ARENA.wallThickness],
      [x, height / 2, z],
      angle,
    )

    if (index % 2 === 0) {
      const trimRadius = boundaryRadius - 0.28
      addBox(
        root,
        materials.trim,
        [4.6, 0.07, 0.16],
        [Math.sin(angle) * trimRadius, height - 0.22, Math.cos(angle) * trimRadius],
        angle,
      )
    }
  }

  // 遗迹建筑：由远及近形成塔楼、拱门、残墙和断柱的层次
  const ruins = new Group()
  ruins.name = 'ruins'
  root.add(ruins)

  // 西侧：坍塌的塔楼
  addBox(ruins, materials.stone, [3.6, 2.4, 3.2], [-9.2, 1.2, -3.4])
  addBox(ruins, materials.stone, [2.8, 1.9, 2.4], [-9.6, 3.35, -3.0], 0.22)
  addBox(ruins, materials.stone, [1.7, 1.4, 1.5], [-8.9, 4.95, -3.6], -0.3)

  // 东侧：残缺拱门
  addBox(ruins, materials.stone, [1.2, 5.4, 1.2], [7.2, 2.7, -5.2])
  addBox(ruins, materials.stone, [1.2, 5.4, 1.2], [10.2, 2.7, -5.2])
  addBox(ruins, materials.stone, [4.2, 1.0, 1.3], [8.7, 5.9, -5.2])
  addBox(ruins, materials.trim, [3.4, 0.12, 0.2], [8.7, 5.32, -4.58])

  // 北侧：倾斜残墙与支撑柱
  addBox(ruins, materials.stone, [7.4, 3.4, 0.7], [1.6, 1.7, -11.2], 0.12)
  addCylinder(ruins, materials.stone, 0.45, 0.55, 3.2, [-2.4, 1.6, -10.8])
  addCylinder(ruins, materials.stone, 0.45, 0.55, 2.1, [5.6, 1.05, -10.6])

  // 南侧：断裂与倒塌的立柱
  addCylinder(ruins, materials.stone, 0.6, 0.72, 4.2, [-6.4, 2.1, 7.6])
  addCylinder(ruins, materials.stone, 0.6, 0.72, 2.4, [-4.4, 1.2, 9.2])
  const fallenColumn = addCylinder(ruins, materials.stone, 0.58, 0.7, 4.4, [-5.5, 0.68, 8.5])
  fallenColumn.rotation.z = Math.PI / 2

  // 散落碎石，让地面细节不显得空旷
  const rubble: ReadonlyArray<readonly [number, number, number, number]> = [
    [-11.4, 4.2, 1.1, 0.4],
    [11.8, 2.4, 0.9, -0.5],
    [4.2, 9.8, 0.8, 0.7],
    [-1.2, 12.1, 0.6, 0.2],
  ]
  for (const [x, z, size, rotation] of rubble) {
    addBox(ruins, materials.stone, [size, size * 0.75, size * 0.9], [x, size * 0.375, z], rotation)
  }

  // 中心视觉焦点：祭坛、能量环与悬浮晶体
  const relic = new Group()
  relic.name = 'relic'
  root.add(relic)

  addCylinder(relic, materials.metal, 2.9, 3.3, 0.7, [0, 0.35, 0])
  addCylinder(relic, materials.stone, 2.0, 2.5, 0.55, [0, 0.98, 0])

  const pylonCount = 4
  for (let index = 0; index < pylonCount; index += 1) {
    const angle = (index / pylonCount) * Math.PI * 2 + Math.PI / 4
    const x = Math.cos(angle) * 2.35
    const z = Math.sin(angle) * 2.35
    addBox(relic, materials.metal, [0.36, 2.1, 0.36], [x, 1.35, z])
    addBox(relic, materials.trim, [0.36, 0.14, 0.36], [x, 2.45, z])
  }

  const innerRing = new Mesh(new TorusGeometry(1.7, 0.055, 8, 72), materials.trim)
  innerRing.rotation.x = Math.PI / 2
  innerRing.position.y = 2.1
  relic.add(innerRing)

  const halo = new Mesh(new TorusGeometry(2.2, 0.03, 8, 96), materials.trim)
  halo.rotation.x = Math.PI / 2
  halo.position.y = 1.85
  relic.add(halo)

  const crystal = new Mesh(new OctahedronGeometry(0.95, 0), materials.crystal)
  crystal.position.y = 3.5
  crystal.scale.set(1, 1.55, 1)
  crystal.castShadow = true
  relic.add(crystal)

  const crystalLight = new PointLight('#5fe6ff', 14, 18, 2)
  crystalLight.position.y = 3.4
  relic.add(crystalLight)

  // 基础灯光：环境光打底，方向光提供主阴影，冷色轮廓光拉开层次
  const ambientLight = new AmbientLight('#4f7894', 0.9)
  root.add(ambientLight)

  const keyLight = new DirectionalLight('#d9f1ff', 2.4)
  keyLight.position.set(-13, 19, 9)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  keyLight.shadow.camera.near = 1
  keyLight.shadow.camera.far = 60
  keyLight.shadow.camera.left = -22
  keyLight.shadow.camera.right = 22
  keyLight.shadow.camera.top = 22
  keyLight.shadow.camera.bottom = -22
  keyLight.shadow.bias = -0.0005
  keyLight.shadow.normalBias = 0.02
  keyLight.target.position.set(0, 0.5, 0)
  root.add(keyLight, keyLight.target)

  const rimLight = new DirectionalLight('#2f8cb5', 1.1)
  rimLight.position.set(12, 8, -16)
  root.add(rimLight)

  let elapsedSeconds = 0

  return {
    root,
    update(deltaSeconds: number): void {
      elapsedSeconds += deltaSeconds

      crystal.rotation.y += deltaSeconds * 0.5
      crystal.position.y = 3.5 + Math.sin(elapsedSeconds * 1.3) * 0.16
      crystalLight.intensity = 13 + Math.sin(elapsedSeconds * 1.6) * 2

      innerRing.rotation.z += deltaSeconds * 0.25
      halo.rotation.z -= deltaSeconds * 0.18
      halo.rotation.x = Math.PI / 2 + Math.sin(elapsedSeconds * 0.6) * 0.18
    },
  }
}
