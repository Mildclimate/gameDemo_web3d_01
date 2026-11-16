import { Raycaster, Vector3, type Camera, type Material, type Mesh } from 'three'

/** 被角色挡住时材质的不透明度。 */
const OCCLUDED_OPACITY = 0.2
/** 变透明时的平滑系数（越大越快）。 */
const FADE_LAMBDA = 14
/** 恢复不透明时的平滑系数。 */
const RESTORE_LAMBDA = 8
/** 射线检测间隔（秒），避免每帧都对整个场景求交。 */
const RAYCAST_INTERVAL = 0.05
/** 玩家身上的采样高度（相对脚底），覆盖腿、躯干与头部。 */
const ANCHOR_HEIGHTS = [0.6, 1.25, 1.85] as const

interface OccluderState {
  readonly material: Material
  readonly castShadow: boolean
  opacity: number
}

/**
 * 第三人称遮挡透明：从摄像机向角色身上的若干采样点发射射线，
 * 被角色挡住的实体逐渐变透明，角色重新露出后恢复不透明。
 *
 * 材质在首次被遮挡时才克隆，避免影响场景中共享材质的其他 Mesh。
 */
export class OcclusionSystem {
  private readonly camera: Camera
  private readonly occluders: Mesh[]
  private readonly raycaster = new Raycaster()
  private readonly anchor = new Vector3()
  private readonly direction = new Vector3()
  private readonly occludedMeshes = new Set<Mesh>()
  private readonly states = new Map<Mesh, OccluderState>()

  private raycastTimer = 0

  constructor(camera: Camera, occluders: readonly Mesh[]) {
    this.camera = camera
    this.occluders = [...occluders]
  }

  update(playerPosition: Vector3, deltaSeconds: number): void {
    this.raycastTimer += deltaSeconds
    if (this.raycastTimer >= RAYCAST_INTERVAL) {
      this.raycastTimer = 0
      this.refreshOccluded(playerPosition)
    }
    this.updateOpacities(deltaSeconds)
  }

  /** 找出当前位于摄像机与角色连线上的实体。 */
  private refreshOccluded(playerPosition: Vector3): void {
    this.occludedMeshes.clear()

    for (const height of ANCHOR_HEIGHTS) {
      this.anchor.set(playerPosition.x, playerPosition.y + height, playerPosition.z)
      this.direction.subVectors(this.anchor, this.camera.position)
      const distance = this.direction.length()
      if (distance < 0.001) continue

      this.raycaster.set(this.camera.position, this.direction.divideScalar(distance))
      this.raycaster.far = distance

      for (const hit of this.raycaster.intersectObjects(this.occluders, false)) {
        this.occludedMeshes.add(hit.object as Mesh)
      }
    }
  }

  /** 让被遮挡的实体平滑变透明，离开遮挡后平滑恢复。 */
  private updateOpacities(deltaSeconds: number): void {
    for (const mesh of this.occluders) {
      const occluded = this.occludedMeshes.has(mesh)
      // 从未被遮挡过且当前不透明，无需处理
      if (!occluded && !this.states.has(mesh)) continue

      const state = this.getState(mesh)
      const target = occluded ? OCCLUDED_OPACITY : 1
      const lambda = occluded ? FADE_LAMBDA : RESTORE_LAMBDA
      const blend = 1 - Math.exp(-lambda * deltaSeconds)

      state.opacity += (target - state.opacity) * blend
      if (Math.abs(target - state.opacity) < 0.005) state.opacity = target

      this.applyState(mesh, state)
    }
  }

  private getState(mesh: Mesh): OccluderState {
    const existing = this.states.get(mesh)
    if (existing) return existing

    // 独占材质，避免共享材质的其他 Mesh 一起变透明
    const material = (mesh.material as Material).clone()
    mesh.material = material

    const state: OccluderState = {
      material,
      castShadow: mesh.castShadow,
      opacity: 1,
    }
    this.states.set(mesh, state)
    return state
  }

  private applyState(mesh: Mesh, state: OccluderState): void {
    const transparent = state.opacity < 0.995

    state.material.opacity = state.opacity
    if (state.material.transparent !== transparent) {
      state.material.transparent = transparent
      state.material.needsUpdate = true
    }
    state.material.depthWrite = !transparent
    mesh.castShadow = transparent ? false : state.castShadow
  }
}
