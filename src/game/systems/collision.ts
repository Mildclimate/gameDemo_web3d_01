/**
 * 纯函数碰撞模块：不依赖 Three.js、DOM 或 Vue，可独立测试。
 * 坐标约定与场景一致：X 向右，Z 向上（屏幕内），W = -Z。
 */

export interface Vec2 {
  readonly x: number
  readonly z: number
}

export interface CircleObstacle {
  readonly kind: 'circle'
  readonly x: number
  readonly z: number
  readonly radius: number
}

export interface BoxObstacle {
  readonly kind: 'box'
  readonly x: number
  readonly z: number
  /** 本地 X 方向半宽。 */
  readonly halfWidth: number
  /** 本地 Z 方向半深。 */
  readonly halfDepth: number
  /** 绕 Y 轴旋转角（与 Three.js rotation.y 一致）。 */
  readonly rotation: number
}

export type Obstacle = CircleObstacle | BoxObstacle

export interface ArenaShape {
  /** 边界墙中心所在半径。 */
  readonly boundaryRadius: number
  /** 边界墙厚度。 */
  readonly wallThickness: number
  /** 边界段数，决定可行走区域为几边形。 */
  readonly boundarySegments: number
}

/**
 * 可行走区域 = 若干半平面的交集（规则多边形），而不是无限矩形。
 */
export interface ArenaBounds {
  readonly normals: readonly Vec2[]
  /** 玩家中心到各面法线方向的最大距离。 */
  readonly maxDistance: number
}

const EPSILON = 1e-6

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 由场地尺寸生成多边形边界。inset 通常传玩家半径，保证角色身体不压到墙体。
 */
export function createArenaBounds(shape: ArenaShape, inset: number): ArenaBounds {
  const normals: Vec2[] = []

  for (let index = 0; index < shape.boundarySegments; index += 1) {
    const angle = (index / shape.boundarySegments) * Math.PI * 2
    // 边界墙位于 (sin a, cos a) * R，朝向圆心的一侧即 (-sin a, -cos a)。
    normals.push({ x: -Math.sin(angle), z: -Math.cos(angle) })
  }

  return {
    normals,
    maxDistance: shape.boundaryRadius - shape.wallThickness / 2 - inset,
  }
}

/** 判断圆心位置是否处于多边形可行走区域内。 */
export function isInsideArena(x: number, z: number, bounds: ArenaBounds): boolean {
  for (const normal of bounds.normals) {
    if (x * normal.x + z * normal.z > bounds.maxDistance) return false
  }
  return true
}

/** 圆 vs 圆：返回推出后的位置，未碰撞返回 null。 */
function pushOutOfCircle(
  x: number,
  z: number,
  radius: number,
  obstacle: CircleObstacle,
): Vec2 | null {
  const offsetX = x - obstacle.x
  const offsetZ = z - obstacle.z
  const minDistance = radius + obstacle.radius
  const distanceSq = offsetX * offsetX + offsetZ * offsetZ
  if (distanceSq >= minDistance * minDistance) return null

  const distance = Math.sqrt(distanceSq)
  if (distance < EPSILON) {
    return { x: obstacle.x + minDistance, z: obstacle.z }
  }

  const scale = minDistance / distance
  return { x: obstacle.x + offsetX * scale, z: obstacle.z + offsetZ * scale }
}

/** 圆 vs 旋转矩形：返回推出后的位置，未碰撞返回 null。 */
function pushOutOfBox(x: number, z: number, radius: number, obstacle: BoxObstacle): Vec2 | null {
  const cos = Math.cos(obstacle.rotation)
  const sin = Math.sin(obstacle.rotation)

  // 世界坐标 → 矩形本地坐标（旋转 -rotation）。
  const offsetX = x - obstacle.x
  const offsetZ = z - obstacle.z
  const localX = offsetX * cos - offsetZ * sin
  const localZ = offsetX * sin + offsetZ * cos

  const closestX = clamp(localX, -obstacle.halfWidth, obstacle.halfWidth)
  const closestZ = clamp(localZ, -obstacle.halfDepth, obstacle.halfDepth)

  const deltaX = localX - closestX
  const deltaZ = localZ - closestZ
  const distanceSq = deltaX * deltaX + deltaZ * deltaZ
  if (distanceSq >= radius * radius) return null

  let pushX: number
  let pushZ: number

  if (distanceSq > EPSILON * EPSILON) {
    const distance = Math.sqrt(distanceSq)
    const correction = radius - distance
    pushX = (deltaX / distance) * correction
    pushZ = (deltaZ / distance) * correction
  } else {
    // 圆心已进入矩形内部：沿穿透量最小的轴推出，避免卡死。
    const penetrationX = obstacle.halfWidth - Math.abs(localX)
    const penetrationZ = obstacle.halfDepth - Math.abs(localZ)
    if (penetrationX <= penetrationZ) {
      pushX = Math.sign(localX || 1) * (penetrationX + radius)
      pushZ = 0
    } else {
      pushX = 0
      pushZ = Math.sign(localZ || 1) * (penetrationZ + radius)
    }
  }

  // 本地推出的位移 → 世界坐标（旋转 +rotation）。
  return {
    x: x + pushX * cos + pushZ * sin,
    z: z - pushX * sin + pushZ * cos,
  }
}

/**
 * 位置解算：把玩家从所有障碍与边界中推出。
 * 迭代两次，处理墙角处先被障碍推出、再被边界推回的极端情况。
 */
export function resolveCollisions(
  x: number,
  z: number,
  radius: number,
  bounds: ArenaBounds,
  obstacles: readonly Obstacle[],
): Vec2 {
  let resolvedX = x
  let resolvedZ = z

  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const obstacle of obstacles) {
      const next =
        obstacle.kind === 'circle'
          ? pushOutOfCircle(resolvedX, resolvedZ, radius, obstacle)
          : pushOutOfBox(resolvedX, resolvedZ, radius, obstacle)

      if (next) {
        resolvedX = next.x
        resolvedZ = next.z
      }
    }

    for (const normal of bounds.normals) {
      const distance = resolvedX * normal.x + resolvedZ * normal.z
      const overshoot = distance - bounds.maxDistance
      if (overshoot > 0) {
        resolvedX -= normal.x * overshoot
        resolvedZ -= normal.z * overshoot
      }
    }
  }

  return { x: resolvedX, z: resolvedZ }
}

/**
 * 位移 + 碰撞。拆成子步，防止单帧位移过大穿过薄墙；
 * 每步使用“推出”解算，因此可以自然沿障碍边缘滑行。
 */
export function moveWithCollisions(
  position: Vec2,
  displacement: Vec2,
  radius: number,
  bounds: ArenaBounds,
  obstacles: readonly Obstacle[],
  maxSubstep: number,
): Vec2 {
  const distance = Math.hypot(displacement.x, displacement.z)
  if (distance < EPSILON) return { x: position.x, z: position.z }

  const stepLength = Math.max(maxSubstep, EPSILON)
  const stepCount = Math.max(1, Math.ceil(distance / stepLength))
  const stepX = displacement.x / stepCount
  const stepZ = displacement.z / stepCount

  let x = position.x
  let z = position.z

  for (let index = 0; index < stepCount; index += 1) {
    const resolved = resolveCollisions(x + stepX, z + stepZ, radius, bounds, obstacles)
    x = resolved.x
    z = resolved.z
  }

  return { x, z }
}
