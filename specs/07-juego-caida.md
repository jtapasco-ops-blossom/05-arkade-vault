# SPEC 07 — Juego de Tetris real (CAÍDA)

> **Estado:** Implemented
> **Depende de:** SPEC 05 (engine de asteroides + patrón GamePlayer), SPEC 06 (catálogo/leaderboard en Supabase)
> **Fecha:** 2026-08-11
> **Objetivo:** Portar el engine vanilla de Tetris (`references/started-games/03-tetris`) a un módulo TypeScript y cablearlo al juego `caida` mediante un registro de engines por `id`, reemplazando el reproductor simulado solo para ese juego.

## Alcance

**Dentro:**

- Portar el engine vanilla de Tetris (`references/started-games/03-tetris/game.js`) a `lib/games/tetris.ts` (agnóstico de React): tipos para tablero y pieza, `init`, loop con acumulador de caída, input encapsulado, y API `createTetrisGame(canvas, nextCanvas, onChange)` con handle `start/pause/resume/forceGameOver/restart/destroy`. Física, rotación con wall-kicks, puntajes, velocidad por nivel y las **8 piezas** (incluida la "tuerca") **idénticas** al original.
- Crear `components/games/TetrisGame.tsx` (`'use client'`): monta el canvas del tablero (300×600) + un 2º canvas de **preview** de la siguiente pieza (120×120), corre el loop, captura teclado y sube el `snapshot` al padre por callback.
- Introducir el **registro de engines** (2º engine): `lib/games/types.ts` (`GameSnapshot`/`GameEngineRef`/`GameState` compartidos) + `lib/games/registry.ts` (`ENGINES` por `id`), y refactorizar `GamePlayer` para elegir el engine con `ENGINES[game.id]` en vez de `isRocas`. Registrar `rocas → AsteroidsGame` y `caida → TetrisGame`.
- Cablear los botones existentes: **PAUSA** congela, **FIN** fuerza game over, **SALIR** navega al detalle, **JUGAR DE NUEVO** reinicia. Controles de teclado: ←/→ mover, ↓ soft drop, **Shift** rotar, Espacio hard drop, **Escape** pausa; `preventDefault` en esas teclas.
- HUD de React con **Puntuación** y **Nivel** reales del engine; el stat "Vidas" muestra **"—"** (Tetris no usa vidas). El canvas ya no pinta HUD ni overlay GAME OVER.
- Escalado del canvas dentro del `.crt-screen` preservando aspecto (clase CSS en `app/globals.css` si hace falta).

**Fuera de alcance (specs futuros):**

- Escritura real de puntajes / leaderboard (espera auth real; **GUARDAR PUNTUACIÓN** sigue deshabilitado).
- Mostrar el conteo de **líneas** en el HUD (por decisión: "VIDAS" queda en "—"; las líneas solo operan internamente para puntaje y velocidad).
- El **theme-toggle** claro/oscuro y su `localStorage` del original (la plataforma maneja su propio tema).
- Cambiar la mecánica (piezas, puntajes, velocidad, wall-kicks, número de piezas).
- Sonido/música y controles táctiles/móvil.
- Engine real para los demás juegos simulados.

## Modelo de datos

Este spec **no introduce datos persistidos nuevos**: `caida` ya existe en la tabla `games` de Supabase (SPEC 06) y el guardado sigue deshabilitado. Solo introduce estructuras **en memoria** al portar el engine, más los **tipos compartidos** del registro.

**Tipos compartidos del registro** (nuevos, `lib/games/types.ts`) — contrato común de todo engine:

```ts
export type GameState = "playing" | "dead" | "gameover";
export interface GameSnapshot { score: number; lives: number; level: number; state: GameState; }
export interface GameEngineRef { pause(): void; resume(): void; forceGameOver(): void; restart(): void; }
```

**Estructuras del engine de Tetris** (portadas 1:1 a `lib/games/tetris.ts`, encapsuladas en la closure):

```ts
type Cell = number;              // 0 vacío; 1..8 índice de color
type Board = Cell[][];           // ROWS×COLS
interface Piece { type: number; shape: number[][]; x: number; y: number; }
```

Constantes idénticas al original: `COLS=10`, `ROWS=20`, `BLOCK=30` (→ canvas tablero 300×600, preview 120×120), `COLORS[9]`, `PIECES[9]` (7 tetrominós + la "tuerca" tipo 8), `LINE_SCORES=[0,100,300,500,800]`.

Estado interno (globals del original, ahora en la closure): `board, current, next, score, lines, level, paused, gameOver, dropAccum, dropInterval`. Velocidad: `dropInterval = max(100, 1000 − (level−1)·90)`; `level = floor(lines/10)+1`.

