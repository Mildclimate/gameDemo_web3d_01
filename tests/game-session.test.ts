import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COLLECTIBLE_SCORE, GAME_DURATION, TOTAL_COLLECTIBLES } from '../src/game/config/gameConfig'
import { GameSession } from '../src/game/core/GameSession'

function freshSession(events = {}) {
  return new GameSession(events)
}

describe('GameSession — initial state', () => {
  it('starts at menu with zero score and full time', () => {
    const s = freshSession()
    expect(s.currentState).toBe('menu')
    expect(s.snapshot.score).toBe(0)
    expect(s.snapshot.collectedCount).toBe(0)
    expect(s.snapshot.totalCollectibles).toBe(TOTAL_COLLECTIBLES)
    expect(s.snapshot.remainingTime).toBe(GAME_DURATION)
    expect(s.snapshot.elapsedTime).toBe(0)
    expect(s.isActive).toBe(false)
    expect(s.isEnded).toBe(false)
  })
})

describe('GameSession — legal state transitions', () => {
  it('menu → loading via start()', () => {
    const s = freshSession()
    const ok = s.start()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('loading')
  })

  it('loading → playing via notifyReady()', () => {
    const s = freshSession()
    s.start()
    const ok = s.notifyReady()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('playing')
    expect(s.isActive).toBe(true)
  })

  it('playing → paused via pause()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    const ok = s.pause()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('paused')
    expect(s.isActive).toBe(false)
  })

  it('paused → playing via resume()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.pause()
    const ok = s.resume()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('playing')
    expect(s.isActive).toBe(true)
  })

  it('success → loading via restart()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    // trigger win
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    expect(s.currentState).toBe('success')
    const ok = s.restart()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('loading')
  })

  it('failed → loading via restart()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.update(GAME_DURATION + 1)
    expect(s.currentState).toBe('failed')
    const ok = s.restart()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('loading')
  })

  it('any non-menu state → menu via exitToMenu()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    const ok = s.exitToMenu()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('menu')
  })

  it('paused → menu via exitToMenu()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.pause()
    const ok = s.exitToMenu()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('menu')
  })

  it('success → menu via exitToMenu()', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    const ok = s.exitToMenu()
    expect(ok).toBe(true)
    expect(s.currentState).toBe('menu')
  })
})

describe('GameSession — illegal state transitions are rejected', () => {
  it('start() from loading is rejected', () => {
    const s = freshSession()
    s.start()
    expect(s.start()).toBe(false)
    expect(s.currentState).toBe('loading')
  })

  it('pause() from menu is rejected', () => {
    const s = freshSession()
    expect(s.pause()).toBe(false)
    expect(s.currentState).toBe('menu')
  })

  it('pause() from paused is rejected', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.pause()
    expect(s.pause()).toBe(false)
    expect(s.currentState).toBe('paused')
  })

  it('resume() from playing is rejected', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    expect(s.resume()).toBe(false)
    expect(s.currentState).toBe('playing')
  })

  it('restart() from menu is rejected', () => {
    const s = freshSession()
    expect(s.restart()).toBe(false)
    expect(s.currentState).toBe('menu')
  })

  it('restart() from loading is rejected', () => {
    const s = freshSession()
    s.start()
    expect(s.restart()).toBe(false)
    expect(s.currentState).toBe('loading')
  })

  it('exitToMenu() from menu is rejected', () => {
    const s = freshSession()
    expect(s.exitToMenu()).toBe(false)
    expect(s.currentState).toBe('menu')
  })
})

describe('GameSession — pause freezes time', () => {
  it('remainingTime does not decrease while paused', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    const beforePause = s.snapshot.remainingTime

    s.pause()
    s.update(60)
    expect(s.snapshot.remainingTime).toBeCloseTo(beforePause, 0)

    s.resume()
    s.update(5)
    expect(s.snapshot.remainingTime).toBeLessThan(beforePause - 1)
  })
})

describe('GameSession — restart resets all data', () => {
  it('after restart, score and collectedCount return to zero', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.collect(COLLECTIBLE_SCORE)
    s.collect(COLLECTIBLE_SCORE)
    expect(s.snapshot.score).toBe(COLLECTIBLE_SCORE * 2)
    expect(s.snapshot.collectedCount).toBe(2)

    // Force win
    for (let i = 0; i < TOTAL_COLLECTIBLES - 2; i++) s.collect(COLLECTIBLE_SCORE)
    expect(s.currentState).toBe('success')

    s.restart()
    s.notifyReady()
    expect(s.snapshot.score).toBe(0)
    expect(s.snapshot.collectedCount).toBe(0)
    expect(s.snapshot.elapsedTime).toBe(0)
    expect(s.snapshot.remainingTime).toBe(GAME_DURATION)
    expect(s.currentState).toBe('playing')
  })
})

describe('GameSession — collect only works once per call', () => {
  it('collect returns true only in playing state and increments correctly', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    expect(s.collect(COLLECTIBLE_SCORE)).toBe(true)
    expect(s.snapshot.score).toBe(COLLECTIBLE_SCORE)
    expect(s.snapshot.collectedCount).toBe(1)
  })

  it('collect from menu returns false', () => {
    const s = freshSession()
    expect(s.collect(COLLECTIBLE_SCORE)).toBe(false)
  })

  it('collect from paused returns false', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.pause()
    expect(s.collect(COLLECTIBLE_SCORE)).toBe(false)
  })

  it('collect after success returns false', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    expect(s.currentState).toBe('success')
    expect(s.collect(COLLECTIBLE_SCORE)).toBe(false)
  })

  it('collect after failed returns false', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.update(GAME_DURATION + 1)
    expect(s.currentState).toBe('failed')
    expect(s.collect(COLLECTIBLE_SCORE)).toBe(false)
  })
})

