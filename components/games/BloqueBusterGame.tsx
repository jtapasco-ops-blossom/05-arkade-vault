"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createBloqueBusterGame } from "@/lib/games/bloque-buster";
import type { GameEngineRef, GameSnapshot } from "@/lib/games/types";

// Componente cliente que monta el Arkanoid real sobre un canvas 800×600 (mismo
// buffer que Asteroides), corre el loop y sube el snapshot al padre. La ref
// imperativa (pause/resume/forceGameOver/restart) es el contrato común
// GameEngineRef que GamePlayer cablea a los botones del HUD.
export const BloqueBusterGame = forwardRef<
  GameEngineRef,
  { onSnapshot: (snap: GameSnapshot) => void }
>(function BloqueBusterGame({ onSnapshot }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ReturnType<typeof createBloqueBusterGame> | null>(null);

  // onSnapshot puede cambiar de identidad; lo guardamos en una ref para no
  // reiniciar el juego en cada render.
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createBloqueBusterGame(canvas, (snap) => onSnapshotRef.current(snap));
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    pause: () => gameRef.current?.pause(),
    resume: () => gameRef.current?.resume(),
    forceGameOver: () => gameRef.current?.forceGameOver(),
    restart: () => gameRef.current?.restart(),
  }));

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="bricks-canvas"
      tabIndex={0}
      aria-label="Juego de bloques"
    />
  );
});
