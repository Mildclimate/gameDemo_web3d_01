import type { MoveDirection } from './KeyboardInput'

const ZERO_DIRECTION: MoveDirection = { x: 0, z: 0 }

/** 摇杆死区半径（归一化 0-1 空间），低于此值视为无输入。 */
export const TOUCH_DEAD_ZONE = 0.18

/**
 * 触控摇杆输入接收器：纯逻辑，不操作 DOM。
 * 由 TouchControls.vue 把原始指针偏移（归一化到 [-1, 1]）喂进来，
 * 应用死区与归一化后输出 MoveDirection。
 *
 * 与 KeyboardInput 对称，方便 InputManager 统一合并。
 */
export class TouchInput {
  private direction: MoveDirection = ZERO_DIRECTION
  private enabled = false

  /** 启用摇杆输入（playing 时开启，paused/menu 时关闭并清空）。 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.direction = ZERO_DIRECTION
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  /** 当前方向（已应用死区、归一化）。禁用时永远为零。 */
  get output(): MoveDirection {
    if (!this.enabled) return ZERO_DIRECTION
    return this.direction
  }

  /**
   * TouchControls.vue 在 pointermove 时调用。
   * @param nx 原始 X 偏移，已归一化到 [-1, 1]
   * @param nz 原始 Z 偏移，已归一化到 [-1, 1]（屏幕向下为 +Z）
   */
  setNormalized(nx: number, nz: number): void {
    if (!this.enabled) return

    const clampedX = Math.max(-1, Math.min(1, nx))
    const clampedZ = Math.max(-1, Math.min(1, nz))

    const length = Math.hypot(clampedX, clampedZ)
    if (length < TOUCH_DEAD_ZONE) {
      this.direction = ZERO_DIRECTION
      return
    }

    // 超出死区后，把长度映射到 [0, 1] 区间，避免刚过死区就出现跳变。
    const scaled = Math.min(1, (length - TOUCH_DEAD_ZONE) / (1 - TOUCH_DEAD_ZONE))
    this.direction = {
      x: (clampedX / length) * scaled,
      z: (clampedZ / length) * scaled,
    }
  }

  /** 清空（松手、cancel、页面失焦时调用）。 */
  clear(): void {
    this.direction = ZERO_DIRECTION
  }
}
