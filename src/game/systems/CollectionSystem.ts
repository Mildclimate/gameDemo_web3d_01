import type { Collectible } from '../entities/Collectible'
import type { GameSession } from '../core/GameSession'

export interface CollectionEvents {
  onCollected?: (collectible: Collectible) => void
}

/**
 * 收集系统：检测玩家与晶体距离，触发收集。
 * 纯逻辑，不负责动画或 Three.js 渲染。
 */
export class CollectionSystem {
  private readonly session: GameSession
  private readonly events: CollectionEvents

  constructor(session: GameSession, events: CollectionEvents = {}) {
    this.session = session
    this.events = events
  }

  /**
   * 检测并执行所有可收集的晶体。
   * 只在 playing 状态下生效。
   *
   * @param playerX 玩家世界坐标 x
   * @param playerZ 玩家世界坐标 z
   * @param collectibles 场景中所有晶体
   */
  update(
    playerX: number,
    playerZ: number,
    collectibles: ReadonlyArray<Collectible>,
  ): void {
    if (!this.session.isActive) return

    for (const crystal of collectibles) {
      if (crystal.collected) continue

      const { x: cx, z: cz } = crystal.position
      const dx = playerX - cx
      const dz = playerZ - cz
      const distanceSq = dx * dx + dz * dz
      const threshold = crystal.collectionDistance

      if (distanceSq <= threshold * threshold) {
        this.collect(crystal)
      }
    }
  }

  private collect(crystal: Collectible): void {
    if (crystal.collected) return

    // GameSession.collect 返回 false 表示当前不允许收集（已结束等）
    const ok = this.session.collect(crystal.scoreValue)
    if (!ok) return

    crystal.collect()
    this.events.onCollected?.(crystal)
  }
}