describe('GameSession — score calculation', () => {
  it('five crystals × COLLECTIBLE_SCORE yields correct total', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    expect(s.snapshot.score).toBe(TOTAL_COLLECTIBLES * COLLECTIBLE_SCORE)
    expect(s.snapshot.collectedCount).toBe(TOTAL_COLLECTIBLES)
  })

  it('each collect only adds its delta once', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.collect(COLLECTIBLE_SCORE)
    s.collect(COLLECTIBLE_SCORE)
    s.collect(COLLECTIBLE_SCORE)
    expect(s.snapshot.score).toBe(COLLECTIBLE_SCORE * 3)
  })
})

describe('GameSession — collecting all crystals triggers success', () => {
  it('transitions to success after collecting total', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    expect(s.currentState).toBe('success')
    expect(s.isEnded).toBe(true)
  })
})

describe('GameSession — timer to zero triggers failure', () => {
  it('transitions to failed when remainingTime ≤ 0', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.update(GAME_DURATION + 10)
    expect(s.snapshot.remainingTime).toBe(0)
    expect(s.currentState).toBe('failed')
    expect(s.isEnded).toBe(true)
  })
})

describe('GameSession — no double-trigger for end events', () => {
  it('GAME_WON fires at most once', () => {
    const onWon = vi.fn()
    const s = freshSession({ onGameWon: onWon })
    s.start()
    s.notifyReady()
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) s.collect(COLLECTIBLE_SCORE)
    expect(onWon).toHaveBeenCalledTimes(1)
    // extra collects should not re-trigger
    s.collect(COLLECTIBLE_SCORE)
    expect(onWon).toHaveBeenCalledTimes(1)
  })

  it('GAME_OVER fires at most once', () => {
    const onOver = vi.fn()
    const s = freshSession({ onGameOver: onOver })
    s.start()
    s.notifyReady()
    s.update(GAME_DURATION + 10)
    expect(onOver).toHaveBeenCalledTimes(1)
    s.update(100)
    expect(onOver).toHaveBeenCalledTimes(1)
  })
})

describe('GameSession — events are emitted correctly', () => {
  it('STATE_CHANGED on start/notifyReady', () => {
    const onState = vi.fn()
    const s = freshSession({ onStateChanged: onState })
    s.start()
    s.notifyReady()
    expect(onState).toHaveBeenCalledWith('loading')
    expect(onState).toHaveBeenCalledWith('playing')
  })

  it('SCORE_CHANGED on each collect', () => {
    const onScore = vi.fn()
    const s = freshSession({ onScoreChanged: onScore })
    s.start()
    s.notifyReady()
    s.collect(COLLECTIBLE_SCORE)
    expect(onScore).toHaveBeenCalledWith(COLLECTIBLE_SCORE, 1)
  })

  it('TIMER_UPDATED emitted per-second granularity', () => {
    const onTimer = vi.fn()
    const s = freshSession({ onTimerUpdated: onTimer })
    s.start()
    s.notifyReady()
    s.update(2.5)
    // Should emit roughly GAME_DURATION, GAME_DURATION-1, ...
    expect(onTimer.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('EXIT_TO_MENU callback fires on exit', () => {
    const onExit = vi.fn()
    const s = freshSession({ onExitToMenu: onExit })
    s.start()
    s.notifyReady()
    s.exitToMenu()
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('GameSession — exitToMenu resets data', () => {
  it('after exit, score/collected/time are clean for next start', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.collect(COLLECTIBLE_SCORE)
    s.collect(COLLECTIBLE_SCORE)
    s.exitToMenu()

    s.start()
    s.notifyReady()
    expect(s.snapshot.score).toBe(0)
    expect(s.snapshot.collectedCount).toBe(0)
    expect(s.snapshot.remainingTime).toBe(GAME_DURATION)
  })
})

describe('GameSession — elapsed time tracking', () => {
  it('elapsed accumulates only while playing', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.update(10)
    expect(s.snapshot.elapsedTime).toBeCloseTo(10, 1)

    s.pause()
    s.update(20)
    expect(s.snapshot.elapsedTime).toBeCloseTo(10, 1)

    s.resume()
    s.update(5)
    expect(s.snapshot.elapsedTime).toBeCloseTo(15, 1)
  })
})

describe('GameSession — end prevents further countdown', () => {
  it('after failure, update does not further decrement remainingTime', () => {
    const s = freshSession()
    s.start()
    s.notifyReady()
    s.update(GAME_DURATION + 5) // consumes remainingTime to 0 and triggers end
    expect(s.snapshot.remainingTime).toBe(0)
    expect(s.currentState).toBe('failed')

    // After end, further updates are skipped entirely
    const elapsedAfterEnd = s.snapshot.elapsedTime
    s.update(999)
    expect(s.snapshot.remainingTime).toBe(0)
    // elapsedTime should NOT grow after end is triggered
    expect(s.snapshot.elapsedTime).toBeCloseTo(elapsedAfterEnd, 3)
  })
})

// beforeEach for isolation
beforeEach(() => {
  vi.clearAllMocks()
})
