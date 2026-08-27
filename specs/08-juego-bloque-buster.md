# SPEC 08 — Juego de Arkanoid real (BLOQUE BUSTER)

> **Estado:** IMPLEMENTED
> **Depende de:** SPEC 05 (engine de canvas + patrón GamePlayer), SPEC 06 (catálogo/leaderboard en Supabase), SPEC 07 (registro de engines por `id`)
> **Fecha:** 2026-08-26
> **Objetivo:** Portar el engine vanilla de Arkanoid (`references/started-games/04-arkanoid`) a un módulo TypeScript con su spritesheet y sus 5 niveles, y registrarlo como el engine del juego `bloque-buster`.

## Alcance

**Dentro:**

- Portar el engine vanilla (`game.js` + `levels.js` + `assets/spritesheet.js`) a `lib/games/bloque-buster.ts` (agnóstico de React): paddle, pelota, bloques, colisiones AABB, 3 vidas, explosiones de 4 frames, los **5 niveles** de `LEVELS` con su multiplicador de velocidad, y la API `createBloqueBusterGame(canvas, onChange)` con handle `start/pause/resume/forceGameOver/restart/destroy`. Física, puntajes (10 pts/bloque) y progresión **idénticos** al original.
- Copiar `spritesheet-breakout.png` a `public/games/bloque-buster/` y portar los helpers de dibujo (`SPRITES`, `EXPLOSION_FRAMES`, `drawSprite`/`drawFrame`) a TypeScript dentro del engine, con carga de imagen **por instancia** (sin caché global) y respaldo de rectángulos si la carga falla.
- Crear `components/games/BloqueBusterGame.tsx` (`'use client'`, `forwardRef`): monta el canvas 800×600, arranca el engine y sube el `snapshot` al padre por callback.
- Registrar **una línea** en `lib/games/registry.ts`: `"bloque-buster": BloqueBusterGame`.
- Controles: **←/→** (con `preventDefault`) y **ratón** sobre el canvas (escalado por `getBoundingClientRect`, porque el canvas se estira dentro del `.crt-screen`).
- HUD de React con Puntuación / Vidas (♥♥♥) / Nivel reales del engine; el canvas ya no pinta HUD ni overlays.
- Reusar la regla CSS existente del canvas 4:3 de `app/globals.css` añadiendo el selector del juego.

**Fuera de alcance (specs futuros):**

- **Sonido** (`ball-bounce.mp3`, `break-sound.mp3`): no se portan los `Audio` del original.
- El **overlay de pausa dibujado en canvas** y su **selector de nivel 1–5** clicable (era ayuda de desarrollo); la pausa la maneja el overlay "EN PAUSA" de React vía `GamePlayer`.
- Un estado `win` propio en el contrato compartido: completar el nivel 5 termina en `gameover`.
- Escritura real de puntajes (**GUARDAR PUNTUACIÓN** sigue deshabilitado, espera al spec de auth).
- Cambios de mecánica: power-ups, más niveles, rebote por zona del paddle, velocidad distinta.
- Migración de Supabase o portada nueva: `bloque-buster` **ya existe** en `games` con `cover-bricks`.
- `GamePlayer.tsx` **no se modifica** (el registro y el atajo Escape ya llegaron con SPEC 07).
- Controles táctiles/móvil.

## Modelo de datos

Este spec **no introduce datos persistidos nuevos**: `bloque-buster` ya existe en la tabla `games` de Supabase (SPEC 06, `ARCADE` / `cover-bricks` / `sort: 1`) y el guardado de puntajes sigue deshabilitado. Tampoco introduce tipos compartidos: **reutiliza** `GameSnapshot`, `GameEngineRef` y `GameState` de `lib/games/types.ts` (SPEC 07). Todo lo demás es estado **en memoria** dentro de la closure del engine.

**Estructuras del engine** (portadas 1:1 de `game.js` + `levels.js`, encapsuladas en la closure):

```ts
type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

interface Paddle { x: number; y: number; w: number; h: number; }
interface Ball   { x: number; y: number; w: number; h: number; vx: number; vy: number; }
interface Block  { x: number; y: number; w: number; h: number; color: BlockColor; alive: boolean; }
interface Explosion { x: number; y: number; w: number; h: number; color: BlockColor; elapsed: number; }

// Definición de nivel (de levels.js): posición en la grilla, no en píxeles.
interface BlockSpec { col: number; row: number; color: BlockColor; }
interface Level     { speed: number; blocks: BlockSpec[]; }

// Recorte del spritesheet (de assets/spritesheet.js).
interface SpriteRect { sx: number; sy: number; sw: number; sh: number; }
```

