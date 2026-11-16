import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  Group,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'

import type { GameCommand, GameEvent, GameState } from '../../types/game'
import { COLLECTIBLE_POSITIONS } from '../config/gameConfig'
import { GameSession } from '../core/GameSession'
import { Collectible } from '../entities/Collectible'
import { Player } from '../entities/Player'
import { KeyboardInput } from '../input/KeyboardInput'
import { createWorld, type World } from '../scene/createWorld'
import { CameraFollowSystem } from '../systems/CameraFollowSystem'
import { CollectionSystem } from '../systems/CollectionSystem'
import { MovementSystem } from '../systems/MovementSystem'
import { disposeObjectTree } from '../utils/disposeScene'

const MAX_PIXEL_RATIO = 2
const MAX_FRAME_DELTA_SECONDS = 0.1
const CAMERA_FOV = 50
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 120

export interface GameRuntimeOptions {
  mount: HTMLElement
  onEvent?: (event: GameEvent) => void
}

/**
 * Three.js Runtime + Game Session 协调器。
 * 不推翻 M1/M2，在其上叠加 M3 的游戏会话与收集系统。
 */
export class GameRuntime {
  private readonly mount: HTMLElement
  private readonly onEvent: ((event: GameEvent) => void) | undefined

  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly world: World
  private readonly player: Player
  private readonly keyboard: KeyboardInput
  private readonly movement: MovementSystem
  private readonly cameraFollow: CameraFollowSystem

  private readonly session: GameSession
  private readonly collectiblesRoot: Group
  private readonly collectibles: Collectible[]
  private readonly collection: CollectionSystem

  private readonly resizeObserver: ResizeObserver
  private readonly handleVisibilityChange: () => void

  private frameId: number | null = null
  private lastFrameTime = 0
  private elapsedSeconds = 0
  private pixelRatio = 1
  private destroyed = false
  private readyEmitted = false
  private suppressEvents = false

  constructor({ mount, onEvent }: GameRuntimeOptions) {
    this.mount = mount
    this.onEvent = onEvent

    this.renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap

    this.scene = new Scene()
    this.scene.background = new Color('#050a14')
    this.scene.fog = new Fog('#050a14', 34, 80)

    this.camera = new PerspectiveCamera(CAMERA_FOV, 16 / 9, CAMERA_NEAR, CAMERA_FAR)

    this.world = createWorld()
    this.scene.add(this.world.root)

    // 玩家（M2）
    this.player = new Player()
    this.scene.add(this.player.object)

    this.keyboard = new KeyboardInput(window)
    this.movement = new MovementSystem(this.player)
    this.cameraFollow = new CameraFollowSystem(this.camera)
    this.cameraFollow.snapTo(this.player.object.position)

    // 能量晶体（M3）
    this.collectiblesRoot = new Group()
    this.collectiblesRoot.name = 'collectibles'
    this.scene.add(this.collectiblesRoot)

    this.collectibles = COLLECTIBLE_POSITIONS.map((pos) => {
      const c = new Collectible(pos.x, pos.z)
      this.collectiblesRoot.add(c.object)
      return c
    })

    // GameSession（M3）—— 纯逻辑，事件转发给 Vue
    this.session = new GameSession({
      onStateChanged: (s) => this.emit({ type: 'STATE_CHANGED', state: s }),
      onScoreChanged: (score, collected) => {
        this.emit({ type: 'SCORE_CHANGED', score, collected })
        this.emit({
          type: 'COLLECTIBLE_COLLECTED',
          collected,
          total: this.session.snapshot.totalCollectibles,
          score,
        })
      },
      onTimerUpdated: (remainingSeconds) =>
        this.emit({ type: 'TIMER_UPDATED', remainingSeconds }),
      onGameWon: () => {
        const snap = this.session.snapshot
        this.emit({
          type: 'GAME_WON',
          score: snap.score,
          collected: snap.collectedCount,
          total: snap.totalCollectibles,
        })
      },
      onGameOver: () => {
        const snap = this.session.snapshot
        this.emit({
          type: 'GAME_OVER',
          score: snap.score,
          collected: snap.collectedCount,
          total: snap.totalCollectibles,
        })
      },
      onExitToMenu: () => this.emit({ type: 'EXIT_TO_MENU' }),
      onRestarted: () => this.emit({ type: 'RESTARTED' }),
    })

    // CollectionSystem（M3）
    this.collection = new CollectionSystem(this.session)

    // 页面切换后台自动暂停
    this.handleVisibilityChange = () => {
      if (document.hidden && this.session.currentState === 'playing') {
        this.session.pause()
        this.keyboard.setEnabled(false)
      }
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    this.mount.appendChild(this.renderer.domElement)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.mount)
    this.resize()
  }

