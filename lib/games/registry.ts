// Registro de engines de juego, indexado por `game.id` (el slug que ya viene de
// Supabase). GamePlayer resuelve el componente con `ENGINES[game.id]`; si no hay
// entrada, cae al reproductor simulado. Añadir un juego jugable = una línea aquí.

import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { GameEngineRef, GameSnapshot } from "@/lib/games/types";
import { AsteroidsGame } from "@/components/games/AsteroidsGame";
import { TetrisGame } from "@/components/games/TetrisGame";
import { BloqueBusterGame } from "@/components/games/BloqueBusterGame";

export type GameEngineComponent = ForwardRefExoticComponent<
  { onSnapshot: (snap: GameSnapshot) => void } & RefAttributes<GameEngineRef>
>;

export const ENGINES: Record<string, GameEngineComponent> = {
  rocas: AsteroidsGame,
  caida: TetrisGame,
  "bloque-buster": BloqueBusterGame,
};