**Constantes idénticas al original** (módulo, inmutables):

```ts
const W = 800, H = 600;                    // buffer del canvas, escalado por CSS
const PADDLE_SPEED = 400;                  // px/s
const BLOCK_COLS = 10, BLOCK_ROWS = 6, BLOCK_W = 64, BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;   // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200, BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150;            // ms, 4 frames
const LIVES_START = 3, POINTS_PER_BLOCK = 10;
```

`LEVELS: Level[]` se genera igual que en `levels.js` (parrilla, pirámide, ajedrez, filas con huecos, marco+cruz) con las velocidades literales **1.00, 1.10, 1.21, 1.33, 1.46**. `SPRITES` (paddle, ball y los 7 colores de bloque) y `EXPLOSION_FRAMES` (4 recortes por color) se portan como tablas `const`.

**Estado interno** (globals del original, ahora `let` en la closure): `paddle, ball, blocks, explosions, score, lives, currentLevel, state, rafId, last, keys, sheet, loaded`.

**Mapeo al `GameSnapshot`** — única vía por la que React lee el estado:

| Campo | Origen | Notas |
| --- | --- | --- |
| `score` | `score` | +10 por bloque, acumulado a través de los 5 niveles |
| `lives` | `lives` | 3 → 0; el HUD lo pinta como ♥♥♥ |
| `level` | `currentLevel` | 1–5 |
| `state` | `"playing"` \| `"gameover"` | `gameover` al agotar vidas **o** al limpiar el nivel 5 (victoria) |

El estado `"dead"` del contrato **no se emite**: perder una vida solo reposiciona la pelota, sin transición visible para React.

**API pública** del módulo:

```ts
export function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  onChange: (snap: GameSnapshot) => void,
): GameEngineRef & { start(): void; destroy(): void };
```

`onChange` se dispara solo cuando cambia `score/lives/level/state`, no cada frame.

**Asset:** `spritesheet-breakout.png` se copia a `public/games/bloque-buster/` y se carga desde `/games/bloque-buster/spritesheet-breakout.png`, por instancia del engine (sin caché a nivel de módulo).

## Plan de implementación

> Antes de tocar componentes, revisar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (Client Components; canvas, teclado y ratón son `'use client'`). El engine es lógica de navegador pura. `app/games/[id]/play/page.tsx` y `components/GamePlayer.tsx` **no se tocan**.

1. **Copiar el asset y portar los datos estáticos.** Copiar `spritesheet-breakout.png` a `public/games/bloque-buster/`. Crear `lib/games/bloque-buster.ts` con los tipos del modelo de datos, las constantes, el generador de `LEVELS` (los 5 patrones de `levels.js`, velocidades 1.00–1.46) y las tablas `SPRITES` / `EXPLOSION_FRAMES` de `assets/spritesheet.js`, todo como `const` de módulo.
   _Verificación:_ `npm run build` compila; con `npm run dev` el PNG responde 200 en `/games/bloque-buster/spritesheet-breakout.png`; `LEVELS[0].blocks.length === 60`.

2. **Portar el engine.** Añadir `createBloqueBusterGame(canvas, onChange)` con todo el estado en la closure: `initPaddle`/`initBall`/`loadLevel`, movimiento de pelota, rebotes en muros y paddle, `collideAABB` con los bloques (un bloque por frame, `break`), +10 pts, explosiones por `elapsed`, pérdida de vida al caer la pelota, avance de nivel al limpiar la grilla y `gameover` al agotar vidas **o** al limpiar el nivel 5. Loop `requestAnimationFrame` con `dt` clampeado (`Math.min((ts - last) / 1000, 0.05)`), `run()` idempotente y `emitIfChanged()`. Carga del spritesheet **por instancia**: `new Image()` en `start()`, `onload` arranca el loop, `onerror` lo arranca igual y activa el respaldo de rectángulos de color.
   **Quitar del engine:** el dibujado de HUD (score/vidas/nivel), los overlays `GAME OVER` / victoria / `PAUSA`, el selector de nivel 1–5 y su listener de `click`, y los dos `Audio` de rebote y ruptura.
   _Verificación:_ `npm run build` compila el módulo sin errores de tipos.

