import type { MoveDirection } from './KeyboardInput'
import { TouchInput } from './TouchInput'
import { KeyboardInput } from './KeyboardInput'

const ZERO_DIRECTION: MoveDirection = { x: 0, z: 0 }

/**
 * 统一输入管理层：合并键盘与触控摇杆的 MoveDirection，
 * 输出一个方向给 MovementSystem。
 *
 * 合并策略：
 * - 键盘与触控方向向量直接相加后再归一化（长度 > 1 时）。
 * - 这样在两个来源同时有输入时，不会出现某一方"覆盖"另一方。
 * - 任一来源输出非零向量即视为有效输入。
 */
export class InputManager {
  private readonly keyboard: KeyboardInput
  private readonly touch: TouchInput

  constructor(keyboard: KeyboardInput, touch: TouchInput) {
    this.keyboard = keyboard
    this.touch = touch
  }

  get keyboardInput(): KeyboardInput {
    return this.keyboard
  }

  get touchInput(): TouchInput {
    return this.touch
  }

  /** 当前合并后的移动方向。 */
  get direction(): MoveDirection {
    const k = this.keyboard.direction
    const t = this.touch.output

    let x = k.x + t.x
    let z = k.z + t.z

    if (x === 0 && z === 0) return ZERO_DIRECTION

    const length = Math.hypot(x, z)
    if (length > 1) {
      x /= length
      z /= length
    }

    return { x, z }
  }

  /** 两者均启用时调用。 */
  setEnabled(enabled: boolean): void {
    this.keyboard.setEnabled(enabled)
    this.touch.setEnabled(enabled)
    if (!enabled) this.touch.clear()
  }
}
