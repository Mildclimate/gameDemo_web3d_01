import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HighScoreStorage } from '../src/game/utils/HighScoreStorage'

// 在 vitest 中 HighScoreStorage 默认使用内存 fallback，
// 但我们用 stubGlobal 也覆盖 localStorage 分支。

describe('HighScoreStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 0 when no score has been saved', () => {
    const s = new HighScoreStorage()
    expect(s.get()).toBe(0)
  })

  it('stores and reads a high score', () => {
    const s = new HighScoreStorage()
    const ok = s.tryUpdate(500)
    expect(ok).toBe(true)
    expect(s.get()).toBe(500)
  })

  it('does not update when score is not higher', () => {
    const s = new HighScoreStorage()
    s.tryUpdate(500)
    expect(s.tryUpdate(300)).toBe(false)
    expect(s.get()).toBe(500)
    expect(s.tryUpdate(500)).toBe(false)
    expect(s.get()).toBe(500)
  })

  it('updates on new record', () => {
    const s = new HighScoreStorage()
    s.tryUpdate(100)
    s.tryUpdate(300)
    expect(s.get()).toBe(300)
  })

  it('ignores non-positive scores', () => {
    const s = new HighScoreStorage()
    expect(s.tryUpdate(0)).toBe(false)
    expect(s.tryUpdate(-5)).toBe(false)
    expect(s.tryUpdate(Number.NaN)).toBe(false)
    expect(s.get()).toBe(0)
  })

  it('clear() resets storage', () => {
    const s = new HighScoreStorage()
    s.tryUpdate(800)
    s.clear()
    expect(s.get()).toBe(0)
  })
})

describe('HighScoreStorage — corrupted localStorage', () => {
  it('falls back to 0 when localStorage value is not a number', () => {
    const fakeStorage = new Map<string, string>([['astra.highScore.v1', 'not-a-number']])
    const fakeLS = {
      getItem: (k: string) => fakeStorage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        fakeStorage.set(k, v)
      },
      removeItem: (k: string) => {
        fakeStorage.delete(k)
      },
    }

    // vi.stubGlobal 让构造时 window.localStorage 存在
    vi.stubGlobal('window', { localStorage: fakeLS })

    // 但 HighScoreStorage 在 module 顶层读取 window，所以需要：
    // 因为构造函数里 typeof window !== 'undefined'，stubGlobal 会让 HighScoreStorage 走 localStorage 分支
    const s = new HighScoreStorage()
    expect(s.get()).toBe(0) // 解析失败 → 0

    vi.unstubAllGlobals()
  })

  it('falls back when localStorage.getItem throws', () => {
    const throwingLS = {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('quota')
      },
    }
    vi.stubGlobal('window', { localStorage: throwingLS })
    // 在构造时就能捕获到
    expect(() => new HighScoreStorage()).not.toThrow()
    vi.unstubAllGlobals()
  })
})
