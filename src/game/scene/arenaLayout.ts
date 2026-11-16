import type { Obstacle } from '../systems/collision'

/**
 * 八边形平台的共享尺寸。
 * createWorld 用它搭建可见地面与边界墙，MovementSystem 用同一组数值生成碰撞边界，
 * 避免视觉与可行走区域发生漂移。
 */
export const ARENA = {
  /** 地面平台外接半径。 */
  platformRadius: 16,
  /** 边界墙段数（与八边形地面保持一致）。 */
  boundarySegments: 16,
  /** 边界墙中心所在半径。 */
  boundaryRadius: 15.1,
  /** 边界墙厚度。 */
  wallThickness: 0.6,
  /** 单段边界墙宽度。 */
  wallWidth: 5.1,
} as const

/**
 * 场景中玩家不可穿越的遗迹实体。
 * 数值与 createWorld 中的可视模型一一对应，第一版使用圆形 / 旋转 AABB 近似。
 */
export const ARENA_OBSTACLES: readonly Obstacle[] = [
  // 中央祭坛底座（CylinderGeometry 半径 3.3）
  { kind: 'circle', x: 0, z: 0, radius: 3.3 },
  // 西侧坍塌塔楼基座 3.6 × 3.2
  { kind: 'box', x: -9.2, z: -3.4, halfWidth: 1.8, halfDepth: 1.6, rotation: 0 },
  // 东侧残缺拱门双柱 1.2 × 1.2
  { kind: 'box', x: 7.2, z: -5.2, halfWidth: 0.6, halfDepth: 0.6, rotation: 0 },
  { kind: 'box', x: 10.2, z: -5.2, halfWidth: 0.6, halfDepth: 0.6, rotation: 0 },
  // 北侧倾斜残墙 7.4 × 0.7，rotationY 0.12
  { kind: 'box', x: 1.6, z: -11.2, halfWidth: 3.7, halfDepth: 0.35, rotation: 0.12 },
  // 南侧断裂立柱（圆柱半径 0.72）
  { kind: 'circle', x: -6.4, z: 7.6, radius: 0.72 },
  { kind: 'circle', x: -4.4, z: 9.2, radius: 0.72 },
]
