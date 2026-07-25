# SPEC 06 — Catálogo y leaderboard en Supabase (lectura)

> **Estado:** Implementado
> **Depende de:** [SPEC 04 — Conexión a Supabase](./04-conexion-supabase.md) (clientes server/browser) · [SPEC 05 — Juego de Asteroides real](./05-juego-asteroides-rocas.md) (flujo de guardado en GamePlayer)
> **Fecha:** 2026-07-24
> **Objetivo:** Mover el catálogo de juegos y el leaderboard del Salón de la Fama a dos tablas de Supabase (`games` y `scores`) de solo lectura pública sembradas con los datos actuales, dejando la escritura de puntajes pospuesta hasta tener auth real.

## Por qué existe este spec

El spec 04 dejó la conexión a Supabase lista pero difirió explícitamente el
leaderboard real y cualquier tabla de datos. Hoy el catálogo vive hardcodeado en
el array `GAMES` de `lib/data.ts` y el Salón de la Fama muestra puntajes
inventados (`seededScores`) que se pierden entre sesiones. Este spec da el
siguiente paso mínimo: persistir catálogo y puntajes en Supabase y que la app los
lea desde ahí. La **escritura** de puntajes se pospone a propósito hasta tener
auth real (spec futuro), así que ambas tablas quedan de **solo lectura pública**.

## Alcance

**Dentro:**

- Crear la tabla `games` en Supabase (columnas 1:1 con la interfaz `Game`) con RLS: `SELECT` público, sin políticas de escritura.
- Crear la tabla `scores` en Supabase (`id`, `game_id`, `name`, `score`, `created_at`) con RLS: `SELECT` público, sin políticas de escritura.
- Sembrar `games` con los 8 juegos actuales y `scores` con ~10 filas por juego (nombres del set `PLAYERS` actual) para que el Salón no arranque vacío.
- Guardar el SQL en un archivo versionado del repo (`supabase/migrations/0001_games_scores.sql`) y aplicarlo al proyecto Supabase.
- Crear `lib/queries.ts` (server-only) con `getGames()` y `getScores(gameId?, limit?)` usando el cliente server de `lib/supabase/server.ts`.
- Cablear las lecturas: `app/games/page.tsx`, `app/games/[id]/page.tsx`, `app/games/[id]/play/page.tsx`, `app/page.tsx` y `app/hall-of-fame/page.tsx` obtienen los datos en el servidor y los pasan por props.
- Adaptar los componentes cliente a recibir props en vez de importar datos: `HallOfFame` (games + scores), `Home` (games para el preview), `GameDetail` (scores del juego).
- Deshabilitar el botón "GUARDAR PUNTUACIÓN" en `GamePlayer.tsx` con un aviso "próximamente con tu cuenta"; el modal de fin sigue mostrando el score real.
- Limpiar `lib/data.ts`: conservar `Game`, `GameCategory` y `CATS`; eliminar el array `GAMES` y la función `seededScores` (ya sin uso en runtime).

**Fuera de alcance (para specs futuros):**

- Autenticación real de Supabase (login/registro/OAuth/invitado). Sigue mock (`SessionProvider`).
- Escritura de puntajes reales (INSERT en `scores`). Se habilita cuando exista auth real, en su propio spec.
- Recalcular `best`/`plays` a partir de `scores`; se siembran como columnas estáticas.
- Paginación, filtros o búsqueda sobre el leaderboard.
- Tipos generados automáticamente de Supabase (`generate_typescript_types`); los tipos se declaran a mano.
- Realtime / suscripciones a cambios de las tablas.

## Modelo de datos

Dos tablas nuevas en Supabase. Los nombres de columna de `games` coinciden 1:1 con
la interfaz `Game` existente para que un `select *` mapee sin transformar.

```sql
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
```

**Tipos en `lib/data.ts`** (se conserva `Game`; se añade el tipo de fila del
leaderboard, reemplazando al viejo `ScoreRow` de `seededScores`):

```ts
export interface Game { /* sin cambios: id, title, short, long, cat, cover, color, best, plays */ }

// fila leída de la tabla scores (rank y fecha se derivan en la UI)
export interface ScoreRow {
  id: number;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
}
```

**Notas:**

