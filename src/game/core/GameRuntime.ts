import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'

import type { GameEvent } from '../../types/game'
import { createWorld, type World } from '../scene/createWorld'
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

export class GameRuntime {
  private readonly mount: HTMLElement
  private readonly onEvent: ((event: GameEvent) => void) | undefined
  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly world: World
  private readonly resizeObserver: ResizeObserver

  private frameId: number | null = null
  private lastFrameTime = 0
  private pixelRatio = 1
  private destroyed = false
  private readyEmitted = false

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
    this.camera.position.set(13, 10, 17)
    this.camera.lookAt(0, 2.2, 0)

    this.world = createWorld()
    this.scene.add(this.world.root)

    this.mount.appendChild(this.renderer.domElement)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.mount)
    this.resize()
  }

  start(): void {
    if (this.destroyed || this.frameId !== null) return

    this.resize()
    this.renderer.render(this.scene, this.camera)

    if (!this.readyEmitted) {
      this.readyEmitted = true
      this.onEvent?.({ type: 'READY' })
    }

    this.lastFrameTime = performance.now()
    this.frameId = requestAnimationFrame(this.tick)
  }

  /** 幂等：重复调用或 start 前调用都安全。 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

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

  private readonly tick = (time: number): void => {
    if (this.destroyed) return

    const deltaSeconds = Math.min((time - this.lastFrameTime) / 1000, MAX_FRAME_DELTA_SECONDS)
    this.lastFrameTime = time

    this.world.update(deltaSeconds)
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
