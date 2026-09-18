# Patrón de integración de un juego — referencia para `/add-game`

Este archivo es la referencia concreta que el skill `/add-game` consulta al redactar el spec de un
juego. **No es texto para copiar literal** en el spec: es el mapa de rutas, firmas y decisiones reales
del repo que el spec debe respetar. Los patrones vienen de **SPEC 05** (engine de canvas) y **SPEC 06**
(catálogo y leaderboard en Supabase), ya implementados para el juego `rocas`.

---

## 1. Arquitectura de 4 capas

```
app/games/[id]/play/page.tsx        (Server Component: getGame(id) → notFound() → <GamePlayer game=… />)
        │  ← YA es genérica, NO se toca al añadir un juego
        ▼
components/GamePlayer.tsx            ('use client': HUD + registro id→engine + pausa/fin/salir + modal fin)
        │  ref={gameRef}  onSnapshot={…}
        ▼
components/games/<Id>Game.tsx        ('use client': forwardRef, monta <canvas>, arranca/limpia el engine)
        │  create<Id>Game(canvas, onChange)
        ▼
lib/games/<id>.ts                    (engine agnóstico de React: closure + RAF + input + snapshot)
```

Regla de oro (SPEC 05): **el canvas solo dibuja el juego.** El HUD (score/vidas/nivel), el overlay
"EN PAUSA" y el modal de fin son de React, alimentados por el `snapshot` del engine. El engine es la
única fuente de verdad del ciclo de partida.

La ruta `app/games/[id]/play/page.tsx` ya resuelve cualquier juego por slug y pasa el `Game` a
`GamePlayer`. **No requiere cambios** para un juego nuevo.

---

## 2. Contrato del engine — `lib/games/<id>.ts` (de `lib/games/asteroids.ts`)

Factory con **closure** (sin globals en `window`, sin clases a nivel de módulo). Firma pública:

```ts
export type <Id>State = "playing" | "dead" | "gameover";

export interface <Id>Snapshot {           // solo campos del HUD + estado
  score: number;
  lives: number;                          // ver §5: juegos sin vidas (tetris) mapean líneas u otro
  level: number;
  state: <Id>State;
}

export interface <Id>GameHandle {
  start(): void;          // registra listeners de teclado + arranca requestAnimationFrame
  pause(): void;          // cancela RAF, congela tiempo
  resume(): void;         // reanuda
  forceGameOver(): void;  // FIN → state = "gameover"
  restart(): void;        // reinicia desde cero
  destroy(): void;        // cancela RAF y QUITA los listeners de teclado
}

export function create<Id>Game(
  canvas: HTMLCanvasElement,
  onChange: (snap: <Id>Snapshot) => void,
): <Id>GameHandle;
```

Puntos que el spec debe exigir (idénticos al original `asteroids.ts`):

- Todo el estado como `let` locales dentro de la closure (`ship/board/…`, `score`, `lives`, `level`,
  `state`, timers). Las clases/estructuras de entidad se declaran **dentro** de la factory.
- Buffer de canvas **fijo** (asteroids: `const W = 800; const H = 600;`), escalado por CSS. Mantener el
  buffer intacto preserva la física.
- **Input dentro de la closure.** `const keys: Record<string, boolean> = {}` + handlers `onKeyDown`/
  `onKeyUp`. `GAME_KEYS` (flechas + Space) recibe `e.preventDefault()` para no scrollear la página.
  Los listeners se registran en `start()` sobre `window` y se quitan en `destroy()` — nunca a nivel de
  módulo (evita fugas y dobles loops en StrictMode).
- **RAF con `dt` clampeado:** `const dt = Math.min((ts - last) / 1000, 0.05)`. `run()` idempotente
  (guarda `rafId !== null`). `stopLoop()` hace `cancelAnimationFrame`.
- **`emitIfChanged()`**: compara el snapshot contra el último emitido y solo llama `onChange` cuando
  cambia `score/lives/level/state` (NO cada frame → evita renders de React a 60fps). Se llama en el loop
  y explícitamente al final de `start()`, `forceGameOver()`, `restart()`.
- **Quitar** del engine el dibujado de HUD y del overlay GAME OVER (los pinta React). Conservar el
  dibujo de entidades y efectos.

---

## 3. El componente — `components/games/<Id>Game.tsx` (de `AsteroidsGame.tsx`)

`'use client'`, `forwardRef`. ~60 líneas. Estructura a replicar:

```tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { create<Id>Game, type <Id>GameHandle, type <Id>Snapshot } from "@/lib/games/<id>";

export type { <Id>Snapshot } from "@/lib/games/<id>";      // re-export para GamePlayer

export interface <Id>GameRef { pause(): void; resume(): void; forceGameOver(): void; restart(): void; }

export const <Id>Game = forwardRef<<Id>GameRef, { onSnapshot: (snap: <Id>Snapshot) => void }>(
  function <Id>Game({ onSnapshot }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<<Id>GameHandle | null>(null);
    const onSnapshotRef = useRef(onSnapshot);
    onSnapshotRef.current = onSnapshot;                     // callback estable

    useEffect(() => {                                        // dep array [] → engine se crea UNA vez
      const canvas = canvasRef.current;
      if (!canvas) return;
      const game = create<Id>Game(canvas, (snap) => onSnapshotRef.current(snap));
      gameRef.current = game;
      game.start();
      return () => { game.destroy(); gameRef.current = null; };
    }, []);

    useImperativeHandle(ref, () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      forceGameOver: () => gameRef.current?.forceGameOver(),
      restart: () => gameRef.current?.restart(),
    }));

    return <canvas ref={canvasRef} width={800} height={600} className="<id>-canvas" tabIndex={0} aria-label="…" />;
  },
);
```

Claves: `onSnapshot` guardado en ref (identidad estable); `useEffect([])` monta/desmonta el engine una
sola vez; `game.destroy()` en cleanup; `useImperativeHandle` reenvía los 4 controles; `<canvas>` con
`width`/`height` = buffer del engine.

---

## 4. El registro y `GamePlayer` — reemplaza la rama `isRocas`

Hoy `GamePlayer.tsx` tiene una sola rama hardcodeada:

```tsx
const isRocas = game.id === "rocas";
// …
{isRocas ? <AsteroidsGame ref={gameRef} onSnapshot={onSnapshot} /> : <div className="game-arena">…</div>}
```

**Refactor de registro (una sola vez, en el spec del 2º juego).** Introduce tipos compartidos y un mapa
`id → componente`, y hace `GamePlayer` data-driven:

```ts
// lib/games/types.ts  (nuevo — contrato común de todos los engines)
export type GameState = "playing" | "dead" | "gameover";
export interface GameSnapshot { score: number; lives: number; level: number; state: GameState; }
export interface GameEngineRef { pause(): void; resume(): void; forceGameOver(): void; restart(): void; }
```

```tsx
// lib/games/registry.ts  (nuevo — la única tabla que crece por juego)
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { GameEngineRef, GameSnapshot } from "@/lib/games/types";
import { AsteroidsGame } from "@/components/games/AsteroidsGame";

export type GameEngineComponent =
  ForwardRefExoticComponent<{ onSnapshot: (s: GameSnapshot) => void } & RefAttributes<GameEngineRef>>;

export const ENGINES: Record<string, GameEngineComponent> = {
  rocas: AsteroidsGame,
  // <id>: <Id>Game,   ← cada juego nuevo añade UNA línea
};
```

```tsx
// GamePlayer.tsx  (refactor)
const Engine = ENGINES[game.id];              // en vez de isRocas
const hasEngine = Boolean(Engine);
const gameRef = useRef<GameEngineRef>(null);
// …handlers: usar hasEngine donde antes decían isRocas (pausa/fin/restart/simulador/HUD nivel)…
{Engine
  ? <Engine ref={gameRef} onSnapshot={onSnapshot} />
  : <div className="game-arena">…arena simulada…</div>}
```

Cambios a propagar en `GamePlayer` al hacer el refactor: `isRocas` → `hasEngine` en el `useEffect`
simulado (línea del `setInterval`), en `togglePause`, `endGame`, `restart` y en `displayLevel`. Los
tipos `AsteroidsSnapshot`/`AsteroidsGameRef` importados pasan a `GameSnapshot`/`GameEngineRef`.
`AsteroidsGame` debe entonces tipar su ref/snapshot con los tipos compartidos (o mantenerlos
estructuralmente compatibles).

**Del 3er juego en adelante:** el registro ya existe → el spec solo añade `import` + una entrada en
`ENGINES` + el engine y el componente. `GamePlayer` no se toca.

---

## 5. Formas de engine en `references/started-games/` y mapeo a slugs

| Carpeta | Slug catálogo | cat / cover | Forma del engine | Notas de porte |
| --- | --- | --- | --- | --- |
| `02-asteroids` | `rocas` | SHOOTER / cover-rocas | Clases ES6 (`Bullet/Asteroid/Ship/…`), input **polling** (`keys` + `justPressed`/`pressed`), canvas 800×600 | **Ya portado** (referencia canónica) |
| `03-tetris` | `caida` | PUZZLE / cover-tetro | **Matrices** (sin clases), input por **evento** (`switch(e.code)`), **doble canvas** (tablero 300×600 + preview 120×120), loop con acumulador de caída | HUD usa **líneas**, no vidas → decidir mapeo del snapshot (ver abajo). El preview es un 2º canvas dentro del componente |
| `04-arkanoid` | `bloque-buster` | ARCADE / cover-bricks | Objetos literales (`paddle`/`ball`) + arrays, **assets: spritesheet + audio**, niveles en `levels.js`, input híbrido (teclado + ratón) | Requiere portar carga de imágenes/sonidos y `LEVELS` como módulo tipado; el ratón es opcional |

