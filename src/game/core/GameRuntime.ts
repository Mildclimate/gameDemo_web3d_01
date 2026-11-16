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

import type { GameCommand, GameEvent, GameQuality, GameState } from '../../types/game'
import { QUALITY_PRESETS, type QualitySettings, DEFAULT_QUALITY } from '../config/qualityConfig'
import { COLLECTIBLE_POSITIONS } from '../config/gameConfig'
import { GameSession } from '../core/GameSession'
import { Collectible } from '../entities/Collectible'
import { Player } from '../entities/Player'
import { InputManager } from '../input/InputManager'
import { KeyboardInput } from '../input/KeyboardInput'
import { TouchInput } from '../input/TouchInput'
import { createWorld, type World } from '../scene/createWorld'
import { CameraFollowSystem } from '../systems/CameraFollowSystem'
import { CollectionSystem } from '../systems/CollectionSystem'
import { MovementSystem } from '../systems/MovementSystem'
import { OcclusionSystem } from '../systems/OcclusionSystem'
import { disposeObjectTree } from '../utils/disposeScene'
import { HighScoreStorage } from '../utils/HighScoreStorage'
import { AudioManager } from '../audio/AudioManager'

const MAX_FRAME_DELTA_SECONDS = 0.1
const CAMERA_FOV = 50
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 120

export interface GameRuntimeOptions {
  mount: HTMLElement
  onEvent?: (event: GameEvent) => void
}

export interface PerformanceStats {
  readonly drawCalls: number
  readonly triangles: number
  readonly geometries: number
  readonly textures: number
}

