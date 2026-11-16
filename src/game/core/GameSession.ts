import { getEffectiveDuration, TOTAL_COLLECTIBLES } from '../config/gameConfig'
import type { GameState } from '../../types/game'

/**
 * 纯逻辑游戏会话：管理一局的状态、时间、分数和收集进度。
 * 不依赖 Three.js、Vue 或 DOM，可独立单元测试。
 *
 * 状态机：
 *   menu → loading → playing
 *   playing → paused → playing
 *   playing → success | failed
 *   success | failed → loading → playing   (restart)
 *   playing | paused | success | failed → menu   (exit)
 *
 * 非法转换会被静默拒绝（返回 false），不抛异常。
 */

type ValidTransition = {
  readonly from: GameState
  readonly to: GameState
}

/** 所有合法状态转换。 */
const VALID_TRANSITIONS: ReadonlyArray<ValidTransition> = [
  // 进入游戏流程
  { from: 'menu', to: 'loading' },
  { from: 'loading', to: 'playing' },

  // 暂停/恢复
  { from: 'playing', to: 'paused' },
  { from: 'paused', to: 'playing' },

  // 胜负结算
  { from: 'playing', to: 'success' },
  { from: 'playing', to: 'failed' },

  // 从结算重开
  { from: 'success', to: 'loading' },
  { from: 'failed', to: 'loading' },

  // 回到大厅（任何非 menu/loading 状态都可以退出）
  { from: 'playing', to: 'menu' },
  { from: 'paused', to: 'menu' },
  { from: 'success', to: 'menu' },
  { from: 'failed', to: 'menu' },
]

function canTransition(from: GameState, to: GameState): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to)
}

export interface GameSessionSnapshot {
  readonly status: GameState
  readonly score: number
  readonly collectedCount: number
  readonly totalCollectibles: number
  readonly remainingTime: number
  readonly elapsedTime: number
}

export interface GameSessionEvents {
  onStateChanged?: (state: GameState) => void
  onScoreChanged?: (score: number, collected: number) => void
  onTimerUpdated?: (remainingSeconds: number) => void
  onGameWon?: () => void
  onGameOver?: () => void
  onExitToMenu?: () => void
  onRestarted?: () => void
}

export class GameSession {
  private status: GameState = 'menu'
  private score = 0
  private collectedCount = 0
  private remainingTime = 0
  private elapsedTime = 0
  private totalCollectibles = TOTAL_COLLECTIBLES
  private ended = false
  private lastEmittedSecond = -1

  private readonly events: GameSessionEvents

  constructor(events: GameSessionEvents = {}) {
    this.events = events
    this.totalCollectibles = TOTAL_COLLECTIBLES
    this.remainingTime = getEffectiveDuration()
  }

  /** 当前状态快照（只读）。 */
  get snapshot(): GameSessionSnapshot {
    return {
      status: this.status,
      score: this.score,
      collectedCount: this.collectedCount,
      totalCollectibles: this.totalCollectibles,
      remainingTime: this.remainingTime,
      elapsedTime: this.elapsedTime,
    }
  }

  /** 当前状态（只读）。 */
  get currentState(): GameState {
    return this.status
  }

  /** 是否处于可以接收游戏输入/更新的状态。 */
  get isActive(): boolean {
    return this.status === 'playing'
  }

  /** 是否处于结束状态（胜利或失败）。 */
  get isEnded(): boolean {
    return this.status === 'success' || this.status === 'failed'
  }

  /**
   * 请求状态转换。只有合法转换会生效。
   * @returns 是否真正执行了转换
   */
  private transition(to: GameState): boolean {
    if (!canTransition(this.status, to)) return false
    this.status = to
    this.events.onStateChanged?.(to)
    return true
  }

  /** 从菜单开始新游戏：menu → loading。 */
  start(): boolean {
    if (this.status !== 'menu') return false
    this.transition('loading')
    // 真正进入 playing 由 notifyReady 触发，允许外部加载资源
    return true
  }

  /** 资源加载完毕，loading → playing。 */
  notifyReady(): boolean {
    if (this.status !== 'loading') return false
    this.resetGameData()
    this.transition('playing')
    this.emitTimerUpdate()
    return true
  }

  /** 暂停：playing → paused。 */
  pause(): boolean {
    if (this.status !== 'playing') return false
    return this.transition('paused')
  }

  /** 恢复：paused → playing。 */
  resume(): boolean {
    if (this.status !== 'paused') return false
    return this.transition('playing')
  }

  /** 重新开始：success/failed → loading（随后 notifyReady → playing）。 */
  restart(): boolean {
    if (this.status === 'loading') return false

    // 如果当前在 playing/paused，先回到 loading
    if (this.status === 'playing' || this.status === 'paused') {
      this.resetGameData()
      this.ended = false
      this.transition('loading')
      this.events.onRestarted?.()
      return true
    }

    if (this.status === 'success' || this.status === 'failed') {
      this.resetGameData()
      this.ended = false
      this.transition('loading')
      this.events.onRestarted?.()
      return true
    }

    return false
  }

  /** 退出到大厅：任何非 menu 状态 → menu。 */
  exitToMenu(): boolean {
    if (this.status === 'menu') return false
    const result = this.transition('menu')
    if (result) {
      this.resetGameData()
      this.ended = false
      this.events.onExitToMenu?.()
    }
    return result
  }

  /**
   * 帧更新。只在 playing 状态下推进时间。
   * @param deltaSeconds 帧间隔（秒）
   */
  update(deltaSeconds: number): void {
    if (this.status !== 'playing' || this.ended) return

    this.elapsedTime += deltaSeconds
    this.remainingTime = Math.max(0, this.remainingTime - deltaSeconds)

    this.emitTimerUpdate()

    if (this.remainingTime <= 0) {
      this.triggerGameOver()
    }
  }

  /**
   * 收集一个晶体。
   * @param scoreDelta 该晶体贡献的分数（通常是 COLLECTIBLE_SCORE）
   * @returns 是否成功收集（只有 playing 状态且未结束时才返回 true）
   */
  collect(scoreDelta: number): boolean {
    if (this.status !== 'playing' || this.ended) return false

    this.score += scoreDelta
    this.collectedCount += 1

    this.events.onScoreChanged?.(this.score, this.collectedCount)

    if (this.collectedCount >= this.totalCollectibles) {
      this.triggerGameWon()
    }

    return true
  }

  /**
   * 强制结束游戏（外部调用，如渲染器检测到不可恢复错误）。
   */
  forceEnd(state: 'success' | 'failed'): void {
    if (this.ended) return
    if (state === 'success') this.triggerGameWon()
    else this.triggerGameOver()
  }

  // ---------- 私有辅助 ----------

  private resetGameData(): void {
    this.score = 0
    this.collectedCount = 0
    this.elapsedTime = 0
    this.remainingTime = getEffectiveDuration()
    this.ended = false
    this.lastEmittedSecond = -1
  }

  private emitTimerUpdate(): void {
    const currentSecond = Math.ceil(this.remainingTime)
    if (currentSecond !== this.lastEmittedSecond) {
      this.lastEmittedSecond = currentSecond
      this.events.onTimerUpdated?.(currentSecond)
    }
  }

  private triggerGameWon(): void {
    if (this.ended) return
    this.ended = true
    this.transition('success')
    this.events.onGameWon?.()
  }

  private triggerGameOver(): void {
    if (this.ended) return
    this.ended = true
    this.transition('failed')
    this.events.onGameOver?.()
  }
}
