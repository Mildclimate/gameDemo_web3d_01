/**
 * 玩家移动与碰撞参数。所有单位：距离 = 米，时间 = 秒。
 */
export const PLAYER_MOVEMENT = {
  /** 玩家碰撞半径，用于边界内缩与障碍推离。 */
  radius: 0.45,
  /** 最大移动速度。 */
  speed: 5.2,
  /** 加速平滑系数（越大越跟手）。 */
  acceleration: 18,
  /** 松开按键后的减速平滑系数。 */
  deceleration: 26,
  /** 朝向插值平滑系数。 */
  turnSmoothing: 14,
  /** 碰撞子步长上限，避免高速穿透薄墙。 */
  maxSubstep: 0.15,
} as const

/**
 * 出生点位于祭坛南侧，面朝祭坛（模型默认朝 +Z，故旋转 PI 朝 -Z）。
 */
export const PLAYER_SPAWN = {
  x: 0,
  z: 8.2,
  rotationY: Math.PI,
} as const