/**
 * Three.js Runtime + Game Session 协调器（M1 架构保留，M2/M3/M4 增量叠加）。
 * M4 新增：触控摇杆、画质档位、Esc 快捷键、音效、最高分、性能快照。
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
  private readonly touch: TouchInput
  private readonly input: InputManager
  private readonly movement: MovementSystem
  private readonly cameraFollow: CameraFollowSystem
  private readonly occlusion: OcclusionSystem

  private readonly session: GameSession
  private readonly collectiblesRoot: Group
  private readonly collectibles: Collectible[]
  private readonly collection: CollectionSystem

  private readonly highScore: HighScoreStorage
  private readonly audio: AudioManager

  private readonly resizeObserver: ResizeObserver
  private readonly handleVisibilityChange: () => void
  private readonly handleKeyDown: (event: KeyboardEvent) => void

  private frameId: number | null = null
  private lastFrameTime = 0
  private elapsedSeconds = 0
  private currentQuality: GameQuality = DEFAULT_QUALITY
  private currentPixelRatio = 1
  private destroyed = false
  private readyEmitted = false
  private suppressEvents = false

  // FPS 统计
  private fpsFrameCount = 0
  private fpsAccumulator = 0
  private currentFps = 0

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

    this.scene = new Scene()
    this.scene.background = new Color('#050a14')

    this.camera = new PerspectiveCamera(CAMERA_FOV, 16 / 9, CAMERA_NEAR, CAMERA_FAR)

    this.world = createWorld()
    this.scene.add(this.world.root)

    this.player = new Player()
    this.scene.add(this.player.object)

    // M4 输入整合：KeyboardInput + TouchInput → InputManager
    this.keyboard = new KeyboardInput(window)
    this.touch = new TouchInput()
    this.input = new InputManager(this.keyboard, this.touch)
    this.movement = new MovementSystem(this.player)
    this.cameraFollow = new CameraFollowSystem(this.camera)
    this.cameraFollow.snapTo(this.player.object.position)
    this.occlusion = new OcclusionSystem(this.camera, this.world.occluders)

    // 能量晶体（M3）
    this.collectiblesRoot = new Group()
    this.collectiblesRoot.name = 'collectibles'
    this.scene.add(this.collectiblesRoot)

    this.collectibles = COLLECTIBLE_POSITIONS.map((pos) => {
      const c = new Collectible(pos.x, pos.z)
      this.collectiblesRoot.add(c.object)
      return c
    })

    // GameSession（M3）
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
      onTimerUpdated: (remainingSeconds) => this.emit({ type: 'TIMER_UPDATED', remainingSeconds }),
      onGameWon: () => {
        const snap = this.session.snapshot
        this.highScore.tryUpdate(snap.score)
        this.audio.playWin()
        this.emit({
          type: 'GAME_WON',
          score: snap.score,
          collected: snap.collectedCount,
          total: snap.totalCollectibles,
        })
      },
      onGameOver: () => {
        const snap = this.session.snapshot
        this.highScore.tryUpdate(snap.score)
        this.audio.playLose()
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

    // CollectionSystem：收集时播放音效
    this.collection = new CollectionSystem(this.session, {
      onCollected: () => {
        this.audio.playCollect()
      },
    })

    // 最高分
    this.highScore = new HighScoreStorage()

    // 音效（需等用户交互后 unlock）
    this.audio = new AudioManager()

    // 页面切换后台自动暂停 + 清理输入
    this.handleVisibilityChange = () => {
      if (document.hidden) {
        this.input.setEnabled(false)
        if (this.session.currentState === 'playing') {
          this.session.pause()
        }
      }
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // M4 Esc 快捷键
    this.handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Escape') return
      // 焦点在 input/textarea/contenteditable 时不劫持
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      // unlock audio（Esc 也算用户交互）
      this.audio.unlock()

      const state = this.session.currentState
      if (state === 'playing') {
        if (this.session.pause()) this.input.setEnabled(false)
      } else if (state === 'paused') {
        if (this.session.resume()) {
          this.input.setEnabled(true)
          this.lastFrameTime = performance.now()
        }
      }
    }
    window.addEventListener('keydown', this.handleKeyDown)

    // 应用画质
    this.applyQuality(DEFAULT_QUALITY)

    this.mount.appendChild(this.renderer.domElement)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.mount)
    this.resize()
  }

  /** 处理来自 Vue 层的命令。 */
  command(command: GameCommand): void {
    if (this.destroyed) return

    // 任何命令到达都视为用户交互，unlock audio
    this.audio.unlock()

    switch (command.type) {
      case 'START': {
        if (this.session.currentState === 'menu') {
          this.session.start()
          this.resetForNewGame()
          this.session.notifyReady()
          this.input.setEnabled(true)
        }
        break
      }
      case 'PAUSE': {
        if (this.session.pause()) {
          this.input.setEnabled(false)
        }
        break
      }
      case 'RESUME': {
        if (this.session.resume()) {
          this.input.setEnabled(true)
          this.lastFrameTime = performance.now()
        }
        break
      }
      case 'RESTART': {
        if (this.session.restart()) {
          this.resetForNewGame()
          this.session.notifyReady()
          this.input.setEnabled(true)
        }
        break
      }
      case 'EXIT_TO_MENU': {
        if (this.session.exitToMenu()) {
          this.input.setEnabled(false)
          this.movement.reset()
          this.cameraFollow.snapTo(this.player.object.position)
        }
        break
      }
      case 'SET_QUALITY': {
        this.applyQuality(command.quality)
        break
      }
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

  /** 当前最高分，读取 localStorage。 */
  getHighScore(): number {
    return this.highScore.get()
  }

  /** 触控摇杆逻辑接收器，供 TouchControls.vue 注入。 */
  getTouchReceiver(): TouchInput {
    return this.touch
  }

  /** 音频管理器，供 UI 切换静音。 */
  getAudioManager(): AudioManager {
    return this.audio
  }

  /** 性能快照（开发模式面板使用）。 */
  getPerformanceStats(): PerformanceStats {
    const info = this.renderer.info
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    }
  }

  /** 实时 FPS（每秒更新一次）。 */
  getFps(): number {
    return this.currentFps
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

    window.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.input.setEnabled(false)
    this.keyboard.destroy()
    this.audio.dispose()

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

  /** 应用画质档位（构造时 + 运行时 SET_QUALITY 命令调用）。 */
  private applyQuality(quality: GameQuality): void {
    const settings = QUALITY_PRESETS[quality]
    if (!settings) return

    this.currentQuality = quality

    // 1. 渲染器阴影
    this.renderer.shadowMap.enabled = settings.shadowsEnabled
    if (settings.shadowsEnabled) {
      this.renderer.shadowMap.type = PCFShadowMap
    }

    // 2. 更新场景中 DirectionalLight 的阴影（来自 createWorld）
    this.applyShadowToWorld(settings)

    // 3. 雾效
    this.scene.fog = new Fog('#050a14', settings.fogNear, settings.fogFar)

    // 4. pixelRatio 上限：resize 里会重新 clamp 并调用 setPixelRatio
    this.resize()
  }

  private applyShadowToWorld(settings: QualitySettings): void {
    // 遍历 world.root 找 DirectionalLight 并更新
    this.world.root.traverse((obj) => {
      const anyObj = obj as unknown as {
        isDirectionalLight?: boolean
        castShadow?: boolean
        shadow?: {
          mapSize: { set: (w: number, h: number) => void; width?: number; height?: number }
          bias?: number
        }
      }
      if (anyObj.isDirectionalLight) {
        anyObj.castShadow = settings.shadowsEnabled
        if (settings.shadowsEnabled && anyObj.shadow) {
          anyObj.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize)
          anyObj.shadow.bias = settings.shadowBias
          // 重新激活 shadow map（有的 Three.js 版本需要显式 needsUpdate）
          ;(anyObj.shadow as unknown as { needsUpdate?: boolean }).needsUpdate = true
        }
      }
    })
  }

  private readonly tick = (time: number): void => {
    if (this.destroyed) return

    const deltaSeconds = Math.min((time - this.lastFrameTime) / 1000, MAX_FRAME_DELTA_SECONDS)
    this.lastFrameTime = time

    // FPS 统计：每累计 1 秒更新一次 currentFps
    this.fpsFrameCount += 1
    this.fpsAccumulator += deltaSeconds
    if (this.fpsAccumulator >= 1) {
      this.currentFps = Math.round(this.fpsFrameCount / this.fpsAccumulator)
      this.fpsFrameCount = 0
      this.fpsAccumulator = 0
    }

    const state = this.session.currentState

    if (state !== 'menu' && state !== 'error') {
      this.elapsedSeconds += deltaSeconds
      for (const c of this.collectibles) c.update(deltaSeconds, this.elapsedSeconds)
    }

    if (state === 'playing' || state === 'paused') {
      this.world.update(deltaSeconds)
    }

    if (state === 'playing') {
      this.movement.update(deltaSeconds, this.input.direction)

      const { x: px, z: pz } = this.player.object.position
      this.collection.update(px, pz, this.collectibles)

      this.session.update(deltaSeconds)
    }

    if (state !== 'menu' && state !== 'loading') {
      this.cameraFollow.update(this.player.object.position, deltaSeconds)
    }

    this.occlusion.update(this.player.object.position, deltaSeconds)

    this.renderer.render(this.scene, this.camera)

    this.frameId = requestAnimationFrame(this.tick)
  }

  private resize(): void {
    if (this.destroyed) return

    const width = this.mount.clientWidth
    const height = this.mount.clientHeight
    if (width === 0 || height === 0) return

    const settings = QUALITY_PRESETS[this.currentQuality]
    const dpr = Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio)
    if (dpr !== this.currentPixelRatio) {
      this.currentPixelRatio = dpr
      this.renderer.setPixelRatio(dpr)
    }

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
}
