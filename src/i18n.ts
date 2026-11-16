import { ref } from 'vue'

export type Locale = 'zh' | 'en'

const zh = {
  'app.qualityGroup': '画质档位',
  'app.qualityLow': '低',
  'app.qualityMedium': '中',
  'app.qualityHigh': '高',
  'app.language': '语言',
  'app.mute': '静音',
  'app.unmute': '取消静音',
  'app.phase': 'M4 · 交互优化',
  'common.bestScore': '本地最高分：',
  'footer.bestScore': '本地最高分：{score}',
  'menu.eyebrow': '星球遗迹 · 探索收集',
  'menu.description': '在废弃的星际遗迹中探索。使用 WASD 或方向键控制角色移动，摄像机将自动跟随。',
  'menu.start': '开始探索',
  'menu.note': '进入后可随时使用底部按钮返回大厅，或按 Esc 暂停。',
  'hud.score': '得分',
  'hud.crystals': '晶体',
  'hud.time': '时间',
  'hud.arrows': '方向键',
  'hud.move': '移动',
  'hud.pause': '暂停',
  'hud.pauseButton': '暂停',
  'common.backToLobby': '返回大厅',
  'common.restart': '重新开始',
  'pause.eyebrow': '系统',
  'pause.title': '已暂停',
  'pause.desc': '游戏已暂停。时间已冻结，角色停止响应输入。',
  'pause.resume': '继续游戏',
  'success.eyebrow': '任务完成',
  'success.title': '任务完成',
  'success.desc': '所有能量晶体已收集。遗迹能量核心已唤醒。',
  'result.finalScore': '最终得分',
  'success.playAgain': '再玩一次',
  'failed.eyebrow': '时间耗尽',
  'failed.title': '时间耗尽',
  'failed.desc': '遗迹能量未能在倒计时结束前激活。',
  'stats.aria': '性能监控',
  'stats.drawCalls': 'Draw Calls',
  'stats.triangles': 'Triangles',
  'stats.geometries': 'Geometries',
  'stats.textures': 'Textures',
  'stats.hint': 'F2 切换面板',
  'viewport.aria': '3D 游戏渲染区域',
  'viewport.loading': '正在构建遗迹场景…',
  'viewport.errorTitle': '3D 场景初始化失败',
  'viewport.missingMount': '未找到 3D 渲染容器。',
  'viewport.webglError': 'WebGL 初始化失败。',
  'touch.joystick': '虚拟摇杆',
} as const

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'app.qualityGroup': 'Graphics quality',
  'app.qualityLow': 'LOW',
  'app.qualityMedium': 'MEDIUM',
  'app.qualityHigh': 'HIGH',
  'app.language': 'Language',
  'app.mute': 'Mute',
  'app.unmute': 'Unmute',
  'app.phase': 'M4 · INTERACTION',
  'common.bestScore': 'Best score: ',
  'footer.bestScore': 'Best score: {score}',
  'menu.eyebrow': 'PLANETARY RUINS · EXPLORE',
  'menu.description':
    'Explore the abandoned star ruins. Use WASD or the arrow keys to move — the camera follows automatically.',
  'menu.start': 'START EXPLORING',
  'menu.note': 'Use the bottom button to return to the lobby at any time, or press Esc to pause.',
  'hud.score': 'SCORE',
  'hud.crystals': 'CRYSTALS',
  'hud.time': 'TIME',
  'hud.arrows': 'ARROWS',
  'hud.move': 'to move',
  'hud.pause': 'to pause',
  'hud.pauseButton': 'Pause',
  'common.backToLobby': 'Back to Lobby',
  'common.restart': 'Restart',
  'pause.eyebrow': 'SYSTEM',
  'pause.title': 'PAUSED',
  'pause.desc': 'Game paused. The timer is frozen and the character stops responding to input.',
  'pause.resume': 'Resume',
  'success.eyebrow': 'MISSION COMPLETE',
  'success.title': 'Mission Complete',
  'success.desc': 'All energy crystals collected. The relic core has awakened.',
  'result.finalScore': 'FINAL SCORE',
  'success.playAgain': 'Play Again',
  'failed.eyebrow': 'TIME UP',
  'failed.title': 'Time Up',
  'failed.desc': 'The relic energy was not activated before the countdown ended.',
  'stats.aria': 'Performance monitor',
  'stats.drawCalls': 'Draw Calls',
  'stats.triangles': 'Triangles',
  'stats.geometries': 'Geometries',
  'stats.textures': 'Textures',
  'stats.hint': 'F2 toggle panel',
  'viewport.aria': '3D game viewport',
  'viewport.loading': 'Building the ruins scene…',
  'viewport.errorTitle': 'Failed to initialize the 3D scene',
  'viewport.missingMount': '3D mount container not found.',
  'viewport.webglError': 'WebGL initialization failed.',
  'touch.joystick': 'Virtual joystick',
}

const messages: Record<Locale, Record<MessageKey, string>> = { zh, en }

const STORAGE_KEY = 'astra-locale'

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'zh' || stored === 'en' ? stored : null
  } catch {
    return null
  }
}

function detectLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

function applyDocumentLang(next: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  }
}

/** 当前语言（响应式，可在模板中直接使用）。 */
export const locale = ref<Locale>(detectLocale())
applyDocumentLang(locale.value)

export function setLocale(next: Locale): void {
  if (locale.value === next) return
  locale.value = next
  applyDocumentLang(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 隐私模式等场景下忽略持久化失败
  }
}

/** 取当前语言的文案，支持 {name} 占位符。 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = messages[locale.value][key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