**Mapeo al `GameSnapshot`** (única vía por la que React lee el estado): `score→score`, `level→level`, `state→ gameOver ? "gameover" : "playing"`, y `lives→0` (para que el HUD muestre "—"; Tetris no usa vidas ni el estado "dead"). El conteo de `lines` vive dentro del engine (dirige puntaje y velocidad) pero **no** entra al snapshot.

**API pública** del módulo:

```ts
function createTetrisGame(
  canvas: HTMLCanvasElement,        // tablero 300×600
  nextCanvas: HTMLCanvasElement,    // preview 120×120
  onChange: (snap: GameSnapshot) => void,
): GameEngineRef & { start(): void; destroy(): void };
```

`onChange` se dispara solo cuando cambia el snapshot (`score/level/state`), no cada frame.

## Plan de implementación

> Antes de tocar componentes, revisar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (Client Components; el canvas y el teclado son `'use client'`). El engine es lógica de navegador pura.

1. **Introducir el registro de engines (refactor único).** Crear `lib/games/types.ts` (`GameState`, `GameSnapshot`, `GameEngineRef`) y `lib/games/registry.ts` con `ENGINES: Record<string, GameEngineComponent>` que registra **solo** `rocas → AsteroidsGame`. Adaptar `AsteroidsGame` para usar los tipos compartidos (estructuralmente idénticos a los actuales). Refactorizar `GamePlayer`: `const Engine = ENGINES[game.id]` y `hasEngine = Boolean(Engine)` en vez de `isRocas` (propagar a `useEffect` simulado, `togglePause`, `endGame`, `restart`, `displayLevel`).
   _Verificación:_ `npm run build` compila; `/games/rocas/play` funciona igual; los demás juegos siguen simulados.

2. **Portar el engine a `lib/games/tetris.ts`.** Traducir `game.js` a TypeScript encapsulando el estado en `createTetrisGame(canvas, nextCanvas, onChange)`: tablero, piezas, `collide`, `rotateCW`/`tryRotate` (wall-kicks `[0,±1,±2]`), `clearLines`, `hardDrop`/`softDrop`, `spawn`, y el loop con `dropAccum`. Input de teclado registrado en `start()` y quitado en `destroy()`. Emitir `emitIfChanged()`. **Quitar** del engine: dibujado de HUD (`updateHUD` al DOM), overlay (`endGame`/`togglePause` que tocaban `#overlay`), y el theme-toggle + `localStorage`.
   _Verificación:_ `npm run build` compila el módulo sin errores de tipos.

3. **Crear `components/games/TetrisGame.tsx`** (`'use client'`, `forwardRef`). Prop `{ onSnapshot }`; expone `GameEngineRef` por `useImperativeHandle`. En `useEffect([])` monta `<canvas>` del tablero (300×600) y `<canvas>` del preview (120×120), llama `createTetrisGame`, `start()`, y limpia con `destroy()`. `onSnapshot` guardado en ref (identidad estable).
   _Verificación:_ montado aislado, el juego corre, responde al teclado y el snapshot llega por callback.

4. **Registrar y cablear en `GamePlayer`.** Añadir `caida → TetrisGame` a `ENGINES`. El HUD muestra `score` y `nivel` reales; "VIDAS" queda en "—" (snapshot `lives=0`). Controles: ←/→ mover, ↓ soft drop, **Shift** rotar, Espacio hard drop, **Escape** pausa; `preventDefault` en flechas, Espacio y Escape. PAUSA/FIN/SALIR/JUGAR DE NUEVO reusan los handlers existentes; **GUARDAR PUNTUACIÓN** sigue deshabilitado.
   _Verificación:_ `/games/caida/play` juega Tetris real; PAUSA congela y muestra "EN PAUSA"; FIN abre el modal con el score real.

5. **Escalado y encaje visual.** Ajustar el canvas del tablero (y el preview) dentro de `.crt-screen` (clase en `app/globals.css` si hace falta) preservando proporción, sin romper el layout ni el HUD.
   _Verificación:_ el tablero y el preview se ven nítidos y centrados en desktop; no desbordan el marco.

6. **Regresión y limpieza.** Verificar que no quedan restos del simulador para `caida`, que el teclado no scrollea la página, y que se cancela el `requestAnimationFrame` y se quitan los listeners al salir.
   _Verificación:_ `npm run build` y `npm run dev` sin errores; `/`, `/games`, `/games/[id]`, `/games/caida/play`, `/games/rocas/play`, `/hall-of-fame`, `/about`, `/auth` cargan sin regresiones.

## Criterios de aceptación

