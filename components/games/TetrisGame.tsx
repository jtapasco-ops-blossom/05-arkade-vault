"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createTetrisGame } from "@/lib/games/tetris";
import type { GameEngineRef, GameSnapshot } from "@/lib/games/types";

// Teclas que refleja el panel de feedback (abajo-derecha).
type KeyName = "ArrowLeft" | "ArrowRight" | "ArrowDown" | "Shift" | "Space" | "Escape";

function codeToKey(code: string): KeyName | null {
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "ArrowLeft" || code === "ArrowRight" || code === "ArrowDown" || code === "Space" || code === "Escape") {
    return code;
  }
  return null;
}

// Componente cliente que monta el Tetris real: el tablero (300×600) y el preview
// de la siguiente pieza (120×120), corre el loop y sube el snapshot al padre.
// La ref imperativa (pause/resume/forceGameOver/restart) es el contrato común
// GameEngineRef que GamePlayer cablea a los botones.
export const TetrisGame = forwardRef<GameEngineRef, { onSnapshot: (snap: GameSnapshot) => void }>(
  function TetrisGame({ onSnapshot }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<ReturnType<typeof createTetrisGame> | null>(null);

    // onSnapshot puede cambiar de identidad; lo guardamos en una ref para no
    // reiniciar el juego en cada render.
    const onSnapshotRef = useRef(onSnapshot);
    onSnapshotRef.current = onSnapshot;

    // Estado de teclas activas para el feedback visual (no afecta al engine).
    const [active, setActive] = useState<Partial<Record<KeyName, boolean>>>({});

    useEffect(() => {
      const board = boardRef.current;
      const nextCanvas = nextRef.current;
      if (!board || !nextCanvas) return;

      const game = createTetrisGame(board, nextCanvas, (snap) => onSnapshotRef.current(snap));
      gameRef.current = game;
      game.start();

      return () => {
        game.destroy();
        gameRef.current = null;
      };
    }, []);

    // Panel de teclas: enciende/apaga cada tecla según keydown/keyup (solo visual).
    useEffect(() => {
      const down = (e: KeyboardEvent) => {
        const key = codeToKey(e.code);
        if (key) setActive((a) => (a[key] ? a : { ...a, [key]: true }));
      };
      const up = (e: KeyboardEvent) => {
        const key = codeToKey(e.code);
        if (key) setActive((a) => ({ ...a, [key]: false }));
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      forceGameOver: () => gameRef.current?.forceGameOver(),
      restart: () => gameRef.current?.restart(),
    }));

    const kc = (key: KeyName) => `kc${active[key] ? " on" : ""}`;

    return (
      <div className="tetris-stage">
        <canvas ref={boardRef} width={300} height={600} className="tetris-board" aria-label="Tablero de Tetris" />

        <div className="tetris-side">
          <div className="tetris-next-label">SIGUIENTE</div>
          <canvas ref={nextRef} width={120} height={120} className="tetris-next" aria-label="Siguiente pieza" />
        </div>

        <div className="tetris-keys" aria-hidden="true">
          <div className="row">
            <span className={kc("ArrowLeft")}>←</span>
            <span className={kc("ArrowDown")}>↓</span>
            <span className={kc("ArrowRight")}>→</span>
          </div>
          <div className="row">
            <span className={kc("Shift")}>⟳ ROTAR</span>
            <span className={kc("Space")}>␣ CAÍDA</span>
            <span className={kc("Escape")}>ESC</span>
          </div>
        </div>
      </div>
    );
  },
);
