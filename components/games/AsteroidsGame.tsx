"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createAsteroidsGame, type AsteroidsGameHandle } from "@/lib/games/asteroids";
import type { GameEngineRef, GameSnapshot } from "@/lib/games/types";

export const AsteroidsGame = forwardRef<GameEngineRef, { onSnapshot: (snap: GameSnapshot) => void }>(
  function AsteroidsGame({ onSnapshot }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<AsteroidsGameHandle | null>(null);

    // onSnapshot puede cambiar de identidad; lo guardamos en una ref para no
    // reiniciar el juego en cada render.
    const onSnapshotRef = useRef(onSnapshot);
    onSnapshotRef.current = onSnapshot;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const game = createAsteroidsGame(canvas, (snap) => onSnapshotRef.current(snap));
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
        className="asteroids-canvas"
        tabIndex={0}
        aria-label="Juego de asteroides"
      />
    );
  },
);
