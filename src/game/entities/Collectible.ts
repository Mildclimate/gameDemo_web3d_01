import {
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  TorusGeometry,
} from 'three'

import { COLLECTION_DISTANCE, COLLECTIBLE_SCORE } from '../config/gameConfig'

let collectibleIdCounter = 0

/**
 * 能量晶体实体：蓝色/青色发光，带旋转和浮动动画。
 * 只负责视觉呈现和自身状态，不参与逻辑判定。
 */
export class Collectible {
  readonly id: string
  readonly object: Group
  readonly scoreValue: number
  readonly collectionDistance: number

  private readonly crystalMesh: Mesh
  private readonly haloMesh: Mesh
  private readonly light: PointLight
  private readonly baseY: number
  private readonly elapsedOffset: number

  private _collected = false

  constructor(x: number, z: number, scoreValue: number = COLLECTIBLE_SCORE) {
    this.id = `crystal_${collectibleIdCounter++}`
    this.scoreValue = scoreValue
    this.collectionDistance = COLLECTION_DISTANCE

    this.object = new Group()
    this.object.name = `collectible-${this.id}`
    this.object.position.set(x, 0, z)

    this.baseY = 1.3
    this.elapsedOffset = Math.random() * Math.PI * 2

    // 晶体材质
    const crystalMaterial = new MeshStandardMaterial({
      color: '#9df6ff',
      roughness: 0.15,
      metalness: 0.15,
      emissive: '#2fd8ff',
      emissiveIntensity: 2.4,
      flatShading: true,
      transparent: true,
      opacity: 0.95,
    })

    const haloMaterial = new MeshStandardMaterial({
      color: '#5fe6ff',
      roughness: 0.4,
      metalness: 0.3,
      emissive: '#2fd8ff',
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.6,
    })

    const crystalGeometry = new OctahedronGeometry(0.35, 0)
    const haloGeometry = new TorusGeometry(0.6, 0.04, 6, 48)

    // 晶体主体
    this.crystalMesh = new Mesh(crystalGeometry, crystalMaterial)
    this.crystalMesh.scale.set(0.8, 1.3, 0.8)
    this.crystalMesh.position.y = this.baseY
    this.crystalMesh.castShadow = true
    this.object.add(this.crystalMesh)

    // 底部光环
    this.haloMesh = new Mesh(haloGeometry, haloMaterial)
    this.haloMesh.rotation.x = Math.PI / 2
    this.haloMesh.position.y = this.baseY - 0.45
    this.object.add(this.haloMesh)

    // 自发光点光源
    this.light = new PointLight('#5fe6ff', 4, 6, 2)
    this.light.position.y = this.baseY
    this.object.add(this.light)
  }

  get collected(): boolean {
    return this._collected
  }

  /** 收集后隐藏自己（保留 object 节点供场景引用）。 */
  collect(): void {
    if (this._collected) return
    this._collected = true
    this.object.visible = false
  }

  /** 重置到未收集状态并显示。 */
  reset(): void {
    this._collected = false
    this.object.visible = true
  }

  /** 每帧动画更新：旋转 + 浮动。 */
  update(deltaSeconds: number, elapsedSeconds: number): void {
    if (this._collected) return

    const t = elapsedSeconds + this.elapsedOffset
    this.crystalMesh.rotation.y += deltaSeconds * 1.6
    this.crystalMesh.rotation.x = Math.sin(t * 0.8) * 0.25
    this.crystalMesh.position.y = this.baseY + Math.sin(t * 1.8) * 0.2

    this.haloMesh.rotation.z += deltaSeconds * 0.9
    this.light.intensity = 3 + Math.sin(t * 2.2) * 1.2
  }

  /** 世界位置（x, z 平面）。 */
  get position(): { x: number; z: number } {
    return { x: this.object.position.x, z: this.object.position.z }
  }
}