- Se añade la columna `sort` a `games` porque el array actual tiene un orden intencional que un `select` no garantiza; las queries ordenan por `sort`.
- El `rank` del podio/tabla y la fecha `dd/mm/aaaa` se calculan en la UI a partir del orden por `score desc` y de `created_at` (no se guardan).
- `game_id` es FK a `games.id`; no hay `on delete cascade` porque el catálogo no se borra en este spec.

## Plan de implementación

> Antes de tocar páginas o data-fetching, consultar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (Server Components y paso de props a Client Components). Las lecturas son server-side; los componentes de UI sensibles a interacción siguen `'use client'`.

1. **Migración SQL.** Crear `supabase/migrations/0001_games_scores.sql` con las tablas `games` y `scores`, índices, RLS y las políticas de `SELECT` público. Aplicarlo al proyecto (vía `apply_migration`).
   _Verificación:_ `list_tables` muestra ambas tablas con RLS activo y sus policies de select.

2. **Semillas.** En el mismo archivo (o `0002_seed.sql`), insertar los 8 juegos con su `sort` y ~10 filas de `scores` por juego (nombres de `PLAYERS`, scores decrecientes, fechas variadas). Aplicarlo.
   _Verificación:_ `select count(*) from games` = 8; `select count(*) from scores` ≈ 80; un `select` por juego devuelve filas ordenables por `score desc`.

3. **Capa de queries.** Crear `lib/queries.ts` (server-only) con `getGames(): Promise<Game[]>` (order by `sort`) y `getScores(gameId?, limit?): Promise<ScoreRow[]>` (order by `score desc`), usando `createClient(await cookies())` de `lib/supabase/server.ts`.
   _Verificación:_ `npm run build` compila; una llamada de prueba devuelve filas.

4. **Actualizar tipos y limpiar `lib/data.ts`.** Conservar `Game`, `GameCategory`, `CATS`; reemplazar el viejo `ScoreRow` por el nuevo tipo de fila; eliminar el array `GAMES` y la función `seededScores`.
   _Verificación:_ `npm run build` falla solo donde aún se importan `GAMES`/`seededScores` (guía para los pasos 5–6); tras cablear, compila limpio.

5. **Cablear páginas server.** `app/games/page.tsx`, `app/games/[id]/page.tsx`, `app/games/[id]/play/page.tsx`, `app/page.tsx` y `app/hall-of-fame/page.tsx` obtienen datos con `getGames`/`getScores` y los pasan por props. El detalle y el play resuelven el juego por `id` desde `getGames()` (o un `getGame(id)`), con `notFound()` si no existe.
   _Verificación:_ cada ruta carga con datos reales de Supabase; `/games/xxx` inexistente da 404.

6. **Adaptar componentes cliente a props.** `Home` recibe `games` (preview); `HallOfFame` recibe `games` + `scores` (filtra por tab en cliente, deriva rank/fecha); `GameDetail` recibe `scores` del juego. Ninguno importa ya de `lib/data.ts` salvo tipos.
   _Verificación:_ el Salón muestra podio y tabla desde `scores`; el preview del home y el top del detalle salen de la DB.

7. **Deshabilitar el guardado en `GamePlayer.tsx`.** El botón "GUARDAR PUNTUACIÓN" queda deshabilitado con aviso "próximamente con tu cuenta"; se elimina la llamada a `saveScore`. Quitar `saveScore` de `SessionProvider` si queda huérfano.
   _Verificación:_ al terminar una partida (p. ej. `rocas`) el modal muestra el score real pero no escribe; no hay errores en consola.

