import {
  BoxGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'

const PARTICLE_COUNT = 14
const PARTICLE_SIZE = 0.14
const LIFETIME = 0.55
const SPEED_MIN = 3.2
const SPEED_MAX = 6.5
const GRAVITY = 14

/** 一次收集触发的粒子爆裂：若干碎片向外飞散 + 重力下落 + 淡出。 */
export class BurstEffect {
  readonly object: Group

  private readonly particles: Mesh[] = []
  private readonly velocities: Vector3[] = []
  private readonly materials: MeshStandardMaterial[] = []
  private elapsed = 0
  private dead = false

  constructor(origin: Vector3, color: string = '#9df6ff', emissive: string = '#2fd8ff') {
    this.object = new Group()
    this.object.position.copy(origin)

    const geometry = new BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE)

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const material = new MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 2.2,
        roughness: 0.3,
        transparent: true,
        opacity: 1,
      })

      const particle = new Mesh(geometry, material)
      // 初始向上半球 + 水平四散
      const theta = Math.random() * Math.PI * 2
      const phi = MathUtils.degToRad(20 + Math.random() * 70) // 20°~90°
      const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)
      const vx = Math.cos(theta) * Math.sin(phi) * speed
      const vy = Math.cos(phi) * speed
      const vz = Math.sin(theta) * Math.sin(phi) * speed

      this.particles.push(particle)
      this.velocities.push(new Vector3(vx, vy, vz))
      this.materials.push(material)
      this.object.add(particle)
    }
  }

  /** 是否已结束（粒子全部淡出），结束后可从场景中移除并释放资源。 */
  get isDead(): boolean {
    return this.dead
  }

  update(deltaSeconds: number): void {
    if (this.dead) return

    this.elapsed += deltaSeconds
    const lifeT = Math.min(this.elapsed / LIFETIME, 1)
    const opacity = 1 - lifeT

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i]
      const v = this.velocities[i]
      const mat = this.materials[i]
      if (!p || !v || !mat) continue

      v.y -= GRAVITY * deltaSeconds
      p.position.x += v.x * deltaSeconds
      p.position.y += v.y * deltaSeconds
      p.position.z += v.z * deltaSeconds

      p.rotation.x += deltaSeconds * 8
      p.rotation.y += deltaSeconds * 6

      // 缩放随生命周期轻微缩小
      const scale = 1 - lifeT * 0.4
      p.scale.setScalar(scale)
      mat.opacity = opacity
    }

    if (lifeT >= 1) {
      this.dead = true
    }
  }

  /** 释放几何体与材质。 */
  dispose(): void {
    // 共享几何体，只需释放一次
    const geometry = this.particles[0]?.geometry
    geometry?.dispose()
    for (const m of this.materials) m.dispose()
    this.particles.length = 0
    this.velocities.length = 0
    this.materials.length = 0
  }
}
