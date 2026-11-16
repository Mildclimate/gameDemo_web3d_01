<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { TouchInput } from '../game/input/TouchInput'
import { t } from '../i18n'

const props = defineProps<{
  /** 逻辑层接收器，由 GameRuntime 提供。 */
  receiver: TouchInput
  /** 是否启用（playing 时启用）。 */
  enabled: boolean
}>()

/** 摇杆最大可偏移（相对于底座容器的短边）——0.45 表示接近一半。 */
const MAX_STICK_RATIO = 0.45
/** 手指按下/拖动时，超出此距离后摇杆头不再跟随，输出归一化单位向量。 */
const MAX_DRAG_RATIO = 0.48

const baseRef = ref<HTMLDivElement | null>(null)

const isActive = ref(false)
const stickOffsetX = ref(0)
const stickOffsetY = ref(0)
const opacity = ref(0)

let activePointerId: number | null = null
let baseRect: DOMRect | null = null
let baseCenterX = 0
let baseCenterY = 0
let maxRadius = 0

function computeMaxRadius(): number {
  if (!baseRef.value) return 60
  const rect = baseRef.value.getBoundingClientRect()
  // 以容器短边的一半为基准
  return Math.min(rect.width, rect.height) * MAX_STICK_RATIO
}

function refreshRect(): void {
  if (!baseRef.value) return
  baseRect = baseRef.value.getBoundingClientRect()
  baseCenterX = baseRect.left + baseRect.width / 2
  baseCenterY = baseRect.top + baseRect.height / 2
  maxRadius = computeMaxRadius()
}

function updateStickVisual(dx: number, dy: number): void {
  stickOffsetX.value = dx
  stickOffsetY.value = dy
}

function resetStickVisual(): void {
  stickOffsetX.value = 0
  stickOffsetY.value = 0
  isActive.value = false
}

function handlePointerDown(event: PointerEvent): void {
  if (activePointerId !== null) return
  if (!props.enabled) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  activePointerId = event.pointerId
  // 捕获后续 pointermove/up/cancel，避免手指滑出容器时丢事件
  ;(event.target as Element).setPointerCapture?.(event.pointerId)

  refreshRect()
  isActive.value = true

  updateFromEvent(event)
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return
  if (!isActive.value) return

  updateFromEvent(event)
}

function endPointer(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  activePointerId = null
  resetStickVisual()
  props.receiver.clear()
}

function handlePointerUp(event: PointerEvent): void {
  ;(event.target as Element).releasePointerCapture?.(event.pointerId)
  endPointer(event)
}

function handlePointerCancel(event: PointerEvent): void {
  endPointer(event)
}

function handlePointerLeave(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return
  // 不直接结束，继续接收（靠 capture）；但如果没 capture，也兜底
  if (!(event.target as Element).hasPointerCapture?.(event.pointerId)) {
    endPointer(event)
  }
}

function updateFromEvent(event: PointerEvent): void {
  const clientX = event.clientX
  const clientY = event.clientY

  const rawDx = clientX - baseCenterX
  const rawDy = clientY - baseCenterY

  const distance = Math.hypot(rawDx, rawDy)
  const maxDrag = (maxRadius / MAX_STICK_RATIO) * MAX_DRAG_RATIO // 允许手指再往外走一点

  // 手指超出最大拖动范围时，摇杆头停在 MAX_RADIUS 处，方向保持
  let visualDx: number
  let visualDy: number
  if (distance > maxDrag && distance > 0) {
    const scale = maxDrag / distance
    visualDx = rawDx * scale
    visualDy = rawDy * scale
  } else {
    visualDx = rawDx
    visualDy = rawDy
  }

  updateStickVisual(visualDx, visualDy)

  // 归一化到 [-1, 1] 范围
  const nx = rawDx / maxRadius
  // 屏幕向下拖动 → 游戏里 +Z，所以 dy 直接用
  const nz = rawDy / maxRadius
  props.receiver.setNormalized(nx, nz)
}

function handleWindowBlur(): void {
  if (activePointerId === null) return
  props.receiver.clear()
  resetStickVisual()
  activePointerId = null
}

function handleVisibilityChange(): void {
  if (document.hidden) handleWindowBlur()
}

function handleResize(): void {
  if (isActive.value) refreshRect()
}

watch(
  () => props.enabled,
  (enabled) => {
    if (!enabled) {
      props.receiver.clear()
      resetStickVisual()
      activePointerId = null
    }
  },
)

onMounted(() => {
  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('resize', handleResize)
  // 初始显示渐隐
  requestAnimationFrame(() => {
    opacity.value = 1
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', handleWindowBlur)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('resize', handleResize)
  props.receiver.clear()
})
</script>

<template>
  <div
    v-if="enabled"
    class="touch-controls"
    :class="{ 'touch-controls--active': isActive }"
    role="group"
    :aria-label="t('touch.joystick')"
  >
    <div
      ref="baseRef"
      class="joystick-base"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @pointerleave="handlePointerLeave"
    >
      <div
        class="joystick-stick"
        :style="{
          transform: `translate(${stickOffsetX}px, ${stickOffsetY}px)`,
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 仅在触摸设备显示。桌面端（hover 可用且 coarse 指针）隐藏。
 * pointer: coarse 覆盖手机和平板；hover: hover+pointer: fine 是桌面鼠标。
 */
.touch-controls {
  position: absolute;
  left: clamp(16px, 3vw, 28px);
  bottom: clamp(72px, 14vh, 110px);
  width: 148px;
  height: 148px;
  z-index: 5;
  opacity: v-bind(opacity);
  transition: opacity 400ms ease;
  pointer-events: none; /* 容器不吞事件，让底座自己处理 */
}

.joystick-base {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(9, 17, 31, 0.48);
  border: 1px solid rgba(95, 230, 255, 0.26);
  backdrop-filter: blur(6px);
  box-shadow:
    inset 0 0 30px rgba(95, 230, 255, 0.08),
    0 6px 24px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  touch-action: none; /* 关键：防止页面滚动抢触摸 */
  user-select: none;
}

.joystick-stick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 62px;
  height: 62px;
  margin-left: -31px;
  margin-top: -31px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #9df6ff 0%, #35c6e8 55%, #1a8ab0 100%);
  box-shadow:
    0 0 18px rgba(95, 230, 255, 0.55),
    0 4px 14px rgba(0, 0, 0, 0.45);
  transition:
    transform 40ms linear,
    box-shadow 80ms ease-out;
  will-change: transform;
}

.touch-controls--active .joystick-base {
  background: rgba(9, 17, 31, 0.62);
  border-color: rgba(95, 230, 255, 0.55);
}

.touch-controls--active .joystick-stick {
  box-shadow:
    0 0 28px rgba(95, 230, 255, 0.8),
    0 4px 18px rgba(0, 0, 0, 0.5);
}

/* ========== 显示策略 ========== */

/* 默认（桌面鼠标）隐藏 */
@media (pointer: fine), (pointer: none) {
  .touch-controls {
    display: none;
  }
}

/* 触摸设备显示：手机竖屏 / 平板 */
@media (pointer: coarse) {
  .touch-controls {
    display: block;
  }
}
</style>
