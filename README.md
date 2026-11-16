# ASTRA: Lost Relic

基于 Vue 3 + TypeScript + Three.js 的 Web 3D 探索收集小游戏。当前完成 **M1：Three.js Runtime 基础**，已渲染一个静态科幻遗迹场景，尚未接入角色移动与玩法。

## 技术栈

- Vue 3（Composition API + `<script setup>`）
- TypeScript（严格模式）
- Vite
- Three.js（`@types/three` 提供类型）
- ESLint + Prettier

## 环境要求

- Node.js >= 20.19
- npm >= 10

## 常用命令

| 命令                   | 说明                              |
| ---------------------- | --------------------------------- |
| `npm install`          | 安装依赖                          |
| `npm run dev`          | 启动开发服务器                    |
| `npm run build`        | 类型检查并生成生产构建（`dist/`） |
| `npm run preview`      | 本地预览生产构建                  |
| `npm run typecheck`    | 执行 `vue-tsc` 类型检查           |
| `npm run lint`         | ESLint 检查                       |
| `npm run lint:fix`     | ESLint 自动修复                   |
| `npm run format`       | Prettier 格式化                   |
| `npm run format:check` | Prettier 格式校验                 |

## 目录结构

```text
.
├── src/
│   ├── components/
│   │   ├── GameMenu.vue       # 游戏大厅 UI 占位
│   │   └── GameViewport.vue   # 渲染容器与 Runtime 生命周期
│   ├── game/
│   │   ├── core/GameRuntime.ts    # Renderer/Scene/Camera/循环/resize/destroy
│   │   ├── scene/createWorld.ts   # 基础几何体遗迹场景与灯光
│   │   └── utils/disposeScene.ts  # geometry/material/texture 释放
│   ├── styles/main.css        # 全局设计变量与基础样式
│   ├── types/game.ts          # 共享状态、命令与事件类型
│   ├── App.vue                # 页面布局：画布区域 + UI overlay
│   └── main.ts
├── index.html
├── env.d.ts
├── eslint.config.js
├── .prettierrc.json
├── vite.config.ts
├── tsconfig.json
├── plan_game.md               # 项目开发规范
└── README.md
```

后续按里程碑补充 `public/assets`、玩家实体、输入与玩法系统，不预先创建空文件。

## 架构约定

- **Vue 层**：页面布局、菜单、HUD、弹窗、加载/错误状态和低频业务状态。
- **Three.js Runtime 层**：`GameRuntime` 统一持有 Renderer、Scene、Camera、渲染循环和资源释放；Vue 组件只负责容器与生命周期。
- 两层通过 `GameEvent` 单向上报状态，后续命令通过 `GameCommand` 下发；每帧高频数据不写入 Vue 响应式状态。
- 运行时限制 `devicePixelRatio <= 2`，使用 `ResizeObserver` 同步画布尺寸，`destroy()` 可重复调用并释放场景资源。

## 里程碑状态

| 里程碑 | 内容             | 状态   |
| ------ | ---------------- | ------ |
| M0     | 工程骨架         | 完成   |
| M1     | Three.js Runtime | 完成   |
| M2     | 玩家移动与摄像机 | 待开始 |
| M3     | 玩法闭环         | 待开始 |
| M4     | UI 与移动端      | 待开始 |
| M5     | 资产接入         | 待开始 |
| M6     | 性能、清理与测试 | 待开始 |
| M7     | 部署与交付       | 待开始 |

## 已知限制

- 场景为静态展示：没有玩家角色、移动、碰撞和收集玩法（M2/M3）。
- 尚未配置 `npm run test`：目前缺少可独立测试的纯逻辑，测试框架将在引入状态机与规则逻辑（M3）时加入。
- 生产构建包约 608 kB（gzip 约 161 kB），主要来自 Three.js；尚未做代码分割或按需加载。
- 未初始化 Git 仓库。
