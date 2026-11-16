import { describe, expect, it } from 'vitest'

import { TOUCH_DEAD_ZONE, TouchInput } from '../src/game/input/TouchInput'

describe('TouchInput', () => {
  it('disables output when not enabled', () => {
    const t = new TouchInput()
    expect(t.output).toEqual({ x: 0, z: 0 })
    t.setEnabled(false)
    t.setNormalized(0.8, 0.3)
    expect(t.output).toEqual({ x: 0, z: 0 })
  })

  it('outputs zero when below dead zone', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    // 在死区内
    const halfDead = TOUCH_DEAD_ZONE * 0.5
    t.setNormalized(halfDead, halfDead)
    expect(t.output).toEqual({ x: 0, z: 0 })
  })

  it('outputs normalized direction above dead zone', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    t.setNormalized(0.7, 0)
    expect(t.output.x).toBeGreaterThan(0)
    expect(t.output.z).toBe(0)
  })

  it('caps at length 1 and re-maps dead-zone → full', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    t.setNormalized(1, 1)
    const o = t.output
    const len = Math.hypot(o.x, o.z)
    expect(len).toBeLessThanOrEqual(1.00001)
    expect(len).toBeGreaterThan(0.9)
  })

  it('clamps input to [-1, 1]', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    t.setNormalized(5, -2)
    const o = t.output
    expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(1.00001)
  })

  it('clear() returns to zero while enabled', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    t.setNormalized(0.6, 0.6)
    expect(t.output.x).not.toBe(0)
    t.clear()
    expect(t.output).toEqual({ x: 0, z: 0 })
  })

  it('setEnabled(false) also clears', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    t.setNormalized(0.6, 0)
    t.setEnabled(false)
    expect(t.output).toEqual({ x: 0, z: 0 })
  })

  it('reflects cardinal directions correctly', () => {
    const t = new TouchInput()
    t.setEnabled(true)
    // 向右 → +X
    t.setNormalized(1, 0)
    expect(t.output.x).toBeGreaterThan(0.5)
    expect(Math.abs(t.output.z)).toBeLessThan(0.1)
    // 向下 → +Z（屏幕向下为 +Z）
    t.setNormalized(0, 1)
    expect(t.output.z).toBeGreaterThan(0.5)
    expect(Math.abs(t.output.x)).toBeLessThan(0.1)
    // 向左 → -X
    t.setNormalized(-1, 0)
    expect(t.output.x).toBeLessThan(-0.5)
    // 向上 → -Z
    t.setNormalized(0, -1)
    expect(t.output.z).toBeLessThan(-0.5)
  })
})
