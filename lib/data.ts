// ===== lib/data.ts — tipos compartidos del dominio =====
// El catálogo (games) y el leaderboard (scores) viven en Supabase (SPEC 06);
// aquí solo quedan los tipos y las categorías usadas por la UI.

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const CATS: readonly string[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

// Fila leída de la tabla scores. El rank y la fecha dd/mm/aaaa se derivan en la UI.
export interface ScoreRow {
  id: number;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
}
