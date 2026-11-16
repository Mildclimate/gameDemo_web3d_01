<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

import { GameRuntime } from '../game/core/GameRuntime'
import type { GameCommand, GameEvent } from '../types/game'

const emit = defineEmits<{
  (e: 'event', event: GameEvent): void
}>()

const mountRef = ref<HTMLDivElement | null>(null)
const runtime = shallowRef<GameRuntime | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

function handleRuntimeEvent(event: GameEvent): void {
  if (event.type === 'READY') {
    status.value = 'ready'
  } else if (event.type === 'ERROR') {
    errorMessage.value = event.message
    status.value = 'error'
  }
  // 所有事件都转发给 App.vue
  emit('event', event)
}

function sendCommand(command: GameCommand): boolean {
  if (!runtime.value || status.value === 'error') return false
  runtime.value.command(command)
  return true
}

defineExpose({ sendCommand })

onMounted(() => {
  const mount = mountRef.value
  if (!mount) {
    errorMessage.value = '未找到 3D 渲染容器。'
    status.value = 'error'
    return
  }

  try {
    const instance = new GameRuntime({ mount, onEvent: handleRuntimeEvent })
    runtime.value = instance
    instance.start()
  } catch (error) {
    console.error('[GameViewport] 3D 场景初始化失败', error)
    errorMessage.value = error instanceof Error ? error.message : 'WebGL 初始化失败。'
    status.value = 'error'
    runtime.value?.destroy()
    runtime.value = null
  }
})

onUnmounted(() => {
  runtime.value?.destroy()
  runtime.value = null
})
</script>

<template>
  <section class="game-viewport" aria-label="3D 游戏渲染区域">
    <div ref="mountRef" class="game-viewport__mount"></div>
    <div class="game-viewport__vignette" aria-hidden="true"></div>

    <span class="game-viewport__corner game-viewport__corner--tl" aria-hidden="true"></span>
    <span class="game-viewport__corner game-viewport__corner--tr" aria-hidden="true"></span>
    <span class="game-viewport__corner game-viewport__corner--bl" aria-hidden="true"></span>
    <span class="game-viewport__corner game-viewport__corner--br" aria-hidden="true"></span>

    <div v-if="status === 'loading'" class="game-viewport__overlay" role="status">
      <span class="game-viewport__spinner" aria-hidden="true"></span>
      <p class="game-viewport__message">正在构建遗迹场景…</p>
    </div>

    <div
      v-if="status === 'error'"
      class="game-viewport__overlay game-viewport__overlay--error"
      role="alert"
    >
      <p class="game-viewport__message">3D 场景初始化失败</p>
      <p class="game-viewport__detail">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.game-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 55%, rgba(38, 118, 168, 0.22), transparent 62%),
    linear-gradient(180deg, #050a14 0%, #02040a 100%);
}

.game-viewport__mount {
  position: absolute;
  inset: 0;
}

.game-viewport__mount :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.game-viewport__vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, transparent 52%, rgba(1, 3, 8, 0.62) 100%);
}

.game-viewport__overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
  background: rgba(4, 7, 15, 0.74);
  backdrop-filter: blur(4px);
}

.game-viewport__message {
  font-size: 0.78rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.game-viewport__detail {
  max-width: 460px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.game-viewport__overlay--error {
  background: rgba(20, 6, 10, 0.82);
}

.game-viewport__overlay--error .game-viewport__message {
  color: #ff9b9b;
}

.game-viewport__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-accent-soft);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: viewport-spin 900ms linear infinite;
}

.game-viewport__corner {
  position: absolute;
  z-index: 2;
  width: 22px;
  height: 22px;
  border: 1px solid var(--color-border-strong);
  opacity: 0.7;
  pointer-events: none;
}

.game-viewport__corner--tl {
  top: 18px;
  left: 18px;
  border-right: none;
  border-bottom: none;
}

.game-viewport__corner--tr {
  top: 18px;
  right: 18px;
  border-left: none;
  border-bottom: none;
}

.game-viewport__corner--bl {
  bottom: 18px;
  left: 18px;
  border-top: none;
  border-right: none;
}

.game-viewport__corner--br {
  right: 18px;
  bottom: 18px;
  border-top: none;
  border-left: none;
}

@keyframes viewport-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
