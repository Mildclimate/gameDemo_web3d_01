<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { TOTAL_COLLECTIBLES } from './game/config/gameConfig'
import GameMenu from './components/GameMenu.vue'
import GameViewport from './components/GameViewport.vue'
import TouchControls from './components/TouchControls.vue'
import type { AudioManager } from './game/audio/AudioManager'
import type { TouchInput } from './game/input/TouchInput'
import type { GameEvent, GameQuality, GameState } from './types/game'
import { locale, setLocale, t, type MessageKey } from './i18n'

const viewportRef = ref<InstanceType<typeof GameViewport> | null>(null)

// ---------- UI 状态（纯展示，不含 Three.js 对象） ----------
const gameState = ref<GameState>('menu')
const score = ref(0)
const collected = ref(0)
const remainingSeconds = ref(120)
const finalScore = ref(0)
const finalCollected = ref(0)
const hasEnded = ref(false)
const highScore = ref(0)
const currentQuality = ref<GameQuality>('medium')
const isMuted = ref(false)

interface ScorePopup {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly score: number
}
const scorePopups = ref<ScorePopup[]>([])
let popupIdCounter = 0

const QUALITY_OPTIONS: ReadonlyArray<{ value: GameQuality; label: MessageKey }> = [
  { value: 'low', label: 'app.qualityLow' },
  { value: 'medium', label: 'app.qualityMedium' },
  { value: 'high', label: 'app.qualityHigh' },
]

// 开发模式性能面板
const IS_DEV = import.meta.env.DEV
const devStats = ref({ drawCalls: 0, triangles: 0, geometries: 0, textures: 0 })
const devPanelVisible = ref(IS_DEV) // 默认开发模式显示
let devPanelTimer: ReturnType<typeof setInterval> | null = null

// FPS（所有模式显示）
const fps = ref(0)
let fpsTimer: ReturnType<typeof setInterval> | null = null

// 运行时引用
let touchReceiver: TouchInput | null = null
let audio: AudioManager | null = null

const total = TOTAL_COLLECTIBLES

// ---------- 状态派生 ----------
const showMenu = computed(() => gameState.value === 'menu')
const showHud = computed(() => gameState.value === 'playing')
const showPause = computed(() => gameState.value === 'paused')
const showSuccess = computed(() => gameState.value === 'success')
const showFailed = computed(() => gameState.value === 'failed')

const formattedTime = computed(() => {
  const s = Math.max(0, remainingSeconds.value)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
})

const isLowTime = computed(() => remainingSeconds.value <= 15)

function loadRuntime(): void {
  const rt = viewportRef.value?.getRuntime()
  if (!rt) return
  touchReceiver = rt.getTouchReceiver()
  audio = rt.getAudioManager()
  highScore.value = rt.getHighScore()
}

function refreshHighScore(): void {
  highScore.value = viewportRef.value?.getRuntime()?.getHighScore() ?? highScore.value
}

function toggleMute(): void {
  audio?.unlock()
  isMuted.value = audio?.toggleMute() ?? false
}

function applyQuality(quality: GameQuality): void {
  currentQuality.value = quality
  viewportRef.value?.sendCommand({ type: 'SET_QUALITY', quality })
}

// ---------- 命令转发 ----------
function send(type: 'START' | 'PAUSE' | 'RESUME' | 'RESTART' | 'EXIT_TO_MENU'): void {
  viewportRef.value?.sendCommand({ type })
}

function handleStart(): void {
  score.value = 0
  collected.value = 0
  hasEnded.value = false
  scorePopups.value = []
  send('START')
}

function handlePause(): void {
  send('PAUSE')
}

function handleResume(): void {
  send('RESUME')
}

function handleRestart(): void {
  score.value = 0
  collected.value = 0
  hasEnded.value = false
  scorePopups.value = []
  send('RESTART')
}

function handleExit(): void {
  send('EXIT_TO_MENU')
}

