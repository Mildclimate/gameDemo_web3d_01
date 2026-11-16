<template>
  <div class="game-menu">
    <section class="game-menu__panel" aria-labelledby="game-menu-title">
      <p class="game-menu__eyebrow">星球遗迹 · 探索收集</p>

      <h1 id="game-menu-title" class="game-menu__title">
        ASTRA
        <span class="game-menu__title-sub">Lost Relic</span>
      </h1>

      <p class="game-menu__description">
        在废弃的星际遗迹中收集能量晶体。基础 3D 场景已经就绪，操作与玩法将在后续里程碑接入。
      </p>

      <button class="game-menu__start" type="button" disabled>开始探索</button>

      <p class="game-menu__note">玩法尚未开放，当前可查看基础遗迹场景。</p>
    </section>
  </div>
</template>

<style scoped>
.game-menu {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: clamp(16px, 3vw, 32px);
  pointer-events: none;
}

.game-menu__panel {
  width: min(100%, 420px);
  padding: clamp(20px, 3vw, 28px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  pointer-events: auto;
}

.game-menu__eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.game-menu__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-top: 10px;
  font-size: clamp(1.5rem, 3vw, 1.9rem);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.game-menu__title-sub {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.game-menu__description {
  margin-top: 14px;
  font-size: 0.88rem;
  line-height: 1.7;
  color: var(--color-text-muted);
}

.game-menu__start {
  width: 100%;
  margin-top: 20px;
  padding: 12px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #021018;
  background: linear-gradient(135deg, #7df3ff, #35c6e8);
  border: none;
  border-radius: var(--radius-sm);
  cursor: not-allowed;
  opacity: 0.45;
}

.game-menu__note {
  margin-top: 10px;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--color-text-muted);
}

@media (max-width: 760px) {
  .game-menu {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }

  .game-menu__panel {
    width: 100%;
  }
}
</style>
