import { describe, expect, it } from 'vitest'

import {
  createArenaBounds,
  isInsideArena,
  moveWithCollisions,
  resolveCollisions,
} from '../src/game/systems/collision'

function octagon(segments = 8, radius = 15.1, wallThickness = 0.6) {
  return { boundarySegments: segments, boundaryRadius: radius, wallThickness }
}

describe('collision — arena bounds', () => {
  it('player at origin is inside arena', () => {
    const bounds = createArenaBounds(octagon(), 0.45)
    expect(isInsideArena(0, 0, bounds)).toBe(true)
  })

  it('player beyond boundary radius is outside', () => {
    const bounds = createArenaBounds(octagon(), 0.45)
    expect(isInsideArena(14, 0, bounds)).toBe(true)
    expect(isInsideArena(15.5, 0, bounds)).toBe(false)
  })
})

describe('collision — push out of box obstacle', () => {
  it('circle is pushed out of box center', () => {
    const bounds = createArenaBounds(octagon(), 0.45)
    const obstacles = [{ kind: 'box' as const, x: 0, z: 0, halfWidth: 1, halfDepth: 1, rotation: 0 }]

    const result = resolveCollisions(0, 0, 0.45, bounds, obstacles)
    // After push, the circle center must be pushed out of the box along the axis of least penetration
    expect(result.x).not.toBe(0)
  })
})

describe('collision — moveWithCollisions stops at boundary', () => {
  it('large displacement toward wall gets constrained', () => {
    const bounds = createArenaBounds(octagon(), 0.45)
    const obstacles: readonly [] = []

    const result = moveWithCollisions(
      { x: 0, z: 0 },
      { x: 50, z: 0 },
      0.45,
      bounds,
      obstacles,
      0.15,
    )

    expect(isInsideArena(result.x, result.z, bounds)).toBe(true)
    expect(result.x).toBeLessThan(16)
  })
})

describe('collision — moveWithCollisions with circle obstacle', () => {
  it('player cannot walk through circle obstacle', () => {
    const bounds = createArenaBounds(octagon(), 0.45)
    const obstacles = [{ kind: 'circle' as const, x: 5, z: 0, radius: 1.5 }]

    const result = moveWithCollisions(
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      0.45,
      bounds,
      obstacles,
      0.15,
    )

    // Player should stop before obstacle surface
    const distance = Math.hypot(result.x - 5, result.z - 0)
    expect(distance).toBeGreaterThanOrEqual(1.5 + 0.45 - 0.01)
  })
})

describe('collision — zero displacement returns same position', () => {
  it('no move means no change', () => {
    const bounds = createArenaBounds(octagon(), 0.45)

    const result = moveWithCollisions(
      { x: 3, z: 4 },
      { x: 0, z: 0 },
      0.45,
      bounds,
      [],
      0.15,
    )

    expect(result.x).toBe(3)
    expect(result.z).toBe(4)
  })
})
