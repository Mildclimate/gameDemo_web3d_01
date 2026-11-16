export interface MoveDirection {
  readonly x: number
  readonly z: number
}

const ZERO_DIRECTION: MoveDirection = { x: 0, z: 0 }

const MOVE_KEY_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

/**
 * 键盘输入：只负责收集按键并输出归一化方向向量。
 * 不修改 Player，也不修改 Camera；监听器仅在构造/销毁时注册一次。
 */
export class KeyboardInput {
  private readonly target: Window
  private readonly pressed = new Set<string>()
  private enabled = false
  private destroyed = false

  constructor(target: Window = window) {
    this.target = target
    this.target.addEventListener('keydown', this.handleKeyDown)
    this.target.addEventListener('keyup', this.handleKeyUp)
    this.target.addEventListener('blur', this.handleBlur)
    this.target.document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 当前输入方向：W/↑ = -Z，S/↓ = +Z，A/← = -X，D/→ = +X。
   * 对角线会归一化，保证与直线移动同速。
   */
  get direction(): MoveDirection {
    if (!this.enabled) return ZERO_DIRECTION

    const left = this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')
    const right = this.pressed.has('KeyD') || this.pressed.has('ArrowRight')
    const forward = this.pressed.has('KeyW') || this.pressed.has('ArrowUp')
    const backward = this.pressed.has('KeyS') || this.pressed.has('ArrowDown')

    let x = (right ? 1 : 0) - (left ? 1 : 0)
    let z = (backward ? 1 : 0) - (forward ? 1 : 0)
    if (x === 0 && z === 0) return ZERO_DIRECTION

    const length = Math.hypot(x, z)
    if (length > 1) {
      x /= length
      z /= length
    }

    return { x, z }
  }

  /** 启用时开始接收移动键；禁用时立即清空按键状态。 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.pressed.clear()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.enabled = false
    this.pressed.clear()

    this.target.removeEventListener('keydown', this.handleKeyDown)
    this.target.removeEventListener('keyup', this.handleKeyUp)
    this.target.removeEventListener('blur', this.handleBlur)
    this.target.document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || !MOVE_KEY_CODES.has(event.code)) return
    // 组合键（Cmd/Ctrl/Alt + 方向键等）不参与移动，避免与浏览器快捷键冲突。
    if (event.metaKey || event.ctrlKey || event.altKey) return

    event.preventDefault()
    this.pressed.add(event.code)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!MOVE_KEY_CODES.has(event.code)) return
    this.pressed.delete(event.code)
  }

  private readonly handleBlur = (): void => {
    this.pressed.clear()
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.target.document.hidden) this.pressed.clear()
  }
}