El skill **propone** el mapeo referencia→slug y lo **confirma** con el usuario (el título/`cat`/`cover`
del slug deben encajar con la mecánica del juego portado). Un juego nuevo **no** listado aquí puede no
tener fila en `games` todavía (ver §6).

**Snapshot heterogéneo (HUD).** El HUD de `GamePlayer` muestra `score` / `vidas` (♥) / `nivel`. Juegos
sin "vidas" (tetris) deben decidir en el spec cómo mapear: p. ej. reutilizar `lives` para otra métrica y
adaptar la etiqueta, o registrar la decisión en la sección "Decisiones" del spec. `GameSnapshot`
mantiene `score/lives/level/state` como contrato mínimo.

---

## 6. Supabase — cuándo hace falta y formato

Los **8 juegos del catálogo ya existen** en la tabla `games` (`bloque-buster, caida, duelo-pixel,
gloton, invasores, ranaria, rocas, serpentina`), cada uno con su clase `cover-*` en `app/globals.css`.

- **El juego YA está en `games`** (caso típico: dar engine a `caida`, `bloque-buster`, …) →
  **NO** hay migración de Supabase ni cover nuevo. El spec cubre solo engine + componente + registro.
- **El juego NO está en `games`** (juego totalmente nuevo) → el spec incluye:
  1. Migración `supabase/migrations/00NN_<id>.sql` (siguiente número; hoy el último es `0002_seed.sql`).
  2. Fila en `games` con **todas** las columnas y `sort` = siguiente entero (hoy el mayor es `8`):
     ```sql
     insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort) values
       ('<id>', '<TÍTULO>', '<short>', '<long>', 'ARCADE|PUZZLE|SHOOTER|VERSUS',
        'cover-<name>', 'cyan|magenta|yellow|green', <best:int>, '<plays:str "12.4K">', <sort>);
     ```
  3. ~10 filas de `scores` (id autogenerado, se omite):
     ```sql
     insert into public.scores (game_id, name, score, created_at) values
       ('<id>', 'HANDLE_MAYUS', <score:int>, '2026-03-15T12:00:00Z'), …;  -- ~10 filas, score desc
     ```
  4. Clase `cover-<name>` nueva en `app/globals.css` — diseñarla con `/frontend-design`.

Convenciones: `id` = slug kebab-case; `title` MAYÚSCULAS; `plays` es **string** de display; `best` es
integer; `name` de score en MAYÚSCULAS; `created_at` ISO-8601.

**La capa de queries NO cambia** — `lib/queries.ts` (`getGames` order by `sort`, `getGame(id)`,
`getScores(gameId?, limit?)` order by `score desc`) y `lib/data.ts` (tipos `Game`, `ScoreRow`) sirven
cualquier juego nuevo automáticamente. El juego aparece solo en Home/Library/Salón por ser data-driven.

**RLS:** `scores` es solo lectura (sin policy de INSERT). El botón **GUARDAR PUNTUACIÓN** de
`GamePlayer` sigue **deshabilitado** con su aviso "próximamente con tu cuenta" hasta el spec de auth
real. El spec de un juego nuevo **no** habilita escritura de puntajes.

---

## 7. Checklist de decisiones que el spec debe cerrar

- [ ] Fuente del engine: `references/started-games/<carpeta>` o juego nuevo descrito.
- [ ] Slug destino (`game.id`) y si **ya existe** en `games` (→ decide si hay migración/cover).
- [ ] Nombres: `lib/games/<id>.ts`, `components/games/<Id>Game.tsx`, entrada `ENGINES["<id>"]`.
- [ ] ¿Es el 2º engine? → el spec incluye el refactor de registro (`types.ts` + `registry.ts` +
      `GamePlayer`). Si el registro ya existe → solo añadir la entrada.
- [ ] Mapeo del HUD (score/vidas/nivel) para la mecánica del juego.
- [ ] Assets/audio (arkanoid) y/o segundo canvas (tetris preview), si aplica.
- [ ] Controles de teclado y `preventDefault` de sus teclas.
- [ ] GUARDAR PUNTUACIÓN sigue deshabilitado.
