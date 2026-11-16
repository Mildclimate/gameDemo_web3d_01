import { Vector3, type PerspectiveCamera } from 'three'

export interface CameraFollowOptions {
  /** 相对角色的固定世界偏移（后上方）。 */
  readonly offset: Vector3
  /** 注视点相对角色脚底的高度。 */
  readonly lookHeight: number
  /** 位置阻尼系数，越大跟随越紧。 */
  readonly positionLambda: number
  /** 注视点阻尼系数。 */
  readonly lookLambda: number
}

const DEFAULT_OPTIONS: CameraFollowOptions = {
  offset: new Vector3(0, 5.6, 8.2),
  lookHeight: 1.15,
  positionLambda: 6.5,
  lookLambda: 12,
}

/**
 * 第三人称跟随摄像机：固定世界偏移 + 指数阻尼，保证帧率无关且无抖动。
 * 相机不挂在 Player 下，避免继承角色旋转与动画。
 */
export class CameraFollowSystem {
  private readonly camera: PerspectiveCamera
  private readonly offset: Vector3
  private readonly lookHeight: number
  private readonly positionLambda: number
  private readonly lookLambda: number

  private readonly desiredPosition = new Vector3()
  private readonly desiredLookTarget = new Vector3()
  private readonly smoothedLookTarget = new Vector3()

  constructor(camera: PerspectiveCamera, options: Partial<CameraFollowOptions> = {}) {
    this.camera = camera
    this.offset = options.offset?.clone() ?? DEFAULT_OPTIONS.offset.clone()
    this.lookHeight = options.lookHeight ?? DEFAULT_OPTIONS.lookHeight
    this.positionLambda = options.positionLambda ?? DEFAULT_OPTIONS.positionLambda
    this.lookLambda = options.lookLambda ?? DEFAULT_OPTIONS.lookLambda
  }

  /** 立即对齐到目标位置，用于初始化或回到大厅时避免相机飞行。 */
  snapTo(target: Vector3): void {
    this.desiredLookTarget.set(target.x, target.y + this.lookHeight, target.z)
    this.smoothedLookTarget.copy(this.desiredLookTarget)

    this.desiredPosition.copy(target).add(this.offset)
    this.camera.position.copy(this.desiredPosition)
    this.camera.lookAt(this.smoothedLookTarget)
  }

  update(target: Vector3, deltaSeconds: number): void {
    this.desiredPosition.copy(target).add(this.offset)

    const positionBlend = 1 - Math.exp(-this.positionLambda * deltaSeconds)
    this.camera.position.lerp(this.desiredPosition, positionBlend)

    this.desiredLookTarget.set(target.x, target.y + this.lookHeight, target.z)
    const lookBlend = 1 - Math.exp(-this.lookLambda * deltaSeconds)
    this.smoothedLookTarget.lerp(this.desiredLookTarget, lookBlend)
    this.camera.lookAt(this.smoothedLookTarget)
  }
}
