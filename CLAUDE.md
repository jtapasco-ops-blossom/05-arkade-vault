# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: read the local Next.js docs first

This repo pins **Next.js 16.2.9** (with React 19.2.4), which has breaking changes vs. older Next.js you may know. Before writing any App Router, routing, config, or data-fetching code, read the relevant guide under `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`). Do not rely on training-data conventions.

Notably: `proxy.ts` at the repo root is this version's middleware entry point (exports `proxy` + `config.matcher`), and `params` in page props is a `Promise` that must be awaited.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config: `next/core-web-vitals` + `next/typescript`)

There is no test runner configured yet.

## Skills

- **`/frontend-design`** — usa siempre este skill para hacer interfaces de usuario.
- **`/spec`** → **`/spec-impl`** — el ciclo Spec Driven Design del proyecto (ver _Workflow_).
- **`/add-game`** — genera el spec para añadir un juego jugable nuevo (engine de canvas + leaderboard) siguiendo los patrones de SPEC 05/07/08. No escribe código; produce `specs/NN-juego-<id>.md`. Su mecánica concreta vive en `.claude/skills/add-game/pattern.md`.

Los skills viven en `.claude/skills/` (copiados desde `.agents/skills/`).

## Environment

`.env.local` (plantilla en `.env.example`):

```
RESEND_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Architecture

Next.js **App Router**, TypeScript `strict`, alias `@/*` → raíz del repo. UI en español, rutas en inglés.

### Rutas (`app/`)

| Ruta               | Contenido                                                                   |
| ------------------ | --------------------------------------------------------------------------- |
| `/`                | landing (`components/Home.tsx`)                                             |
| `/games`           | biblioteca (`Library.tsx`) (see more ... `references/implemented-games.md`) |
| `/games/[id]`      | detalle (`GameDetail.tsx`)                                                  |
| `/games/[id]/play` | reproductor (`GamePlayer.tsx`)                                              |
| `/hall-of-fame`    | Salón de la Fama (`HallOfFame.tsx`)                                         |
| `/auth`            | login simulado (`Auth.tsx`)                                                 |
| `/about`           | acerca de + formulario de contacto (`About.tsx`)                            |
| `/api/contact`     | Route Handler que envía el correo con Resend (rate limit en memoria)        |

Las páginas son Server Components que leen datos y delegan el render a un componente cliente en `components/`.

### Datos — Supabase

- **Clientes**: `lib/supabase/server.ts` (cookies), `client.ts` (browser), `proxy.ts` (refresco de sesión, invocado desde `proxy.ts` raíz).
- **Lecturas server-only**: `lib/queries.ts` — `getGames()`, `getGame(id)`, `getScores(gameId?, limit?)`. No hagas `from(...)` suelto en las páginas; añade la query aquí.
- **Tipos de dominio**: `lib/data.ts` (`Game`, `ScoreRow`, `CATS`). Ya no hay catálogo hardcodeado.
- **Esquema**: `supabase/migrations/` — tablas `games` (id = slug) y `scores`, con **RLS de solo lectura pública**. La escritura de puntajes está pospuesta hasta tener auth real, así que el guardado del reproductor aún no persiste.
- La sesión (`components/SessionProvider.tsx`) es un login **simulado** en `localStorage`, no Supabase Auth.

### Juegos — registro de engines

Cada juego jugable es un engine de canvas portado a TypeScript en `lib/games/` (agnóstico de React) con un componente cliente `forwardRef` en `components/games/`. `GamePlayer` resuelve el engine con `ENGINES[game.id]` (`lib/games/registry.ts`); si no hay entrada, cae al reproductor simulado.

- Contrato común: `lib/games/types.ts` — `GameSnapshot` (el engine sube puntaje/vidas/nivel al HUD de React) y `GameEngineRef` (pausa/reanudar/fin/reinicio para los botones).
- Hoy: `rocas` → `AsteroidsGame`, `caida` → `TetrisGame`, `bloque-buster` → `BloqueBusterGame`.
- Buffer de canvas 800×600 escalado a la pantalla CRT (4:3); el selector va en la regla compartida de `app/globals.css` (`.asteroids-canvas, .bricks-canvas`). El HUD y los overlays los pinta React, no el canvas.
- Assets del juego en `public/games/<id>/` (p. ej. el spritesheet de `bloque-buster`).
- **Añadir un juego jugable = una línea en el registro** (más el engine y su componente). No añadas columnas a Supabase ni ramas `if (game.id === ...)`.

### Estilos

Tailwind CSS **v4** vía `@tailwindcss/postcss` — **no hay `tailwind.config.js`**. La paleta neón/arcade y las fuentes se declaran como variables CSS en `app/globals.css` y se exponen a Tailwind con `@theme inline`. Ese archivo (~1400 líneas) es el CSS del prototipo portado: **reutiliza sus clases (`av-*`, `auth-card`, …) antes de escribir utilidades nuevas**. Las fuentes se auto-hospedan con `next/font/google` en `app/layout.tsx`.

### `references/` — prototipos de origen (no se ejecutan)

Prototipos **browser-global JSX** (cada archivo termina en `window.Componente = ...`, sin bundler) que sirvieron de referencia visual y ya están portados:

- `references/templates/` — nav, auth, biblioteca, detalle, reproductor, salón + `styles.css` y el harness `Arcade Vault.html`.
- `references/home-about/` — landing y "Acerca de".
- `references/started-games/` — engines vanilla de partida: `02-asteroids`, `03-tetris`, `04-arkanoid` (los tres ya portados).

Al portar una pantalla o un engine, replica el markup, las clases y el lenguaje visual del prototipo correspondiente.

## Workflow

**Spec Driven Design**: primero `/spec` (o `/add-game` para un juego), luego `/spec-impl`. Nunca implementes sin spec confirmado.

Los specs viven en `specs/NN-<slug>.md`, numerados y encadenados: cada uno declara **Estado**, **Depende de**, **Fecha** y **Objetivo**. Al terminar la implementación, marca el estado como `Implementado`. Specs actuales: 01 MVP visual · 02 landing y rutas `/games` · 03 about + Resend · 04 conexión Supabase · 05 juego `rocas` · 06 catálogo y leaderboard en Supabase · 07 juego `caida` · 08 juego `bloque-buster`.

Cada spec se implementa en su propia rama `spec-NN-<slug>` y se integra por PR a `main`. `.tree/` guarda git worktrees por spec.
