import { describe, expect, it } from 'vitest'

import { DEFAULT_QUALITY, QUALITY_PRESETS, sanitizeQuality } from '../src/game/config/qualityConfig'

describe('qualityConfig', () => {
  it('defines all three presets', () => {
    expect(QUALITY_PRESETS.low).toBeDefined()
    expect(QUALITY_PRESETS.medium).toBeDefined()
    expect(QUALITY_PRESETS.high).toBeDefined()
  })

  it('low has lower pixel ratio than high', () => {
    expect(QUALITY_PRESETS.low.maxPixelRatio).toBeLessThanOrEqual(
      QUALITY_PRESETS.high.maxPixelRatio,
    )
  })

  it('low has shadows disabled', () => {
    expect(QUALITY_PRESETS.low.shadowsEnabled).toBe(false)
  })

  it('medium and high have shadows enabled', () => {
    expect(QUALITY_PRESETS.medium.shadowsEnabled).toBe(true)
    expect(QUALITY_PRESETS.high.shadowsEnabled).toBe(true)
  })

  it('low fog extends further than high', () => {
    expect(QUALITY_PRESETS.low.fogFar).toBeGreaterThan(QUALITY_PRESETS.high.fogFar)
  })

  it('medium shadow map size ≤ high shadow map size', () => {
    expect(QUALITY_PRESETS.medium.shadowMapSize).toBeLessThanOrEqual(
      QUALITY_PRESETS.high.shadowMapSize,
    )
  })

  it('sanitizeQuality passes through valid values', () => {
    expect(sanitizeQuality('low')).toBe('low')
    expect(sanitizeQuality('medium')).toBe('medium')
    expect(sanitizeQuality('high')).toBe('high')
  })

  it('sanitizeQuality falls back to default for invalid values', () => {
    expect(sanitizeQuality(undefined)).toBe(DEFAULT_QUALITY)
    expect(sanitizeQuality(null)).toBe(DEFAULT_QUALITY)
    expect(sanitizeQuality('ultra')).toBe(DEFAULT_QUALITY)
    expect(sanitizeQuality('')).toBe(DEFAULT_QUALITY)
  })
})