// ---------- 运行时事件 ----------
function handleRuntimeEvent(event: GameEvent): void {
  switch (event.type) {
    case 'STATE_CHANGED':
      gameState.value = event.state
      if (event.state === 'playing') {
        hasEnded.value = false
      }
      if (event.state === 'menu') {
        // 回到菜单时刷新最高分
        refreshHighScore()
      }
      break
    case 'SCORE_CHANGED':
      score.value = event.score
      collected.value = event.collected
      break
    case 'SCORE_POPUP': {
      const id = popupIdCounter++
      scorePopups.value.push({ id, x: event.x, y: event.y, score: event.score })
      window.setTimeout(() => {
        scorePopups.value = scorePopups.value.filter((p) => p.id !== id)
      }, 900)
      break
    }
    case 'TIMER_UPDATED':
      remainingSeconds.value = event.remainingSeconds
      break
    case 'GAME_WON':
      finalScore.value = event.score
      finalCollected.value = event.collected
      hasEnded.value = true
      // 结算后刷新最高分
      refreshHighScore()
      break
    case 'GAME_OVER':
      finalScore.value = event.score
      finalCollected.value = event.collected
      hasEnded.value = true
      refreshHighScore()
      break
    case 'EXIT_TO_MENU':
      gameState.value = 'menu'
      score.value = 0
      collected.value = 0
      refreshHighScore()
      break
    case 'RESTARTED':
      break
    default:
      break
  }
}

// ---------- 性能统计 ----------
function startDevStatsTimer(): void {
  if (devPanelTimer !== null) return
  devPanelTimer = setInterval(() => {
    const stats = viewportRef.value?.getPerformanceStats()
    if (stats) devStats.value = stats
  }, 500)
}

function stopDevStatsTimer(): void {
  if (devPanelTimer !== null) {
    clearInterval(devPanelTimer)
    devPanelTimer = null
  }
}

// ---------- FPS ----------
function startFpsTimer(): void {
  if (fpsTimer !== null) return
  fpsTimer = setInterval(() => {
    fps.value = viewportRef.value?.getFps() ?? 0
  }, 200)
}

function stopFpsTimer(): void {
  if (fpsTimer !== null) {
    clearInterval(fpsTimer)
    fpsTimer = null
  }
}

function handleDevPanelToggle(event: KeyboardEvent): void {
  if (!import.meta.env.DEV) return
  if (event.code !== 'KeyF2') return
  devPanelVisible.value = !devPanelVisible.value
}

watch(showSuccess, (v) => {
  if (v) refreshHighScore()
})
watch(showFailed, (v) => {
  if (v) refreshHighScore()
})

onMounted(() => {
  // GameViewport 在 GameRuntime 构造后即 ready，loadRuntime 可能需要稍后
  // 但为了避免时序问题，我们在第一个事件回调里也调用 loadRuntime
  window.addEventListener('keydown', handleDevPanelToggle)
  startDevStatsTimer()
  startFpsTimer()

  // 延迟一帧确保 GameRuntime 已构造
  requestAnimationFrame(() => {
    loadRuntime()
    refreshHighScore()
    if (audio) isMuted.value = audio.isMuted
  })
})