8. **Regresión y limpieza.** Verificar que no quedan imports de `GAMES`/`seededScores`, ni escrituras a `localStorage` de puntajes.
   _Verificación:_ `npm run build` y `npm run dev` sin errores; `/`, `/games`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`, `/about`, `/auth` cargan sin regresiones.

## Criterios de aceptación

- [ ] Existen las tablas `public.games` y `public.scores` en Supabase con RLS activo.
- [ ] `games` tiene política `SELECT` pública y **ninguna** de INSERT/UPDATE/DELETE.
- [ ] `scores` tiene política `SELECT` pública y **ninguna** de INSERT/UPDATE/DELETE.
- [ ] Un intento de `INSERT` en `scores` desde el cliente público es rechazado por RLS.
- [ ] `games` contiene los 8 juegos; `scores` contiene ~10 filas por juego.
- [ ] El SQL vive en `supabase/migrations/0001_games_scores.sql` en el repo.
- [ ] Existe `lib/queries.ts` con `getGames()` y `getScores(gameId?, limit?)` usando el cliente server.
- [ ] `lib/data.ts` ya no exporta `GAMES` ni `seededScores`; sí conserva `Game`, `GameCategory` y `CATS`.
- [ ] `/games` lista los juegos leídos de Supabase; `/games/[id]` y `/games/[id]/play` los resuelven desde la DB (404 si el `id` no existe).
- [ ] El preview del home (`/`) muestra juegos desde la DB.
- [ ] El Salón de la Fama (`/hall-of-fame`) muestra podio y tabla desde `scores`, con `rank` y fecha derivados en la UI.
- [ ] El detalle de juego muestra su top de puntajes desde `scores`.
- [ ] En el fin de partida, "GUARDAR PUNTUACIÓN" está deshabilitado con aviso y no escribe en ningún lado.
- [ ] `npm run build` termina sin errores y las rutas existentes cargan sin regresiones en consola.

## Decisiones tomadas y descartadas

- **Sí:** dos tablas `games` y `scores` con columnas 1:1 con `Game`. Un `select *` mapea directo al tipo existente sin capa de transformación.
- **Sí:** lecturas server-side en las páginas + props a los componentes cliente. Es el patrón de App Router de Next 16; evita exponer un segundo cliente y mantiene los componentes de UI como puros receptores de props.
- **Sí:** RLS de solo lectura pública, sin políticas de escritura. Coherente con "esperar a auth real": sin política de INSERT, la escritura queda denegada por defecto sin código extra.
- **Sí:** columna `sort` en `games`. Un `select` sin `order by` no garantiza el orden; `sort` preserva el orden intencional del array actual.
- **Sí:** sembrar `scores` (~10/juego) además de `games`. El Salón y el detalle no deben verse vacíos antes de que existan partidas reales.
- **Sí:** deshabilitar "GUARDAR PUNTUACIÓN" con aviso. Sin auth real no hay identidad que atribuir; escribir a localStorage sería una escritura huérfana desconectada del leaderboard.
- **Sí:** conservar `best`/`plays` como columnas estáticas sembradas. Derivarlas de `scores` es lógica que nadie pidió (YAGNI) y no aporta al objetivo.
- **No:** híbrido leer-de-Supabase / escribir-a-localStorage. Deja dos fuentes de verdad inconsistentes.
- **No:** tipos generados de Supabase. Para dos tablas, los tipos a mano son más simples y no añaden un paso de build.
- **No:** realtime/paginación/filtros. Fuera de "algo sencillo"; van en specs futuros si aterrizan.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Sin políticas de escritura, un futuro flujo de guardado fallará silenciosamente si nadie recuerda añadir la policy de INSERT. | Este spec documenta que la escritura está pospuesta; el spec de auth real debe añadir la policy de INSERT junto con la identidad. |
| `select` sin `order by` devuelve filas en orden arbitrario y rompe el orden del catálogo. | Columna `sort` + `order by sort` en `getGames()`. |
| Nombres de columna `short`/`long` podrían chocar con expectativas de palabras reservadas. | Son identificadores no reservados válidos en Postgres; se usan tal cual para mantener el mapeo 1:1 con `Game`. |
| Componentes cliente (`HallOfFame`, `Home`) hoy importan datos directamente; al pasar a props puede romperse el render si algún consumidor no recibe la prop. | El build de TypeScript marca cada sitio que aún importa `GAMES`/`seededScores` (paso 4) como guía de qué cablear. |
| Vars de entorno de Supabase ausentes en runtime hacen fallar las lecturas server-side de todas las páginas. | Ya cubierto por spec 04 (`.env.local` + `.env.example`); las lecturas fallan de forma visible en build/dev, no en silencio. |

## Lo que **no** está en este spec

- Autenticación real de Supabase (login/registro/OAuth/invitado).
- Escritura de puntajes reales (INSERT en `scores`) y su policy de RLS.
- Recalcular `best`/`plays` desde `scores`.
- Realtime, paginación, filtros o búsqueda del leaderboard.
- Tipos generados automáticamente de Supabase.

Cada uno, si aterriza, va en su propio spec.
