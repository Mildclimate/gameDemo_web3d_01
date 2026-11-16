import { describe, expect, it } from 'vitest'

import { AudioManager } from '../src/game/audio/AudioManager'

describe('AudioManager', () => {
  it('starts unmuted', () => {
    const a = new AudioManager()
    expect(a.isMuted).toBe(false)
  })

  it('toggleMute switches state', () => {
    const a = new AudioManager()
    expect(a.toggleMute()).toBe(true)
    expect(a.isMuted).toBe(true)
    expect(a.toggleMute()).toBe(false)
    expect(a.isMuted).toBe(false)
  })

  it('setMute allows explicit control', () => {
    const a = new AudioManager()
    a.setMuted(true)
    expect(a.isMuted).toBe(true)
    a.setMuted(false)
    expect(a.isMuted).toBe(false)
  })

  it('dispose() is idempotent and safe to call multiple times', () => {
    const a = new AudioManager()
    a.dispose()
    a.dispose()
    // 无异常抛出
  })

  it('unlock() is idempotent', () => {
    const a = new AudioManager()
    a.unlock()
    a.unlock()
    // 在 node 环境下 window.AudioContext 不存在，不会真正创建 ctx，不抛异常
  })

  it('playCollect / playWin / playLose do not throw in node env', () => {
    const a = new AudioManager()
    // 没有 unlock → ctx = null → 静默返回
    expect(() => a.playCollect()).not.toThrow()
    expect(() => a.playWin()).not.toThrow()
    expect(() => a.playLose()).not.toThrow()
  })
})
