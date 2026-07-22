# SPEC 05 — Juego de Asteroides real (ROCAS)

> **Estado:** Implementado
> **Depende de:** [SPEC 02 — Landing y rutas de games](./02-landing-y-rutas-games.md) (ruta `/games/[id]/play` y `components/GamePlayer.tsx`)
> **Fecha:** 2026-07-21
> **Objetivo:** Reemplazar el reproductor simulado por el juego de asteroides real (canvas) únicamente para el juego `rocas`, portando el engine vanilla a un módulo TypeScript y cableándolo al HUD, los botones y el modal de guardado que ya existen.

## Alcance

**Dentro:**

- Portar el engine vanilla `references/started-games/02-asteroids/game.js` a TypeScript en `lib/games/asteroids.ts` (agnóstico de React): tipos para las entidades, `init`, loop, input y estado, exponiendo una API para montar/desmontar y leer estado.
- Crear `components/games/AsteroidsGame.tsx`: monta un `<canvas>` de búfer 800×600 escalado por CSS, corre el loop, captura teclado (←/→ rotar, ↑ propulsar, Espacio disparar) y **sube el estado** (`score`, `lives`, `level`, `state`) al padre vía callbacks.
- Modificar `components/GamePlayer.tsx` para que, cuando `game.id === "rocas"`, renderice `<AsteroidsGame>` en lugar de la arena simulada; los demás juegos conservan el reproductor simulado actual.
- Cablear los botones existentes al engine: **PAUSA** congela el loop, **FIN** fuerza game over, **SALIR** navega al detalle, **JUGAR DE NUEVO** reinicia desde cero.
- Quitar del canvas el HUD (SCORE/NIVEL/vidas) y el overlay GAME OVER; el HUD y el modal de fin los maneja React con estado real del engine. Se conservan las entidades del juego, incluido el power-up y su indicador 3x dibujados en el campo.
- Al terminar la partida, guardar la puntuación con el `saveScore` actual (`SessionProvider`, localStorage).
- Escalado responsive del canvas dentro de la pantalla del CRT preservando aspecto 4:3 (clase CSS en `app/globals.css` si hace falta).

**Fuera de alcance (specs futuros):**

- Engine real para los otros 7 juegos (siguen simulados).
- Persistir puntuaciones en Supabase / leaderboard real (sigue el mock localStorage).
- Controles táctiles / móvil (solo teclado, escritorio).
- Sonido, música o efectos de audio.
- Cambiar la mecánica del juego (física, puntajes, power-ups, número de vidas) respecto al original.
- Rediseñar el marco CRT, el HUD o el modal existentes.

## Modelo de datos

Este spec **no introduce datos persistidos nuevos**: el guardado sigue usando el `SavedScore` existente del `SessionProvider` (localStorage). Solo introduce estructuras **en memoria** al portar el engine y la forma del estado que se sube a React.

**Entidades del engine (portadas 1:1 a clases/tipos en `lib/games/asteroids.ts`):**

- `Bullet` — `x, y, vx, vy, ttl, radius, dead`
- `Asteroid` — `x, y, size (1|2|3), radius, vx, vy, rot, rotSpeed, verts, dead` + `split()`
- `Ship` — `x, y, angle, vx, vy, radius, thrusting, invincible, shootCooldown, tripleShot, dead` + `tryShoot()`
- `Particle` — `x, y, vx, vy, life, ttl, dead`
- `PowerUp` — `x, y, vx, vy, radius, ttl, dead`

**Estado del juego** (globals del engine, ahora encapsulados): `ship, bullets, asteroids, particles, powerUps, score, lives, level, state, deadTimer, powerUpSpawned, killsSinceSpawn`, con `state: "playing" | "dead" | "gameover"`.

**API pública del módulo `lib/games/asteroids.ts`** (nombres tentativos):

```ts
type AsteroidsState = "playing" | "dead" | "gameover";

interface AsteroidsSnapshot {
  score: number;
  lives: number;
  level: number;
  state: AsteroidsState;
}

interface AsteroidsGameHandle {
  start(): void;                 // arranca el loop (requestAnimationFrame)
  pause(): void;                 // congela loop y tiempo
  resume(): void;                // reanuda
  forceGameOver(): void;         // FIN → state = "gameover"
  restart(): void;               // reinicia desde cero
  destroy(): void;               // cancela RAF y quita listeners de teclado
}

function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  onChange: (snap: AsteroidsSnapshot) => void,   // notifica cambios de score/lives/level/state
): AsteroidsGameHandle;
```

