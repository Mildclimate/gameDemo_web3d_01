<script setup lang="ts">
import { computed, ref } from 'vue'

import { TOTAL_COLLECTIBLES } from './game/config/gameConfig'
import GameMenu from './components/GameMenu.vue'
import GameViewport from './components/GameViewport.vue'
import type { GameEvent, GameState } from './types/game'

const viewportRef = ref<InstanceType<typeof GameViewport> | null>(null)

// ---------- UI 状态（纯展示，不含 Three.js 对象） ----------
const gameState = ref<GameState>('menu')
const score = ref(0)
const collected = ref(0)
const remainingSeconds = ref(120)
const finalScore = ref(0)
const finalCollected = ref(0)
const hasEnded = ref(false)

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

// ---------- 命令转发 ----------
function send(type: 'START' | 'PAUSE' | 'RESUME' | 'RESTART' | 'EXIT_TO_MENU'): void {
  viewportRef.value?.sendCommand({ type })
}

function handleStart(): void {
  // 重置 UI 状态
  score.value = 0
  collected.value = 0
  hasEnded.value = false
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
      break
    case 'SCORE_CHANGED':
      score.value = event.score
      collected.value = event.collected
      break
    case 'TIMER_UPDATED':
      remainingSeconds.value = event.remainingSeconds
      break
    case 'GAME_WON':
      finalScore.value = event.score
      finalCollected.value = event.collected
      hasEnded.value = true
      break
    case 'GAME_OVER':
      finalScore.value = event.score
      finalCollected.value = event.collected
      hasEnded.value = true
      break
    case 'EXIT_TO_MENU':
      gameState.value = 'menu'
      score.value = 0
      collected.value = 0
      break
    case 'RESTARTED':
      // 等待下一次 STATE_CHANGED
      break
    default:
      break
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <p class="app-brand">
        <span class="app-brand__mark" aria-hidden="true"></span>
        ASTRA: Lost Relic
      </p>
      <span class="app-phase">M3 · 游戏闭环</span>
    </header>

    <main class="game-stage">
      <div class="game-frame">
        <GameViewport ref="viewportRef" @event="handleRuntimeEvent" />

        <!-- ========== 菜单 ========== -->
        <GameMenu v-if="showMenu" @start="handleStart" />

        <!-- ========== Playing HUD ========== -->
        <div v-if="showHud" class="game-hud">
          <div class="hud-top">
            <div class="hud-top__group">
              <div class="hud-stat">
                <span class="hud-stat__label">SCORE</span>
                <span class="hud-stat__value">{{ score.toString().padStart(4, '0') }}</span>
              </div>
              <div class="hud-stat">
                <span class="hud-stat__label">CRYSTALS</span>
                <span class="hud-stat__value">{{ collected }} / {{ total }}</span>
              </div>
            </div>

            <div class="hud-timer" :class="{ 'hud-timer--low': isLowTime }">
              <span class="hud-timer__label">TIME</span>
              <span class="hud-timer__value">{{ formattedTime }}</span>
            </div>
          </div>

          <div class="hud-bottom">
            <p class="hud-hint"><kbd>WASD</kbd> / <kbd>方向键</kbd> 移动</p>
            <div class="hud-actions">
              <button class="hud-btn" type="button" @click="handlePause">暂停</button>
              <button class="hud-btn hud-btn--exit" type="button" @click="handleExit">
                返回大厅
              </button>
            </div>
          </div>
        </div>

        <!-- ========== Pause Overlay ========== -->
        <div v-if="showPause" class="overlay">
          <div class="overlay__panel">
            <p class="overlay__eyebrow">SYSTEM</p>
            <h2 class="overlay__title">PAUSED</h2>
            <p class="overlay__desc">游戏已暂停。时间已冻结，角色停止响应输入。</p>

            <div class="overlay__stats">
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">SCORE</span>
                <span class="hud-stat__value">{{ score }}</span>
              </div>
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">CRYSTALS</span>
                <span class="hud-stat__value">{{ collected }} / {{ total }}</span>
              </div>
              <div class="hud-stat hud-stat--inline">
                <span class="hud-stat__label">TIME</span>
                <span class="hud-stat__value">{{ formattedTime }}</span>
              </div>
            </div>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleResume">
                继续游戏
              </button>
              <button class="overlay-btn" type="button" @click="handleRestart">重新开始</button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                返回大厅
              </button>
            </div>
          </div>
        </div>

        <!-- ========== Success Overlay ========== -->
        <div v-if="showSuccess" class="overlay overlay--success">
          <div class="overlay__panel">
            <p class="overlay__eyebrow overlay__eyebrow--success">MISSION COMPLETE</p>
            <h2 class="overlay__title overlay__title--success">任务完成</h2>
            <p class="overlay__desc">所有能量晶体已收集。遗迹能量核心已唤醒。</p>

            <div class="overlay__stats">
              <div class="result-stat">
                <span class="result-stat__label">FINAL SCORE</span>
                <span class="result-stat__value">{{ finalScore }}</span>
              </div>
              <div class="result-stat">
                <span class="result-stat__label">CRYSTALS</span>
                <span class="result-stat__value">{{ finalCollected }} / {{ total }}</span>
              </div>
            </div>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleRestart">
                再玩一次
              </button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                返回大厅
              </button>
            </div>
          </div>
        </div>

        <!-- ========== Failed Overlay ========== -->
        <div v-if="showFailed" class="overlay overlay--failed">
          <div class="overlay__panel">
            <p class="overlay__eyebrow overlay__eyebrow--failed">TIME UP</p>
            <h2 class="overlay__title overlay__title--failed">时间耗尽</h2>
            <p class="overlay__desc">遗迹能量未能在倒计时结束前激活。</p>

            <div class="overlay__stats">
              <div class="result-stat">
                <span class="result-stat__label">FINAL SCORE</span>
                <span class="result-stat__value">{{ finalScore }}</span>
              </div>
              <div class="result-stat">
                <span class="result-stat__label">CRYSTALS</span>
                <span class="result-stat__value">{{ finalCollected }} / {{ total }}</span>
              </div>
            </div>

            <div class="overlay__actions">
              <button class="overlay-btn overlay-btn--primary" type="button" @click="handleRestart">
                重新开始
              </button>
              <button class="overlay-btn overlay-btn--ghost" type="button" @click="handleExit">
                返回大厅
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <span>Vue 3 · TypeScript · Three.js</span>
      <span>完整游戏玩法闭环已接入</span>
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

.app-phase {
  padding: 4px 10px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
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
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
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