3. **Input dentro de la closure.** `keys: Record<string, boolean>` con `ArrowLeft`/`ArrowRight` y `preventDefault` en esas dos teclas; handlers `keydown`/`keyup` sobre `window`. `mousemove` sobre el **canvas** (no `window`), convirtiendo la coordenada con `getBoundingClientRect()` porque el buffer 800×600 se estira dentro del `.crt-screen`. Todos los listeners se registran en `start()` y se quitan en `destroy()`. **No** se registra `P` ni `Escape`: `GamePlayer` ya maneja Escape→pausa desde SPEC 07. `pause()` cancela el RAF y `resume()` resetea `last = null` para que `dt` no salte al reanudar.
   _Verificación:_ el paddle sigue teclado y ratón; ←/→ no scrollean la página; tras pausar y reanudar la pelota no da un salto.

4. **Crear `components/games/BloqueBusterGame.tsx`** (`'use client'`, `forwardRef`). Prop `{ onSnapshot }` guardado en ref para identidad estable; expone `GameEngineRef` por `useImperativeHandle`; en `useEffect([])` llama `createBloqueBusterGame`, `start()`, y limpia con `destroy()`. Renderiza `<canvas width={800} height={600} className="bricks-canvas" tabIndex={0} aria-label="Juego de bloques" />`.
   _Verificación:_ montado, el juego corre y el snapshot llega por callback.

5. **Registrar el engine y encajar el canvas.** Añadir `"bloque-buster": BloqueBusterGame` a `ENGINES` en `lib/games/registry.ts` (una línea + su `import`). En `app/globals.css`, añadir `.bricks-canvas` al selector de la regla del canvas 4:3 que ya usa `.asteroids-canvas` (mismo buffer 800×600), en vez de duplicar la regla.
   _Verificación:_ `/games/bloque-buster/play` juega Arkanoid real; el canvas llena el CRT sin deformarse; `rocas` y `caida` siguen igual.

6. **Regresión y limpieza.** Comprobar que no queda el reproductor simulado para `bloque-buster`, que se cancela el `requestAnimationFrame` y se quitan los listeners de teclado y de ratón al salir, y que **GUARDAR PUNTUACIÓN** sigue deshabilitado.
   _Verificación:_ `npm run build` y `npm run dev` sin errores; cargan sin regresiones `/`, `/games`, `/games/[id]`, `/games/bloque-buster/play`, `/games/caida/play`, `/games/rocas/play`, `/hall-of-fame`, `/about`, `/auth`.

## Criterios de aceptación

- [ ] Existe `lib/games/bloque-buster.ts` con el engine portado a TypeScript (`createBloqueBusterGame(canvas, onChange)`), sin globals en `window` ni manipulación del DOM.
- [ ] Existe `public/games/bloque-buster/spritesheet-breakout.png` y el engine dibuja paddle, pelota y bloques con sus recortes.
- [ ] Existe `components/games/BloqueBusterGame.tsx` (`'use client'`) que monta el canvas 800×600 y sube el snapshot por callback.
- [ ] `lib/games/registry.ts` registra `bloque-buster → BloqueBusterGame`; `GamePlayer.tsx` **no** aparece en el diff.
- [ ] En `/games/bloque-buster/play` se juega Arkanoid real: el paddle responde a ←/→ **y al ratón**, la pelota rebota en muros y paddle, y los bloques desaparecen al ser golpeados sumando 10 pts.
- [ ] Al romper un bloque se ve la animación de explosión de 4 frames en el color del bloque.
- [ ] Los **5 niveles** cargan con sus patrones (parrilla, pirámide, ajedrez, filas con huecos, marco+cruz) y la pelota acelera nivel a nivel (×1.00 → ×1.46).
- [ ] Al limpiar la grilla se avanza de nivel; al limpiar el **nivel 5** se abre el modal de fin con el score acumulado.
- [ ] Al caer la pelota se descuenta una vida y se reposiciona; con 0 vidas se abre el modal de fin.
- [ ] El HUD muestra **Puntuación**, **Vidas** (♥♥♥) y **Nivel** reales del engine; el canvas **no** pinta HUD, overlays ni el selector de nivel.
- [ ] **PAUSA** (botón) y **Escape** congelan el juego y muestran "EN PAUSA"; **REANUDAR** continúa sin que la pelota salte.
- [ ] **FIN** fuerza el game over y abre el modal con la puntuación real.
- [ ] **GUARDAR PUNTUACIÓN** sigue deshabilitado con su aviso; **JUGAR DE NUEVO** reinicia desde el nivel 1 con 3 vidas; **SALIR** navega a `/games/bloque-buster`.
- [ ] ←/→ no hacen scroll de la página mientras se juega.
- [ ] Al desmontar (SALIR/navegar) se cancela el `requestAnimationFrame` y se quitan los listeners de teclado y de ratón.
- [ ] Si el spritesheet falla al cargar, el juego sigue siendo jugable con rectángulos de color (no queda una pantalla negra).
- [ ] `rocas` y `caida` se siguen jugando igual y los demás juegos siguen simulados.
- [ ] `npm run build` termina sin errores y las rutas existentes cargan sin regresiones en consola.

