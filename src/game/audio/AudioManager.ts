/**
 * AudioManager：用 Web Audio API 合成轻量事件音效，不依赖外部素材。
 * 遵守浏览器自动播放限制——AudioContext 在第一次 unlock()（用户交互后）才真正激活。
 */

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private muted = false
  private unlocked = false

  // 记录活动节点，方便释放
  private readonly activeNodes: Set<AudioBufferSourceNode | OscillatorNode> = new Set()

  /**
   * 在第一次用户交互时调用（click / pointerdown / keydown），
   * 激活 AudioContext。调用失败不抛异常。
   */
  unlock(): void {
    if (this.unlocked) return
    try {
      const windowMaybe =
        typeof window !== 'undefined'
          ? (window as unknown as {
              AudioContext?: typeof AudioContext
              webkitAudioContext?: typeof AudioContext
            })
          : null
      const Ctor = windowMaybe?.AudioContext ?? windowMaybe?.webkitAudioContext
      if (!Ctor) {
        this.unlocked = true // 标记已尝试
        return
      }

      this.ctx = new Ctor()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.6
      this.masterGain.connect(this.ctx.destination)
      this.unlocked = true
    } catch {
      this.unlocked = true
    }
  }

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    const ctx = this.ctx
    const gain = this.masterGain
    if (ctx && gain) {
      gain.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.02)
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** 收集晶体：清脆上扬方波。 */
  playCollect(): void {
    this.playToneSequence(
      [
        { freq: 720, duration: 0.07, wave: 'triangle', gain: 0.35 },
        { freq: 1040, duration: 0.09, wave: 'triangle', gain: 0.3 },
      ],
      0.05,
    )
  }

  /** 胜利：三音上行琶音。 */
  playWin(): void {
    this.playToneSequence(
      [
        { freq: 523.25, duration: 0.16, wave: 'triangle', gain: 0.35 },
        { freq: 659.25, duration: 0.16, wave: 'triangle', gain: 0.35 },
        { freq: 783.99, duration: 0.28, wave: 'triangle', gain: 0.38 },
      ],
      0.18,
    )
  }

  /** 失败：下行低沉方波。 */
  playLose(): void {
    this.playToneSequence(
      [
        { freq: 220, duration: 0.22, wave: 'sawtooth', gain: 0.3 },
        { freq: 164.8, duration: 0.4, wave: 'sawtooth', gain: 0.3 },
      ],
      0.15,
    )
  }

  /** 释放所有音频资源（页面卸载、组件卸载时调用）。 */
  dispose(): void {
    this.activeNodes.forEach((node) => {
      try {
        node.stop()
      } catch {
        /* ignore */
      }
      try {
        node.disconnect()
      } catch {
        /* ignore */
      }
    })
    this.activeNodes.clear()

    if (this.masterGain) {
      try {
        this.masterGain.disconnect()
      } catch {
        /* ignore */
      }
      this.masterGain = null
    }
    if (this.ctx) {
      try {
        void this.ctx.close()
      } catch {
        /* ignore */
      }
      this.ctx = null
    }
    this.unlocked = false
  }

  // ---------- 内部 ----------

  private playToneSequence(
    tones: ReadonlyArray<{ freq: number; duration: number; wave: OscillatorType; gain: number }>,
    gap: number,
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return

    const now = this.ctx.currentTime
    let t = now
    for (const tone of tones) {
      this.scheduleTone(tone, t)
      t += tone.duration + gap
    }
  }

  private scheduleTone(
    tone: { freq: number; duration: number; wave: OscillatorType; gain: number },
    startTime: number,
  ): void {
    const ctx = this.ctx
    const masterGain = this.masterGain
    if (!ctx || !masterGain || this.muted) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = tone.wave
      osc.frequency.setValueAtTime(tone.freq, startTime)

      const attack = Math.min(0.015, tone.duration * 0.25)
      const release = Math.min(0.05, tone.duration * 0.4)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(tone.gain, startTime + attack)
      gain.gain.setValueAtTime(tone.gain, startTime + tone.duration - release)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + tone.duration)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(startTime)
      osc.stop(startTime + tone.duration + 0.02)

      this.activeNodes.add(osc)
      osc.onended = () => {
        this.activeNodes.delete(osc)
        try {
          osc.disconnect()
          gain.disconnect()
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* 播放失败不影响游戏 */
    }
  }
}
