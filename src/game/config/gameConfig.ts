/**
 * 游戏规则集中配置。所有数值从这里读取，避免散落硬编码。
 */

/** 单局游戏总时长（秒）。 */
export const GAME_DURATION = 120

/** 场景中需要收集的能量晶体总数。 */
export const TOTAL_COLLECTIBLES = 5

/** 每个晶体的分数奖励。 */
export const COLLECTIBLE_SCORE = 100

/** 收集判定距离（玩家中心到晶体中心的最大距离）。 */
export const COLLECTION_DISTANCE = 2.2

/** 玩家移动速度（与 PLAYER_MOVEMENT.speed 保持一致）。 */
export const PLAYER_SPEED = 5.2

/** 是否在开发模式下缩短倒计时以便测试。正式游戏不受影响。 */
export const DEBUG_SHORT_TIMER = false
export const DEBUG_TIMER_DURATION = 30

/**
 * 晶体候选位置池：每局从中随机抽取 TOTAL_COLLECTIBLES 个，
 * 保证每局布局不同但坐标都经过验证（可行走、不与障碍重叠）。
 */
export const COLLECTIBLE_CANDIDATE_POOL: ReadonlyArray<{ x: number; z: number }> = [
  { x: 5.8, z: -9.2 },
  { x: 12.5, z: -1.6 },
  { x: -11.6, z: 2.2 },
  { x: -3.2, z: 11.2 },
  { x: 8.6, z: 9.4 },
  { x: 0.4, z: -11.8 },
  { x: -8.2, z: -6.6 },
  { x: -12.4, z: 7.8 },
  { x: 4.0, z: 4.0 },
  { x: 10.8, z: 5.6 },
  { x: -6.4, z: 11.0 },
  { x: 6.2, z: -4.2 },
]

/** 向后兼容：保留 COLLECTIBLE_POSITIONS 为候选池的前 N 个。 */
export const COLLECTIBLE_POSITIONS: ReadonlyArray<{ x: number; z: number }> =
  COLLECTIBLE_CANDIDATE_POOL.slice(0, TOTAL_COLLECTIBLES)

/**
 * 从候选池中随机抽取 count 个不重复坐标。
 * 使用 Fisher–Yates 洗牌，保证均匀且避免重复。
 */
export function pickRandomCollectiblePositions(
  count: number = TOTAL_COLLECTIBLES,
): ReadonlyArray<{ x: number; z: number }> {
  const pool = COLLECTIBLE_CANDIDATE_POOL.map((p) => ({ ...p }))
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = pool[i]
    const swap = pool[j]
    if (temp && swap) {
      pool[i] = swap
      pool[j] = temp
    }
  }
  return pool.slice(0, Math.min(count, pool.length))
}

export function getEffectiveDuration(): number {
  return DEBUG_SHORT_TIMER ? DEBUG_TIMER_DURATION : GAME_DURATION
}
