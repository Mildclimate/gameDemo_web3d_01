const STORAGE_KEY = 'astra.highScore.v1'

/**
 * 最高分 localStorage 存取工具。
 * 不在 GameSession 或 GameRuntime 内部操作 DOM Storage，
 * 保持可在非浏览器环境下回退到内存实现。
 */
export class HighScoreStorage {
  private readonly storage: Storage | null
  /** 离屏回退（SSR / storage 不可用时）。 */
  private fallback = 0

  constructor() {
    let storage: Storage | null = null
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        storage = window.localStorage
        // 读一次确认可用
        storage.getItem(STORAGE_KEY)
      }
    } catch {
      storage = null
    }
    this.storage = storage
  }

  /** 读取最高分；没有或损坏时返回 0。 */
  get(): number {
    if (!this.storage) return this.fallback
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (raw === null) return 0
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed < 0) return 0
      return parsed
    } catch {
      return 0
    }
  }

  /**
   * 尝试更新最高分。
   * @returns 是否刷新了纪录
   */
  tryUpdate(score: number): boolean {
    if (!Number.isFinite(score) || score <= 0) return false
    if (score <= this.get()) return false

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, String(score))
      } catch {
        this.fallback = score
      }
    } else {
      this.fallback = score
    }
    return true
  }

  /** 清除（方便测试）。 */
  clear(): void {
    this.fallback = 0
    try {
      this.storage?.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