onBeforeUnmount(() => {
  stopDevStatsTimer()
  stopFpsTimer()
  window.removeEventListener('keydown', handleDevPanelToggle)
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <p class="app-brand">
        <span class="app-brand__mark" aria-hidden="true"></span>
        ASTRA: Lost Relic
      </p>
      <div class="app-header__controls">
        <!-- 语言切换 -->
        <div class="quality-switch" role="group" :aria-label="t('app.language')">
          <button
            class="quality-switch__btn"
            :class="{ 'quality-switch__btn--active': locale === 'zh' }"
            type="button"
            @click="setLocale('zh')"
          >
            中
          </button>
          <button
            class="quality-switch__btn"
            :class="{ 'quality-switch__btn--active': locale === 'en' }"
            type="button"
            @click="setLocale('en')"
          >
            EN
          </button>
        </div>
        <!-- 画质选择（所有状态显示，切档位即时生效） -->
        <div class="quality-switch" role="radiogroup" :aria-label="t('app.qualityGroup')">
          <button
            v-for="option in QUALITY_OPTIONS"
            :key="option.value"
            class="quality-switch__btn"
            :class="{ 'quality-switch__btn--active': currentQuality === option.value }"
            type="button"
            @click="applyQuality(option.value)"
          >
            {{ t(option.label) }}
          </button>
        </div>
        <button
          class="mute-btn"
          type="button"
          :aria-pressed="isMuted"
          :title="isMuted ? t('app.unmute') : t('app.mute')"
          @click="toggleMute"
        >
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <span class="app-phase">{{ t('app.phase') }}</span>
      </div>
    </header>

    <main class="game-stage">
      <div class="game-frame">
        <GameViewport ref="viewportRef" @event="handleRuntimeEvent" />

        <!-- ========== 菜单 ========== -->
        <GameMenu v-if="showMenu" @start="handleStart" :high-score="highScore" />

        <!-- ========== 触控摇杆 ========== -->
        <TouchControls
          v-if="touchReceiver"
          :receiver="touchReceiver"
          :enabled="gameState === 'playing' || gameState === 'paused'"
        />

        <!-- ========== Playing HUD ========== -->
        <div v-if="showHud" class="game-hud">
          <div class="hud-top">
            <div class="hud-top__group">
              <div class="hud-stat">
                <span class="hud-stat__label">{{ t('hud.score') }}</span>
                <span class="hud-stat__value">{{ score.toString().padStart(4, '0') }}</span>
              </div>
              <div class="hud-stat">
                <span class="hud-stat__label">{{ t('hud.crystals') }}</span>
                <span class="hud-stat__value">{{ collected }} / {{ total }}</span>
              </div>
            </div>

            <div class="hud-timer" :class="{ 'hud-timer--low': isLowTime }">
              <span class="hud-timer__label">{{ t('hud.time') }}</span>
              <span class="hud-timer__value">{{ formattedTime }}</span>
            </div>
          </div>

          <div class="hud-bottom">
            <p class="hud-hint">
              <kbd>WASD</kbd> / <kbd>{{ t('hud.arrows') }}</kbd> {{ t('hud.move') }} ·
              <kbd>Esc</kbd> {{ t('hud.pause') }}
            </p>
            <div class="hud-actions">
              <button class="hud-btn" type="button" @click="handlePause">
                {{ t('hud.pauseButton') }}
              </button>
              <button class="hud-btn hud-btn--exit" type="button" @click="handleExit">
                {{ t('common.backToLobby') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ========== 分数飘字 ========== -->
        <div class="score-popups" aria-hidden="true">
          <div
            v-for="popup in scorePopups"
            :key="popup.id"
            class="score-popups__item"
            :style="{ left: `${popup.x * 100}%`, top: `${popup.y * 100}%` }"
          >
            +{{ popup.score }}
          </div>
        </div>

        <!-- ========== Pause Overlay ========== -->
        <div v-if="showPause" class="overlay">
          <div class="overlay__panel">
            <p class="overlay__eyebrow">{{ t('pause.eyebrow') }}</p>
            <h2 class="overlay__title">{{ t('pause.title') }}</h2>
            <p class="overlay__desc">{{ t('pause.desc') }}</p>

            <div class="overlay__stats">
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">{{ t('hud.score') }}</span>
                <span class="hud-stat__value">{{ score }}</span>
              </div>
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">{{ t('hud.crystals') }}</span>
                <span class="hud-stat__value">{{ collected }} / {{ total }}</span>
              </div>
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">{{ t('hud.time') }}</span>
                <span class="hud-stat__value">{{ formattedTime }}</span>
              </div>
            </div>

            <p class="overlay__note" v-if="highScore > 0">
              {{ t('common.bestScore') }}<strong>{{ highScore }}</strong>
            </p>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleResume">
                {{ t('pause.resume') }}
              </button>
              <button class="overlay-btn" type="button" @click="handleRestart">
                {{ t('common.restart') }}
              </button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                {{ t('common.backToLobby') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ========== Success Overlay ========== -->
        <div v-if="showSuccess" class="overlay overlay--success">
          <div class="overlay__panel">
            <p class="overlay__eyebrow overlay__eyebrow--success">{{ t('success.eyebrow') }}</p>
            <h2 class="overlay__title overlay__title--success">{{ t('success.title') }}</h2>
            <p class="overlay__desc">{{ t('success.desc') }}</p>

            <div class="overlay__stats">
              <div class="result-stat">
                <span class="result-stat__label">{{ t('result.finalScore') }}</span>
                <span class="result-stat__value">{{ finalScore }}</span>
              </div>
              <div class="result-stat">
                <span class="result-stat__label">{{ t('hud.crystals') }}</span>
                <span class="result-stat__value">{{ finalCollected }} / {{ total }}</span>
              </div>
            </div>

            <p class="overlay__note" v-if="highScore > 0">
              {{ t('common.bestScore') }}<strong>{{ highScore }}</strong>
            </p>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleRestart">
                {{ t('success.playAgain') }}
              </button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                {{ t('common.backToLobby') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ========== Failed Overlay ========== -->
        <div v-if="showFailed" class="overlay overlay--failed">
          <div class="overlay__panel">
            <p class="overlay__eyebrow overlay__eyebrow--failed">{{ t('failed.eyebrow') }}</p>
            <h2 class="overlay__title overlay__title--failed">{{ t('failed.title') }}</h2>
            <p class="overlay__desc">{{ t('failed.desc') }}</p>

            <div class="overlay__stats">
              <div class="result-stat">
                <span class="result-stat__label">{{ t('result.finalScore') }}</span>
                <span class="result-stat__value">{{ finalScore }}</span>
              </div>
              <div class="result-stat">
                <span class="result-stat__label">{{ t('hud.crystals') }}</span>
                <span class="result-stat__value">{{ finalCollected }} / {{ total }}</span>
              </div>
            </div>

            <p class="overlay__note" v-if="highScore > 0">
              {{ t('common.bestScore') }}<strong>{{ highScore }}</strong>
            </p>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleRestart">
                {{ t('common.restart') }}
              </button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                {{ t('common.backToLobby') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ========== 性能监控（常驻右上角，游玩时下移避开计时器） ========== -->
        <div class="dev-stats" :class="{ 'dev-stats--hud': showHud }" :aria-label="t('stats.aria')">
          <div class="dev-stats__row">
            <span>FPS</span>
            <span
              class="dev-stats__value"
              :class="{
                'dev-stats__value--warn': fps > 0 && fps < 30,
                'dev-stats__value--bad': fps > 0 && fps < 20,
              }"
              >{{ fps }}</span
            >
          </div>
          <div class="dev-stats__row">
            <span>{{ t('stats.drawCalls') }}</span>
            <span class="dev-stats__value">{{ devStats.drawCalls }}</span>
          </div>
          <template v-if="IS_DEV && devPanelVisible">
            <div class="dev-stats__row">
              <span>{{ t('stats.triangles') }}</span>
              <span>{{ devStats.triangles.toLocaleString() }}</span>
            </div>
            <div class="dev-stats__row">
              <span>{{ t('stats.geometries') }}</span><span>{{ devStats.geometries }}</span>
            </div>
            <div class="dev-stats__row">
              <span>{{ t('stats.textures') }}</span><span>{{ devStats.textures }}</span>
            </div>
            <div class="dev-stats__hint">{{ t('stats.hint') }}</div>
          </template>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <span>Vue 3 · TypeScript · Three.js</span>
      <span v-if="highScore > 0">{{ t('footer.bestScore', { score: highScore }) }}</span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: max(18px, env(safe-area-inset-top)) var(--space-page) 0;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.app-brand__mark {
  width: 12px;
  height: 12px;
  border: 1px solid var(--color-accent);
  transform: rotate(45deg);
  box-shadow: 0 0 12px var(--color-accent-soft);
}

.app-header__controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-phase {
  padding: 4px 10px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.quality-switch {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: rgba(9, 17, 31, 0.72);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.quality-switch__btn {
  padding: 3px 10px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background var(--transition-base),
    color var(--transition-base);
}

.quality-switch__btn:hover {
  color: var(--color-text);
}

.quality-switch__btn--active {
  color: #021018;
  background: linear-gradient(135deg, #7df3ff, #35c6e8);
}

.mute-btn {
  padding: 4px 10px;
  font-size: 0.85rem;
  background: rgba(9, 17, 31, 0.72);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
}

.game-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: var(--space-page);
}

.game-frame {
  position: relative;
  width: min(100%, 1400px, calc((100dvh - 210px) * 16 / 9));
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #02040a;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-frame);
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 0 var(--space-page) max(18px, env(safe-area-inset-bottom));
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

/* ==================== HUD ==================== */
.game-hud {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: clamp(12px, 2vw, 20px);
}

.hud-top__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-stat {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 14px;
  background: rgba(9, 17, 31, 0.78);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.hud-stat__label {
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  color: var(--color-text-muted);
}

.hud-stat__value {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: var(--color-accent);
}

.hud-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 18px;
  background: rgba(9, 17, 31, 0.78);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  pointer-events: auto;
  min-width: 90px;
}

.hud-timer__label {
  font-size: 0.6rem;
  letter-spacing: 0.22em;
  color: var(--color-text-muted);
}

.hud-timer__value {
  font-size: 1.35rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}

.hud-timer--low .hud-timer__value {
  color: #ff7c7c;
  animation: hud-pulse 800ms ease-in-out infinite;
}

@keyframes hud-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.hud-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(12px, 2vw, 20px);
}

.hud-hint {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.hud-hint kbd {
  padding: 2px 6px;
  font-family: inherit;
  font-size: 0.68rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-border);
  border-radius: 5px;
}

.hud-actions {
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.hud-btn {
  padding: 7px 16px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--color-text);
  background: rgba(9, 17, 31, 0.78);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background var(--transition-base);
}

.hud-btn:hover {
  background: rgba(95, 230, 255, 0.18);
}

.hud-btn--exit {
  border-color: rgba(255, 130, 130, 0.3);
}

.hud-btn--exit:hover {
  background: rgba(255, 130, 130, 0.16);
  border-color: rgba(255, 130, 130, 0.6);
}

/* ==================== 分数飘字 ==================== */
.score-popups {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  overflow: hidden;
}

.score-popups__item {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #9df6ff;
  text-shadow:
    0 0 10px rgba(47, 216, 255, 0.9),
    0 0 20px rgba(47, 216, 255, 0.5);
  font-variant-numeric: tabular-nums;
  animation: score-pop 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}

@keyframes score-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -30%) scale(0.6);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -60%) scale(1.15);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -140%) scale(1);
  }
}

/* ==================== Overlays ==================== */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-content: center;
  padding: 24px;
  background: rgba(4, 7, 15, 0.82);
  backdrop-filter: blur(6px);
}

.overlay--success {
  background: rgba(2, 16, 10, 0.82);
}

.overlay--failed {
  background: rgba(20, 6, 10, 0.86);
}

.overlay__panel {
  width: min(100%, 440px);
  padding: clamp(24px, 4vw, 36px);
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.overlay__eyebrow {
  font-size: 0.68rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.overlay__eyebrow--success {
  color: #5fffc1;
}

.overlay__eyebrow--failed {
  color: #ff7c7c;
}

.overlay__title {
  margin-top: 8px;
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  font-weight: 700;
  letter-spacing: 0.18em;
}

.overlay__title--success {
  color: #5fffc1;
}

.overlay__title--failed {
  color: #ff7c7c;
}

.overlay__desc {
  margin-top: 10px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text-muted);
}

.overlay__stats {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.overlay__note {
  margin-top: 14px;
  font-size: 0.76rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.overlay__note strong {
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.hud-stat--inline {
  background: rgba(0, 0, 0, 0.2);
}

.result-stat {
  display: flex;
  flex-direction: column;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 110px;
}

.result-stat__label {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: var(--color-text-muted);
}

.result-stat__value {
  margin-top: 4px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.overlay--success .result-stat__value {
  color: #5fffc1;
}

.overlay--failed .result-stat__value {
  color: #ff7c7c;
}

.overlay__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
}

.overlay-btn {
  padding: 12px 20px;
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--color-text);
  background: rgba(95, 230, 255, 0.08);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background var(--transition-base),
    transform var(--transition-base);
}

.overlay-btn:hover {
  background: rgba(95, 230, 255, 0.18);
}

.overlay-btn:active {
  transform: translateY(1px);
}

.overlay-btn--primary {
  color: #021018;
  background: linear-gradient(135deg, #7df3ff, #35c6e8);
  border-color: transparent;
  box-shadow: 0 6px 20px rgba(53, 198, 232, 0.35);
}

.overlay-btn--primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 8px 24px rgba(53, 198, 232, 0.5);
}

.overlay-btn--ghost {
  color: var(--color-text-muted);
  background: transparent;
  border-style: dashed;
}

.overlay-btn--ghost:hover {
  color: var(--color-text);
  border-style: solid;
}

/* ==================== 性能监控（右上角） ==================== */
.dev-stats {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  padding: 10px 14px;
  font-size: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #9df6ff;
  background: rgba(0, 10, 18, 0.82);
  border: 1px solid rgba(95, 230, 255, 0.35);
  border-radius: 6px;
  line-height: 1.5;
  pointer-events: none;
  user-select: none;
}

/* 游玩时 HUD 右上角有计时器，面板下移让出位置 */
.dev-stats.dev-stats--hud {
  top: calc(clamp(12px, 2vw, 20px) + 72px);
}

.dev-stats__row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.dev-stats__row span:first-child {
  color: var(--color-text-muted);
}

.dev-stats__row:first-child .dev-stats__value {
  font-size: 0.85rem;
  font-weight: 700;
}

.dev-stats__value {
  font-variant-numeric: tabular-nums;
}

.dev-stats__value--warn {
  color: #ffc94d;
}

.dev-stats__value--bad {
  color: #ff7c7c;
}

.dev-stats__hint {
  margin-top: 6px;
  font-size: 0.6rem;
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* ==================== Mobile ==================== */
@media (max-width: 760px) {
  .app-shell {
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  .app-header {
    padding: max(14px, env(safe-area-inset-top)) 16px 12px;
  }

  .app-brand {
    font-size: 0.8rem;
  }

  .app-header__controls {
    gap: 8px;
  }

  .app-phase {
    display: none;
  }

  .quality-switch__btn {
    padding: 3px 7px;
    font-size: 0.6rem;
  }

  .game-stage {
    padding: 0;
  }

  .game-frame {
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    border-inline: none;
    border-radius: 0;
  }

  .app-footer {
    display: none;
  }

  .hud-top {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .hud-top__group {
    flex-direction: row;
    justify-content: space-between;
  }

  .hud-timer {
    align-self: flex-end;
  }

  .hud-bottom {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .hud-actions {
    justify-content: space-between;
  }

  .hud-btn {
    flex: 1;
  }

  .result-stat {
    flex: 1;
    min-width: 0;
  }

  .overlay__actions {
    gap: 8px;
  }
}
</style>
