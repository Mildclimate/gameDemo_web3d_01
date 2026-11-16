import type { GameQuality } from '../../types/game'

export interface QualitySettings {
  /** devicePixelRatio 上限。 */
  readonly maxPixelRatio: number
  /** 是否启用阴影（renderer.shadowMap.enabled 以及 DirectionalLight.castShadow）。 */
  readonly shadowsEnabled: boolean
  /** 主方向光阴影贴图尺寸（shadowsEnabled 为 false 时忽略）。 */
  readonly shadowMapSize: number
  /** 雾效近裁剪（near plane 距离开始处）。 */
  readonly fogNear: number
  /** 雾效远裁剪（far plane 距离完全不透明处）。 */
  readonly fogFar: number
  /** 阴影 bias 微调（low 档关闭阴影时仍给个保守值）。 */
  readonly shadowBias: number
}

/** 默认档位：兼顾普通笔记本与移动端。 */
export const DEFAULT_QUALITY: GameQuality = 'medium'

export const QUALITY_PRESETS: Record<GameQuality, QualitySettings> = {
  low: {
    maxPixelRatio: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    // 简化雾效：拉远范围，减少被雾隐藏的几何物体处理
    fogNear: 40,
    fogFar: 90,
    shadowBias: -0.0005,
  },
  medium: {
    maxPixelRatio: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    fogNear: 34,
    fogFar: 80,
    shadowBias: -0.0005,
  },
  high: {
    maxPixelRatio: 2,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    fogNear: 30,
    fogFar: 70,
    shadowBias: -0.0004,
  },
} as const

/** 校验输入，非法值回退到默认档位。 */
export function sanitizeQuality(value: string | null | undefined): GameQuality {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return DEFAULT_QUALITY
}
