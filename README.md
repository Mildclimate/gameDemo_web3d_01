# ASTRA: Lost Relic

基于 Vue 3 + TypeScript + Three.js 的 Web 3D 探索收集小游戏。当前完成 **M2：玩家移动与第三人称摄像机**，可在遗迹场景中用 WASD / 方向键控制角色移动，带边界与障碍碰撞，摄像机平滑跟随。收集与计分玩法尚未接入（M3）。

## 操作

- 点击大厅中的「开始探索」进入控制状态。
- `W` / `↑` 前进，`S` / `↓` 后退，`A` / `←` 左移，`D` / `→` 右移；对角线自动归一化。
- 点击底部「返回大厅」退出控制，角色回到出生点。

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
│   │   ├── config/movement.ts         # 玩家速度、半径、转向与出生点
│   │   ├── core/GameRuntime.ts        # Renderer/Scene/Camera/循环/resize/destroy
│   │   ├── entities/Player.ts         # 基础几何体角色模型、位置/朝向/动画
│   │   ├── input/KeyboardInput.ts     # WASD/方向键，归一化方向与失焦重置
│   │   ├── scene/arenaLayout.ts       # 场地尺寸与障碍碰撞数据（与视觉共享）
│   │   ├── scene/createWorld.ts       # 基础几何体遗迹场景与灯光
│   │   ├── systems/CameraFollowSystem.ts # 第三人称阻尼跟随
│   │   ├── systems/MovementSystem.ts  # delta 移动、碰撞与朝向
│   │   ├── systems/collision.ts       # 纯函数：多边形边界、圆/AABB 碰撞与滑动
│   │   └── utils/disposeScene.ts      # geometry/material/texture 释放
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
- 输入 / 移动 / 摄像机三套系统互相独立：`KeyboardInput` 只输出方向，`MovementSystem` 读写 `Player` 并做碰撞，`CameraFollowSystem` 只读角色位置。
- 移动使用 `deltaSeconds` 与指数平滑，帧率无关；可行走区为 16 边形半平面交集，障碍使用圆形与旋转 AABB 近似，碰撞后沿边缘推出。
- 摄像机采用固定世界偏移（角色后上方）+ 指数阻尼，不挂在角色节点下。

## 里程碑状态

| 里程碑 | 内容             | 状态   |
| ------ | ---------------- | ------ |
| M0     | 工程骨架         | 完成   |
| M1     | Three.js Runtime | 完成   |
| M2     | 玩家移动与摄像机 | 完成   |
| M3     | 玩法闭环         | 待开始 |
| M4     | UI 与移动端      | 待开始 |
| M5     | 资产接入         | 待开始 |
| M6     | 性能、清理与测试 | 待开始 |
| M7     | 部署与交付       | 待开始 |

## 已知限制

- 尚未接入收集、计分、倒计时与暂停/结算（M3）。
- 摄像机为固定世界偏移的后上方跟随，不支持鼠标环绕或自由视角（M4 再评估）。
- 障碍碰撞使用圆形 / 旋转 AABB 近似，复杂或不规则建筑需要更精细的碰撞体。
- 尚未配置 `npm run test`：`collision.ts` 已按纯函数拆分，测试框架将在 M3 引入规则与状态机时一并加入。
- 生产构建包约 619 kB（gzip 约 165 kB），主要来自 Three.js；尚未做代码分割或按需加载。
- 未初始化 Git 仓库。