## Decisiones

- **Sí:** portar a TS con closure (sin globals ni DOM), igual que SPEC 05 y 07. Evita fugas y dobles loops en StrictMode.
- **Sí:** conservar el spritesheet original y sus explosiones de 4 frames. Es la identidad visual del juego portado; el coste es una imagen en `public/`.
- **Sí:** cargar la imagen **por instancia**, sin la caché de módulo del original (`ssImg`/`ssLoaded`/`ssCallbacks`). Solo hay un engine montado a la vez; una caché global sería estado mutable de módulo por cero beneficio.
- **Sí:** respaldo de rectángulos de color si el spritesheet no carga. Un fallo de red dejaría el canvas en negro sin ninguna señal.
- **Sí:** teclado **y** ratón. El control por ratón es parte del género; el listener va en el canvas y se escala con `getBoundingClientRect` porque el buffer se estira dentro del CRT.
- **Sí:** la victoria (limpiar el nivel 5) emite `"gameover"` y abre el modal de fin con el score final. Evita ampliar `GameState` y tocar `GamePlayer`, a cambio de que ganar y perder muestren el mismo modal.
- **Sí:** `pause()` cancela el RAF y `resume()` resetea `last`. El original nunca paraba el loop; cancelarlo de verdad exige resetear el reloj para que la pelota no salte.
- **No:** portar el sonido (`ball-bounce.mp3`, `break-sound.mp3`). Decisión del usuario, consistente con SPEC 07; añade autoplay-policy y limpieza de instancias `Audio` por poco valor.
- **No:** el overlay de pausa en canvas y su selector de nivel 1–5. Era ayuda de desarrollo y viola la regla de SPEC 05 (los overlays son de React).
- **No:** emitir el estado `"dead"`. Perder una vida solo reposiciona la pelota; no hay transición que React deba ver.
- **No:** tocar `GamePlayer.tsx`. El registro y el atajo Escape ya llegaron con SPEC 07; este spec solo añade una entrada a `ENGINES`.
- **No:** migración de Supabase ni portada nueva. `bloque-buster` ya existe en `games` con `cover-bricks`.
- **No:** habilitar el guardado de puntaje. Espera al spec de auth real.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| StrictMode / montaje-desmontaje duplica el loop o filtra listeners. | Encapsular en `createBloqueBusterGame`; listeners en `start()`, quitarlos en `destroy()`; cancelar RAF al desmontar; `useEffect([])` monta una vez. |
| El spritesheet no carga (red, ruta mal) y el canvas queda negro. | `onerror` arranca el loop igual y dibuja rectángulos de color; el juego sigue jugable. |
| La coordenada del ratón se desalinea porque el canvas 800×600 se estira en el CRT. | Convertir siempre con `getBoundingClientRect()` y el factor `canvas.width / rect.width`, como en el original. |
| Tras reanudar, el primer `dt` vale toda la pausa y la pelota atraviesa bloques. | `pause()` cancela el RAF, `resume()` resetea `last = null`, y `dt` va clampeado a 0.05 s. |
| `dt` alto (pestaña en segundo plano) hace que la pelota tunelee a través del paddle o los bloques. | Clamp de `dt` a 0.05 s y colisión con el paddle tolerante (`ball.y + ball.h <= paddle.y + paddle.h + 8`), tal como el original. |
| Emitir `onChange` cada frame provoca renders a 60 fps. | `emitIfChanged` solo dispara al cambiar `score/lives/level/state`. |
| El engine hereda el "un bloque por frame" del original y con `dt` alto ignora colisiones simultáneas. | Se porta 1:1 a propósito: cambiarlo sería alterar la mecánica, que está fuera de alcance. |

## Lo que **no** está en este spec

- Sonido de rebote y de ruptura de bloque.
- El overlay de pausa en canvas y el selector de nivel 1–5.
- Un estado `win` propio con su mensaje de victoria.
- Escritura real de puntajes (INSERT en `scores`) y su policy de RLS.
- Power-ups, niveles adicionales o cambios de física.
- Controles táctiles/móvil.

Cada uno, si aterriza, va en su propio spec.
