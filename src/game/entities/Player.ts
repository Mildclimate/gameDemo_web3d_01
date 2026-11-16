import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { PLAYER_MOVEMENT, PLAYER_SPAWN } from '../config/movement'

/**
 * 玩家实体：只负责模型、位置、朝向、移动速度参数与动画。
 * 输入与碰撞由 KeyboardInput / MovementSystem 处理，不在这里读取 DOM。
 */
export class Player {
  /** 场景中的根节点，位置即角色脚底中心。 */
  readonly object: Group
  readonly radius = PLAYER_MOVEMENT.radius
  readonly moveSpeed = PLAYER_MOVEMENT.speed

  private readonly rig: Group
  private readonly leftLeg: Group
  private readonly rightLeg: Group
  private readonly leftArm: Group
  private readonly rightArm: Group
  private readonly footRing: Mesh

  private rotationY = PLAYER_SPAWN.rotationY
  private animationPhase = 0
  private normalizedSpeed = 0
  private elapsedSeconds = 0

  constructor() {
    this.object = new Group()
    this.object.name = 'player'

    const suit = new MeshStandardMaterial({
      color: '#32495f',
      roughness: 0.62,
      metalness: 0.46,
      emissive: '#0f2434',
      emissiveIntensity: 0.6,
    })
    const plate = new MeshStandardMaterial({
      color: '#1b2a3a',
      roughness: 0.4,
      metalness: 0.72,
      emissive: '#081521',
      emissiveIntensity: 0.45,
    })
    const glow = new MeshStandardMaterial({
      color: '#9df6ff',
      roughness: 0.25,
      metalness: 0.2,
      emissive: '#3ad9ff',
      emissiveIntensity: 2.1,
    })

    // 共用几何体，避免为每个零件创建独立 BufferGeometry。
    const boxGeometry = new BoxGeometry(1, 1, 1)
    const headGeometry = new SphereGeometry(0.24, 16, 12)
    const ringGeometry = new TorusGeometry(0.42, 0.022, 6, 40)

    const addBox = (
      parent: Group,
      material: MeshStandardMaterial,
      size: readonly [number, number, number],
      position: readonly [number, number, number],
    ): Mesh => {
      const mesh = new Mesh(boxGeometry, material)
      mesh.scale.set(...size)
      mesh.position.set(...position)
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }

    this.rig = new Group()
    this.rig.name = 'player-rig'
    this.object.add(this.rig)

    // 躯干、胸甲与发光核心
    addBox(this.rig, suit, [0.64, 0.8, 0.42], [0, 1.22, 0])
    addBox(this.rig, plate, [0.7, 0.26, 0.46], [0, 1.44, 0])
    addBox(this.rig, glow, [0.12, 0.3, 0.03], [0, 1.32, 0.225])
    addBox(this.rig, plate, [0.5, 0.16, 0.4], [0, 0.84, 0])

    // 背包与背侧能量条
    addBox(this.rig, plate, [0.42, 0.44, 0.16], [0, 1.28, -0.28])
    addBox(this.rig, glow, [0.26, 0.05, 0.03], [0, 1.16, -0.37])

    // 头部：模型正面（含面罩）朝 +Z，与 rotation.y 计算方式一致
    const head = new Mesh(headGeometry, suit)
    head.position.set(0, 1.86, 0)
    head.castShadow = true
    this.rig.add(head)
    addBox(this.rig, glow, [0.3, 0.1, 0.08], [0, 1.88, 0.2])
    addBox(this.rig, plate, [0.1, 0.12, 0.28], [0, 2.02, -0.02])

    // 手臂：以肩部为枢轴，方便摆动
    this.leftArm = new Group()
    this.leftArm.position.set(-0.42, 1.52, 0)
    this.rig.add(this.leftArm)
    addBox(this.leftArm, suit, [0.15, 0.62, 0.18], [0, -0.3, 0])
    addBox(this.rig, glow, [0.2, 0.06, 0.22], [-0.42, 1.56, 0])

    this.rightArm = new Group()
    this.rightArm.position.set(0.42, 1.52, 0)
    this.rig.add(this.rightArm)
    addBox(this.rightArm, suit, [0.15, 0.62, 0.18], [0, -0.3, 0])
    addBox(this.rig, glow, [0.2, 0.06, 0.22], [0.42, 1.56, 0])

    // 双腿：以髋部为枢轴
    this.leftLeg = new Group()
    this.leftLeg.position.set(-0.17, 0.8, 0)
    this.rig.add(this.leftLeg)
    addBox(this.leftLeg, suit, [0.22, 0.76, 0.26], [0, -0.38, 0])
    addBox(this.leftLeg, plate, [0.24, 0.12, 0.3], [0, -0.72, 0.02])

    this.rightLeg = new Group()
    this.rightLeg.position.set(0.17, 0.8, 0)
    this.rig.add(this.rightLeg)
    addBox(this.rightLeg, suit, [0.22, 0.76, 0.26], [0, -0.38, 0])
    addBox(this.rightLeg, plate, [0.24, 0.12, 0.3], [0, -0.72, 0.02])

    // 脚下的发光能量环，帮助玩家在深色场景中定位自己
    this.footRing = new Mesh(ringGeometry, glow)
    this.footRing.rotation.x = -Math.PI / 2
    this.footRing.position.y = 0.06
    this.rig.add(this.footRing)

    this.reset()
  }

