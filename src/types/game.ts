export type GameState = 'menu' | 'loading' | 'playing' | 'paused' | 'success' | 'failed' | 'error'

export type GameQuality = 'low' | 'medium' | 'high'

export type GameCommand =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'SET_QUALITY'; quality: GameQuality }

export type GameEvent =
  | { type: 'LOADING_PROGRESS'; progress: number }
  | { type: 'READY' }
  | { type: 'SCORE_CHANGED'; score: number; collected: number }
  | { type: 'TIME_CHANGED'; remainingSeconds: number }
  | { type: 'STATE_CHANGED'; state: GameState }
  | { type: 'GAME_ENDED'; score: number; collected: number; elapsedSeconds: number }
  | { type: 'ERROR'; message: string }
