// Contrato común a todos los engines de juego (canvas) del reproductor.
// GamePlayer trata a cualquier engine a través de estos tipos, sin conocer su
// implementación concreta. Cada engine (asteroids, tetris, …) los cumple.

export type GameState = "playing" | "dead" | "gameover";

// Estado que el engine sube a React (HUD + fin de partida). Se emite solo
// cuando cambia alguno de estos campos, no cada frame.
export interface GameSnapshot {
  score: number;
  lives: number;
  level: number;
  state: GameState;
}

// Ref imperativa que el componente del juego expone a GamePlayer para cablear
// los botones PAUSA / REANUDAR / FIN / JUGAR DE NUEVO.
export interface GameEngineRef {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}
