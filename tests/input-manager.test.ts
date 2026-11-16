import { describe, expect, it } from 'vitest'

import { InputManager } from '../src/game/input/InputManager'
import { KeyboardInput } from '../src/game/input/KeyboardInput'
import { TouchInput } from '../src/game/input/TouchInput'

/** 模拟 window，让 KeyboardInput 能在 node 环境下注册监听器。 */
function makeMockWindow() {
  const listeners = new Map<string, EventListener[]>()
  const target: unknown = {
    addEventListener: (type: string, handler: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type)!.push(handler)
    },
    removeEventListener: (type: string, handler: EventListener) => {
      const arr = listeners.get(type)
      if (arr) {
        const idx = arr.indexOf(handler)
        if (idx >= 0) arr.splice(idx, 1)
      }
    },
    dispatchEvent: (event: Event) => {
      const arr = listeners.get(event.type)
      if (arr) for (const h of arr) h(event)
      return true
    },
    document: { addEventListener: () => {}, removeEventListener: () => {} },
    blur: () => {},
  }
  return { target: target as Window, listeners }
}

/** 构造一个轻量 KeyboardEvent 替身（node 无 DOM）。 */
function fakeKeyEvent(type: string, code: string): KeyboardEvent {
  return {
    type,
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: () => {},
    stopPropagation: () => {},
    defaultPrevented: false,
  } as unknown as KeyboardEvent
}

function makeManager(): { manager: InputManager; mock: ReturnType<typeof makeMockWindow> } {
  const mock = makeMockWindow()
  const keyboard = new KeyboardInput(mock.target)
  const touch = new TouchInput()
  const manager = new InputManager(keyboard, touch)
  return { manager, mock }
}

describe('InputManager', () => {
  it('outputs zero when both sources are zero', () => {
    const { manager } = makeManager()
    manager.setEnabled(true)
    expect(manager.direction).toEqual({ x: 0, z: 0 })
  })

  it('uses keyboard direction when touch is zero', () => {
    const { manager, mock } = makeManager()
    manager.setEnabled(true)

    mock.target.dispatchEvent(fakeKeyEvent('keydown', 'KeyD'))

    expect(manager.direction.x).toBeGreaterThan(0)
    expect(Math.abs(manager.direction.z)).toBeLessThan(0.01)

    mock.target.dispatchEvent(fakeKeyEvent('keyup', 'KeyD'))
  })

  it('uses touch direction when keyboard is zero', () => {
    const { manager } = makeManager()
    manager.setEnabled(true)
    manager.touchInput.setNormalized(0.5, 0.5)

    const o = manager.direction
    expect(o.x).toBeGreaterThan(0)
    expect(o.z).toBeGreaterThan(0)
    expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(1.00001)
  })

  it('combines both sources without either overriding the other', () => {
    const { manager, mock } = makeManager()
    manager.setEnabled(true)

    mock.target.dispatchEvent(fakeKeyEvent('keydown', 'KeyD'))
    manager.touchInput.setNormalized(0, 0.6)

    const o = manager.direction
    expect(o.x).toBeGreaterThan(0)
    expect(o.z).toBeGreaterThan(0)
    expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(1.00001)

    mock.target.dispatchEvent(fakeKeyEvent('keyup', 'KeyD'))
  })

  it('clears both sources when disabled', () => {
    const { manager, mock } = makeManager()
    manager.setEnabled(true)
    mock.target.dispatchEvent(fakeKeyEvent('keydown', 'KeyD'))
    manager.touchInput.setNormalized(0.5, 0.5)

    manager.setEnabled(false)
    expect(manager.direction).toEqual({ x: 0, z: 0 })

    mock.target.dispatchEvent(fakeKeyEvent('keyup', 'KeyD'))
  })

  it('normalizes combined diagonal input', () => {
    const { manager, mock } = makeManager()
    manager.setEnabled(true)

    mock.target.dispatchEvent(fakeKeyEvent('keydown', 'KeyD'))
    manager.touchInput.setNormalized(1, 0)

    const o = manager.direction
    expect(Math.abs(o.x)).toBeGreaterThan(0.5)
    expect(Math.abs(o.z)).toBeLessThan(0.01)
    expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(1.00001)

    mock.target.dispatchEvent(fakeKeyEvent('keyup', 'KeyD'))
  })
})
