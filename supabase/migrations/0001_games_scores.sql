-- SPEC 06 — Catálogo y leaderboard en Supabase (lectura)
-- Tablas games y scores con RLS de solo lectura pública.
-- La escritura queda pospuesta hasta tener auth real (sin políticas de INSERT/UPDATE/DELETE).

-- games: catálogo (columnas = interfaz Game)
create table public.games (
  id     text primary key,          -- slug: "rocas", "caida", ...
  title  text not null,
  short  text not null,
  long   text not null,
  cat    text not null,             -- ARCADE | PUZZLE | SHOOTER | VERSUS
  cover  text not null,             -- clase CSS de portada
  color  text not null,             -- cyan | magenta | yellow | green
  best   integer not null,
  plays  text not null,             -- display: "12.4K"
  sort   integer not null           -- preserva el orden actual del array
);

-- scores: leaderboard
create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id),
  name       text not null,
  score      integer not null,
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);

-- RLS: lectura pública, sin escritura hasta auth real
alter table public.games  enable row level security;
alter table public.scores enable row level security;
create policy "games_public_read"  on public.games  for select using (true);
create policy "scores_public_read" on public.scores for select using (true);
-- (sin políticas de INSERT/UPDATE/DELETE → escritura denegada por defecto)
