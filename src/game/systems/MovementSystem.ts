import { PLAYER_MOVEMENT } from '../config/movement'
import type { Player } from '../entities/Player'
import type { MoveDirection } from '../input/KeyboardInput'
import { ARENA, ARENA_OBSTACLES } from '../scene/arenaLayout'
import {
  createArenaBounds,
  isInsideArena,
  moveWithCollisions,
  type ArenaBounds,
  type ArenaShape,
  type Obstacle,
} from './collision'

const STOP_THRESHOLD = 0.02

/**
 * 移动系统：把输入方向转换为速度，按 deltaSeconds 位移并处理碰撞。
 * 只读写 Player，不接触 Vue 响应式状态。
 */
export class MovementSystem {
  private readonly player: Player
  private readonly bounds: ArenaBounds
  private readonly obstacles: readonly Obstacle[]

  private velocityX = 0
  private velocityZ = 0

  constructor(
    player: Player,
    shape: ArenaShape = ARENA,
    obstacles: readonly Obstacle[] = ARENA_OBSTACLES,
  ) {
    this.player = player
    this.bounds = createArenaBounds(shape, player.radius)
    this.obstacles = obstacles
  }

  /** 玩家是否仍在可行走区域内（供调试或未来状态检查）。 */
  isPlayerInsideArena(): boolean {
    const { x, z } = this.player.object.position
    return isInsideArena(x, z, this.bounds)
  }

  update(deltaSeconds: number, direction: MoveDirection): void {
    const hasInput = direction.x !== 0 || direction.z !== 0
    const targetVelocityX = direction.x * this.player.moveSpeed
    const targetVelocityZ = direction.z * this.player.moveSpeed

    // 指数平滑：同一 lambda 下不同帧率得到近似一致的加减速曲线。
    const lambda = hasInput ? PLAYER_MOVEMENT.acceleration : PLAYER_MOVEMENT.deceleration
    const blend = 1 - Math.exp(-lambda * deltaSeconds)
    this.velocityX += (targetVelocityX - this.velocityX) * blend
    this.velocityZ += (targetVelocityZ - this.velocityZ) * blend

    let speed = Math.hypot(this.velocityX, this.velocityZ)
    if (!hasInput && speed < STOP_THRESHOLD) {
      this.velocityX = 0
      this.velocityZ = 0
      speed = 0
    }

    if (speed > 0) {
      const next = moveWithCollisions(
        { x: this.player.object.position.x, z: this.player.object.position.z },
        { x: this.velocityX * deltaSeconds, z: this.velocityZ * deltaSeconds },
        this.player.radius,
        this.bounds,
        this.obstacles,
        PLAYER_MOVEMENT.maxSubstep,
      )

      this.player.setPosition(next.x, next.z)
      this.player.faceTowards(this.velocityX / speed, this.velocityZ / speed, deltaSeconds)
    }

    this.player.updateAnimation(deltaSeconds, speed / this.player.moveSpeed)
  }

  reset(): void {
    this.velocityX = 0
    this.velocityZ = 0
    this.player.reset()
  }
}