- [ ] Existe `lib/games/tetris.ts` con el engine portado a TypeScript (tipos + `createTetrisGame(canvas, nextCanvas, onChange)`), sin globals en `window` ni manipulación del DOM del HUD.
- [ ] Existen `lib/games/types.ts` (`GameState`/`GameSnapshot`/`GameEngineRef`) y `lib/games/registry.ts` (`ENGINES` por `id`) con `rocas` y `caida` registrados.
- [ ] `GamePlayer` elige el engine con `ENGINES[game.id]`; ya no existe la rama `isRocas`.
- [ ] Existe `components/games/TetrisGame.tsx` (`'use client'`) que monta tablero + preview y sube el snapshot por callback.
- [ ] En `/games/caida/play` se juega Tetris real: las piezas caen y se mueven (←/→), bajan (↓), rotan (Shift) y caen al instante (Espacio); las líneas completas se limpian y suman puntos ×nivel; la velocidad sube cada 10 líneas.
- [ ] El preview muestra la **siguiente pieza** dentro del CRT, junto al tablero.
- [ ] El HUD muestra **Puntuación** y **Nivel** reales del engine; "VIDAS" muestra **"—"**; el canvas no pinta HUD ni overlay GAME OVER.
- [ ] **PAUSA** (botón) y **Escape** congelan el juego y muestran "EN PAUSA"; **REANUDAR** continúa desde el mismo estado.
- [ ] **FIN** fuerza el game over y abre el modal con la puntuación real; llenar el tablero (spawn con colisión) también abre el modal.
- [ ] **GUARDAR PUNTUACIÓN** sigue deshabilitado con su aviso.
- [ ] **JUGAR DE NUEVO** reinicia desde cero; **SALIR** navega a `/games/caida`.
- [ ] Las flechas, Espacio y Escape no hacen scroll de la página mientras se juega.
- [ ] Al desmontar (SALIR/navegar) se cancela el `requestAnimationFrame` y se quitan los listeners de teclado.
- [ ] `rocas` se sigue jugando igual y los demás juegos siguen simulados.
- [ ] `npm run build` termina sin errores y las rutas existentes cargan sin regresiones en consola.

## Decisiones

- **Sí:** registro de engines por `id` (`ENGINES[game.id]`) en vez de seguir con `isRocas`. Los `id` ya vienen de Supabase; escala a N juegos sin columnas nuevas ni cadenas de `if`.
- **Sí:** tipos compartidos `GameSnapshot`/`GameEngineRef` en `lib/games/types.ts`. Un contrato común deja que `GamePlayer` trate a cualquier engine igual.
- **Sí:** portar a TS con closure (sin globals en `window` ni DOM). Igual que SPEC 05; evita fugas y estado global.
- **Sí:** preview de la siguiente pieza como 2º canvas dentro del CRT. Fiel a Tetris y sin tocar el HUD.
- **Sí:** "VIDAS" en "—" (`lives=0`); las líneas no se muestran en el HUD. Decisión del usuario; evita hacer el HUD compartido consciente del juego.
- **Sí:** conservar las 8 piezas (incluida la "tuerca") y toda la mecánica/velocidad/wall-kicks. Se porta tal cual; no se cambia el juego.
- **Sí:** Escape = pausa y Shift = rotar (además de ←/→/↓/Espacio). Preferencia del usuario.
- **No:** mostrar líneas en el HUD o hacer el HUD consciente del juego. Fuera por decisión; menor superficie de cambio.
- **No:** el theme-toggle claro/oscuro y su `localStorage` del original. La plataforma maneja su propio tema.
- **No:** habilitar el guardado de puntaje. Espera al spec de auth real (SPEC 06).
- **No:** sonido, controles móviles ni cambios de mecánica.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| StrictMode / montaje-desmontaje duplica el loop o filtra listeners. | Encapsular en `createTetrisGame`; listeners en `start()`, quitarlos en `destroy()`; cancelar RAF al desmontar; `useEffect([])` monta una vez. |
| El refactor de `GamePlayer` rompe `rocas` o los juegos simulados. | Paso 1 aislado: registrar solo `rocas` y verificar antes de añadir `caida`; `hasEngine` sustituye `isRocas` 1:1. |
| `Shift`/`Escape` con comportamientos del navegador (Shift es modificador). | Rotar en `keydown` de `ShiftLeft`/`ShiftRight`; `preventDefault` en Escape/Espacio/flechas; ignorar `e.repeat` si molesta. |
| Emitir `onChange` cada frame provoca renders a 60 fps. | `emitIfChanged` solo dispara al cambiar `score/level/state`. |
| Dos canvas (tablero + preview) desencajan el layout del CRT. | Mantener buffers fijos (300×600 y 120×120) y escalar por CSS dentro de `.crt-screen`. |
| El original usa `performance.now()` (loop/pausa); no existe en SSR. | El engine solo corre en cliente (`TetrisGame` es `'use client'`, montado en `useEffect`). |

## Lo que **no** está en este spec

- Escritura real de puntajes (INSERT en `scores`) y su policy de RLS.
- Mostrar líneas en el HUD o un HUD consciente del juego.
- Theme-toggle claro/oscuro y su `localStorage`.
- Sonido, controles móviles y cambios de mecánica.
- Engine real para los demás juegos simulados.

Cada uno, si aterriza, va en su propio spec.
