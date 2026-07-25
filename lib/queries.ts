// ===== lib/queries.ts — lecturas server-only de Supabase (SPEC 06) =====
// Usa cookies() de next/headers, así que solo puede ejecutarse en el servidor.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Game, ScoreRow } from "@/lib/data";

export async function getGames(): Promise<Game[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from("games").select("*").order("sort");
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Game) ?? null;
}

export async function getScores(gameId?: string, limit?: number): Promise<ScoreRow[]> {
  const supabase = createClient(await cookies());
  let query = supabase.from("scores").select("*").order("score", { ascending: false });
  if (gameId) query = query.eq("game_id", gameId);
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScoreRow[];
}
