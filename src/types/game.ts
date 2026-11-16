export type GameState = 'menu' | 'loading' | 'playing' | 'paused' | 'success' | 'failed' | 'error'

export type GameQuality = 'low' | 'medium' | 'high'

export type GameCommand =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'EXIT_TO_MENU' }
  | { type: 'SET_QUALITY'; quality: GameQuality }

export type GameEvent =
  | { type: 'LOADING_PROGRESS'; progress: number }
  | { type: 'READY' }
  | { type: 'STATE_CHANGED'; state: GameState }
  | { type: 'SCORE_CHANGED'; score: number; collected: number }
  | { type: 'TIMER_UPDATED'; remainingSeconds: number }
  | { type: 'COLLECTIBLE_COLLECTED'; collected: number; total: number; score: number }
  | { type: 'GAME_WON'; score: number; collected: number; total: number }
  | { type: 'GAME_OVER'; score: number; collected: number; total: number }
  | { type: 'EXIT_TO_MENU' }
  | { type: 'RESTARTED' }
  | { type: 'ERROR'; message: string }