`onChange` se dispara cuando cambia cualquier valor del snapshot (no cada frame), y es la vía por la que el HUD y el modal de React leen el estado real.

## Plan de implementación

> Antes de tocar la ruta o el componente, consultar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (Client Components, ya que el canvas y el teclado son `'use client'`). El engine es lógica de navegador pura; no necesita nada de servidor.

1. **Portar el engine a `lib/games/asteroids.ts`.** Traducir `game.js` a TypeScript: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` con tipos; encapsular los globals dentro de una closure en `createAsteroidsGame(canvas, onChange)`; mantener física, puntajes, power-up y vidas idénticos al original. El input de teclado se registra/desregistra desde el handle (`start`/`destroy`), no en `window` a nivel de módulo. Quitar el dibujado del HUD (`drawHUD`) y del overlay (`drawOverlay` en gameover); conservar el dibujo de entidades y del power-up. Emitir `onChange` cuando cambie el snapshot.
   _Verificación:_ `npm run build` compila el módulo sin errores de tipos.

2. **Crear `components/games/AsteroidsGame.tsx`** (`'use client'`). Recibe props `onSnapshot(snap)` y una `ref`/handle imperativa (o expone callbacks) para `pause/resume/forceGameOver/restart`. En `useEffect` monta el `<canvas width=800 height=600>`, llama a `createAsteroidsGame`, arranca el loop y limpia con `destroy()` al desmontar. Previene el scroll de página en flechas/espacio (`preventDefault`). El canvas se escala por CSS al contenedor (aspecto 4:3).
   _Verificación:_ montando el componente aislado, el juego corre, responde al teclado y el snapshot llega por callback.

3. **Integrar en `components/GamePlayer.tsx`.** Ramificar por `game.id === "rocas"`: si es rocas, renderizar `<AsteroidsGame>` dentro del `crt-screen` en vez de la `game-arena` simulada, y **eliminar** para ese caso el `setInterval` que inventa el score. Alimentar `score`, `lives`, `level`, `over` desde el snapshot del engine. Los demás juegos quedan exactamente igual (arena simulada).
   _Verificación:_ `/games/rocas/play` muestra el canvas real; los otros juegos siguen con la simulación.

4. **Cablear botones y modal al engine.** PAUSA → `pause()`/`resume()` (y overlay "EN PAUSA" existente); FIN → `forceGameOver()`; cuando el snapshot llega a `state === "gameover"` se abre el modal existente con el score real; **GUARDAR PUNTUACIÓN** usa `saveScore({ game: game.id, score, name })`; **JUGAR DE NUEVO** → `restart()` y reset del modal; **SALIR** → `router.push('/games/rocas')`.
   _Verificación:_ los cuatro flujos funcionan; la puntuación guardada aparece en localStorage (`av_scores`).

5. **Escalado y encaje visual.** Ajustar el canvas dentro de `.crt-screen` (clase en `app/globals.css` si hace falta) para que llene la pantalla del CRT manteniendo 4:3, sin romper el layout del reproductor ni el HUD.
   _Verificación:_ el canvas se ve nítido y centrado en desktop; no desborda el marco.

6. **Regresión y limpieza.** Verificar que no quedan restos del simulador para rocas, que el teclado no scrollea la página y que se limpian listeners/RAF al salir.
   _Verificación:_ `npm run build` y `npm run dev` sin errores en consola; `/`, `/games`, `/games/[id]`, `/games/[id]/play` (rocas y otro juego), `/hall-of-fame`, `/about`, `/auth` cargan sin regresiones.

## Criterios de aceptación

- [x] Existe `lib/games/asteroids.ts` con el engine portado a TypeScript (clases tipadas y `createAsteroidsGame(canvas, onChange)`), sin globals a nivel de `window`.
- [x] Existe `components/games/AsteroidsGame.tsx` (`'use client'`) que monta el canvas, corre el loop y sube el snapshot por callback.
- [x] En `/games/rocas/play` se juega el asteroides real: la nave rota (←/→), propulsa (↑) y dispara (Espacio); los asteroides se parten (grande→mediano→pequeño) y hay partículas de explosión.
- [x] El power-up de triple disparo (3x) aparece y funciona igual que en el original, dibujado en el campo.
- [x] El HUD de React muestra `score`, `lives` y `level` **reales** del engine (no simulados); el canvas ya no pinta HUD ni overlay GAME OVER.
- [x] **PAUSA** congela el juego y muestra el overlay "EN PAUSA"; **REANUDAR** lo continúa desde el mismo estado.
- [x] **FIN** fuerza el game over y abre el modal con la puntuación real.
- [x] Al perder todas las vidas se abre el modal de fin con el score real; **GUARDAR PUNTUACIÓN** persiste vía `saveScore` en `localStorage` (`av_scores`).
- [x] **JUGAR DE NUEVO** reinicia la partida desde cero; **SALIR** navega a `/games/rocas`.
- [x] Las flechas y el espacio no hacen scroll de la página mientras se juega.
- [x] Al desmontar (SALIR/navegar) se cancela el `requestAnimationFrame` y se quitan los listeners de teclado.
- [x] Los otros 7 juegos siguen mostrando el reproductor simulado, sin cambios.
- [x] `npm run build` termina sin errores y las rutas existentes cargan sin regresiones en consola.

## Decisiones tomadas y descartadas

- **Sí:** engine agnóstico en `lib/games/asteroids.ts` + componente `components/games/AsteroidsGame.tsx`. Separa lógica de juego de la UI; sigue la convención del repo (`lib/` para lógica, `components/` para vistas).
- **Sí:** portar a TypeScript en vez de cargar `game.js` vanilla. Lo exige CLAUDE.md ("portar a React/TS reales"); da tipos y evita estado global en `window`.
- **Sí:** canvas solo dibuja el juego; HUD/vidas/nivel y game over los maneja React con estado real del engine vía `onChange`. Evita duplicar información y reusa el HUD y el modal de guardado que ya existen.
- **Sí:** cablear PAUSA/FIN/SALIR/JUGAR DE NUEVO al engine. Consistencia con el reproductor actual y con el resto de la plataforma.
- **Sí:** búfer fijo 800×600 escalado por CSS (4:3). Mantiene la física intacta y encaja de forma responsive en el marco CRT.
- **Sí:** guardar con el `saveScore` mock (localStorage). Supabase/leaderboard real quedó fuera de alcance en el spec 04.
- **No:** engine real para los otros 7 juegos. Aún no existen; se ramifica por `id === "rocas"` sin construir un registro genérico prematuro.
- **No:** controles táctiles/móvil, audio, ni cambios de mecánica. Fuera de alcance; el objetivo es adaptar el juego tal cual.
- **No:** registro genérico de engines por juego. Sería arquitectura especulativa (YAGNI) para juegos que no existen.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El engine usa listeners de teclado en `window` a nivel de módulo y globals; en React (montaje/desmontaje, StrictMode doble efecto) puede duplicar loops o filtrar listeners. | Encapsular estado e input dentro de `createAsteroidsGame`; registrar listeners en `start()` y quitarlos en `destroy()`; cancelar el `requestAnimationFrame` al desmontar. |
| Emitir `onChange` cada frame provocaría renders de React a 60 fps y jank. | `onChange` solo dispara cuando cambia el snapshot (`score/lives/level/state`), no cada frame. |
| Las flechas y el espacio hacen scroll de la página / activan botones enfocados durante el juego. | `preventDefault` en las teclas del juego mientras el canvas está activo. |
| `state === "dead"`/`"gameover"` del engine y el `over` de React pueden desincronizarse (doble fuente de verdad). | React deriva su estado del snapshot del engine; el engine es la única fuente de verdad del ciclo de partida. |
| El escalado CSS del canvas puede deformar el juego o desbordar el marco CRT. | Mantener búfer 800×600 y escalar preservando 4:3 dentro de `.crt-screen`. |
| `performance.now()` se usa en el engine (power-up pulse); en SSR no existe. | El engine solo corre en cliente (`AsteroidsGame` es `'use client'`, montado en `useEffect`). |
