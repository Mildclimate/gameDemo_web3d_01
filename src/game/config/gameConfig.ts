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

/** 晶体外散位置（均为可行走区域内、不与障碍物重叠的坐标）。 */
export const COLLECTIBLE_POSITIONS: ReadonlyArray<{ x: number; z: number }> = [
  // 北侧残墙附近
  { x: 5.8, z: -9.2 },
  // 东侧拱门旁
  { x: 12.5, z: -1.6 },
  // 西南侧塔楼后
  { x: -11.6, z: 2.2 },
  // 南侧断柱之间
  { x: -3.2, z: 11.2 },
  // 东南侧空旷区
  { x: 8.6, z: 9.4 },
]

export function getEffectiveDuration(): number {
  return DEBUG_SHORT_TIMER ? DEBUG_TIMER_DURATION : GAME_DURATION
}