  /** 直接设置平面位置，y 始终贴地。 */
  setPosition(x: number, z: number): void {
    this.object.position.set(x, 0, z)
  }

  /**
   * 朝移动方向平滑转身。direction 需为单位向量。
   * 模型默认朝 +Z，因此 yaw = atan2(dir.x, dir.z)。
   */
  faceTowards(directionX: number, directionZ: number, deltaSeconds: number): void {
    const target = Math.atan2(directionX, directionZ)
    let difference = target - this.rotationY
    difference = Math.atan2(Math.sin(difference), Math.cos(difference))

    const alpha = 1 - Math.exp(-PLAYER_MOVEMENT.turnSmoothing * deltaSeconds)
    this.rotationY += difference * alpha
    this.object.rotation.y = this.rotationY
  }

  /**
   * 行走动画：腿与手臂交替摆动，配合轻微起伏。
   * speedRatio 为 0–1 的当前速度占比。
   */
  updateAnimation(deltaSeconds: number, speedRatio: number): void {
    this.elapsedSeconds += deltaSeconds

    const target = Math.min(Math.max(speedRatio, 0), 1)
    const blend = 1 - Math.exp(-10 * deltaSeconds)
    this.normalizedSpeed += (target - this.normalizedSpeed) * blend
    if (this.normalizedSpeed < 0.001) this.normalizedSpeed = 0

    this.animationPhase += deltaSeconds * (6 + this.normalizedSpeed * 6) * this.normalizedSpeed

    const swing = Math.sin(this.animationPhase) * 0.55 * this.normalizedSpeed
    this.leftLeg.rotation.x = swing
    this.rightLeg.rotation.x = -swing
    this.leftArm.rotation.x = -swing * 0.8
    this.rightArm.rotation.x = swing * 0.8

    // 行走起伏 + 待机呼吸
    const bob = Math.abs(Math.sin(this.animationPhase)) * 0.05 * this.normalizedSpeed
    this.rig.position.y = bob + Math.sin(this.elapsedSeconds * 1.8) * 0.012
  }

  /** 回到出生点并清空动画状态。 */
  reset(): void {
    this.rotationY = PLAYER_SPAWN.rotationY
    this.object.rotation.y = this.rotationY
    this.setPosition(PLAYER_SPAWN.x, PLAYER_SPAWN.z)

    this.animationPhase = 0
    this.normalizedSpeed = 0
    this.elapsedSeconds = 0

    this.rig.position.y = 0
    this.leftLeg.rotation.x = 0
    this.rightLeg.rotation.x = 0
    this.leftArm.rotation.x = 0
    this.rightArm.rotation.x = 0
  }
}