  /** 处理来自 Vue 层的命令。 */
  command(command: GameCommand): void {
    if (this.destroyed) return

    switch (command.type) {
      case 'START': {
        if (this.session.currentState === 'menu') {
          this.session.start() // menu → loading
          // 立即准备场景并进入 playing
          this.resetForNewGame()
          this.session.notifyReady() // loading → playing
          this.keyboard.setEnabled(true)
        }
        break
      }
      case 'PAUSE': {
        if (this.session.pause()) {
          this.keyboard.setEnabled(false)
        }
        break
      }
      case 'RESUME': {
        if (this.session.resume()) {
          this.keyboard.setEnabled(true)
          // 避免暂停后第一帧的异常 delta：重置 lastFrameTime
          this.lastFrameTime = performance.now()
        }
        break
      }
      case 'RESTART': {
        if (this.session.restart()) {
          this.resetForNewGame()
          this.session.notifyReady()
          this.keyboard.setEnabled(true)
        }
        break
      }
      case 'EXIT_TO_MENU': {
        if (this.session.exitToMenu()) {
          this.keyboard.setEnabled(false)
          this.movement.reset()
          this.cameraFollow.snapTo(this.player.object.position)
        }
        break
      }
      case 'SET_QUALITY':
        // 暂不实现画质档位，M4 处理
        break
    }
  }

  /** 当前 GameSession 状态（供外部只读查询）。 */
  get sessionState(): GameState {
    return this.session.currentState
  }

  /** （M2 兼容）查询是否正在游戏。 */
  get isGameplayActive(): boolean {
    return this.session.isActive
  }

  /** （M2 兼容）开始接收输入。 */
  startGameplay(): void {
    if (this.destroyed) return
    this.command({ type: 'START' })
  }

  /** （M2 兼容）停止接收输入，回到出生点。 */
  stopGameplay(): void {
    if (this.destroyed) return
    this.command({ type: 'EXIT_TO_MENU' })
  }

  /** 启动渲染循环（幂等）。 */
  start(): void {
    if (this.destroyed || this.frameId !== null) return

    this.resize()
    this.renderer.render(this.scene, this.camera)

    if (!this.readyEmitted) {
      this.readyEmitted = true
      this.emit({ type: 'READY' })
    }

    this.lastFrameTime = performance.now()
    this.frameId = requestAnimationFrame(this.tick)
  }

  /** 销毁（幂等）。 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.keyboard.destroy()

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    this.resizeObserver.disconnect()
    disposeObjectTree(this.scene)
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ---------- 内部 ----------

  private emit(event: GameEvent): void {
    if (this.suppressEvents) return
    this.onEvent?.(event)
  }

  private resetForNewGame(): void {
    this.movement.reset()
    this.cameraFollow.snapTo(this.player.object.position)
    this.elapsedSeconds = 0
    this.lastFrameTime = performance.now()
    for (const c of this.collectibles) c.reset()
  }

  private readonly tick = (time: number): void => {
    if (this.destroyed) return

    const deltaSeconds = Math.min((time - this.lastFrameTime) / 1000, MAX_FRAME_DELTA_SECONDS)
    this.lastFrameTime = time

    const state = this.session.currentState

    // 晶体动画：loading / playing / paused 都要继续播放（让玩家在暂停或结算时也能看到）
    if (state !== 'menu' && state !== 'error') {
      this.elapsedSeconds += deltaSeconds
      for (const c of this.collectibles) c.update(deltaSeconds, this.elapsedSeconds)
    }

    // World 动画（中央能量晶体）只在活跃或暂停时播放
    if (state === 'playing' || state === 'paused') {
      this.world.update(deltaSeconds)
    }

    if (state === 'playing') {
      // 输入 → 移动 → 收集 → 时间
      this.movement.update(deltaSeconds, this.keyboard.direction)

      const { x: px, z: pz } = this.player.object.position
      this.collection.update(px, pz, this.collectibles)

      this.session.update(deltaSeconds)
    }

    // 摄像机在任何状态下都保持平滑跟随（除了 menu）
    if (state !== 'menu' && state !== 'loading') {
      this.cameraFollow.update(this.player.object.position, deltaSeconds)
    }

    this.renderer.render(this.scene, this.camera)

    this.frameId = requestAnimationFrame(this.tick)
  }

  private resize(): void {
    if (this.destroyed) return

    const width = this.mount.clientWidth
    const height = this.mount.clientHeight
    if (width === 0 || height === 0) return

    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    if (nextPixelRatio !== this.pixelRatio) {
      this.pixelRatio = nextPixelRatio
      this.renderer.setPixelRatio(nextPixelRatio)
    }

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
}
