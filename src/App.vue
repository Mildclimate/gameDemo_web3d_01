<script setup lang="ts">
import GameMenu from './components/GameMenu.vue'
import GameViewport from './components/GameViewport.vue'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <p class="app-brand">
        <span class="app-brand__mark" aria-hidden="true"></span>
        ASTRA: Lost Relic
      </p>
      <span class="app-phase">M1 · 3D Runtime</span>
    </header>

    <main class="game-stage">
      <div class="game-frame">
        <GameViewport />
        <GameMenu />
      </div>
    </main>

    <footer class="app-footer">
      <span>Vue 3 · TypeScript · Three.js</span>
      <span>基础遗迹场景运行中</span>
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
}
</style>
