---
name: add-game
description: Genera un spec para añadir un juego arcade con engine real (canvas) y su leaderboard, integrándolo en la plataforma siguiendo el patrón de los specs 05 (engine) y 06 (Supabase). El juego puede venir de references/started-games o ser nuevo. No escribe código; produce specs/NN-juego-<id>.md para implementar luego con /spec-impl. Úsalo antes de implementar un juego nuevo.
disable-model-invocation: true
argument-hint: '<slug-o-carpeta> (p.ej. caida o 03-tetris)'
---

# /add-game — Diseñador de spec para un juego nuevo

Este skill produce el **spec** para añadir un juego jugable (engine de canvas) con su leaderboard,
integrado en la plataforma. **No escribes código aquí.** Tu único entregable es un archivo
`specs/NN-juego-<id>.md` en estado `Borrador`, listo para implementar después con `/spec-impl`.

El skill especializa el flujo de `/spec` con el conocimiento de dos patrones ya implementados para el
juego `rocas`: **SPEC 05** (engine de canvas portado a TypeScript + componente React + wiring en
`GamePlayer`) y **SPEC 06** (catálogo y leaderboard en Supabase). Toda la mecánica concreta —rutas,
firmas, formato de semillas, el registro de engines— vive en `pattern.md`, **en esta misma carpeta**.

## Filosofía

El spec es el contrato que dirige la implementación. Aquí vamos **lento definiendo** y **rápido
escribiendo**. El juego puede o no venir de `references/started-games/`; en cualquier caso, el objetivo
es un spec sin ambigüedades que `/spec-impl` pueda ejecutar paso a paso.

Tus respuestas van **en el idioma del prompt inicial** (si te invocan en español, respondes en español).

## Regla del registro (clave de escalado)

Hoy `GamePlayer.tsx` elige el engine con una rama única `game.id === "rocas"`, que **no escala**. Los
`id` de los juegos **ya vienen de Supabase**. Por eso el spec que generes usa un **registro
`id → componente`** (`lib/games/registry.ts`) indexado por `game.id`, **sin columnas nuevas**:

- Si el registro **aún no existe** (estás añadiendo el 2º engine, el primero tras `rocas`), el spec
  incluye el **refactor único**: crear `lib/games/types.ts` + `lib/games/registry.ts` y migrar
  `GamePlayer` de `isRocas` a `const Engine = ENGINES[game.id]`.
- Si el registro **ya existe**, el spec solo **añade una entrada** `ENGINES["<id>"] = <Id>Game`.

Los detalles exactos del refactor están en `pattern.md §4`. Léelo antes de redactar el plan.

## Flujo del comando (4 fases, en orden)

Sigue las cuatro fases sin saltarte ninguna. Si el usuario quiere acelerar, recuérdale que un mal spec
se paga después en código.

### Fase 1 — Contexto

Antes de preguntar por el juego, reúne contexto del proyecto:

1. Lee `CLAUDE.md` y `AGENTS.md` (convenciones; Next.js 16, App Router, `/frontend-design` obligatorio
   para UI). Recuerda leer los docs locales de Next en `node_modules/next/dist/docs/01-app` si el spec
   toca rutas o data-fetching (aunque `app/games/[id]/play/page.tsx` ya es genérica).
2. Lee **`pattern.md`** (misma carpeta que este skill): es tu referencia de rutas, firmas y formato.
3. **Lee la skill `/spec` como referencia obligatoria:** `.claude/skills/spec/SKILL.md` (su método de
   diseño de specs: fases, cómo preguntar, cómo desarrollar sección por sección, reglas duras) y
   `.claude/skills/spec/template.md` (la forma de cada sección). Este skill **reutiliza el método de
   `/spec`**: no dupliques su lógica, síguela. Si `/spec` y este skill difieren en algún detalle de
   forma, manda `/spec`.
4. Lista `specs/` para ver la numeración; lee `specs/05-*.md` y `specs/06-*.md` para tono y estructura.
5. Inspecciona el **estado del código**:
   - ¿Existe `lib/games/registry.ts` y `lib/games/types.ts`? ¿Qué engines hay en `ENGINES`?
   - ¿Qué hay en `components/games/`? ¿Cómo está hoy `GamePlayer.tsx` (rama `isRocas` o ya registro)?
6. Averigua qué slugs ya están en la tabla `games`: preferentemente con Supabase MCP
   (`execute_sql`: `select id, title, cat, cover, sort from games order by sort`), o leyendo
   `supabase/migrations/0002_seed.sql`. Anota el `sort` máximo por si hace falta una fila nueva.

Si `$ARGUMENTS` viene vacío, pide al usuario el juego a añadir (una carpeta de
`references/started-games/` o una descripción de una frase). Si la descripción no cabe en una frase, es
señal de que el juego es demasiado grande: sugiere acotarlo.

### Fase 2 — Identificar el juego (preguntas)

Es la fase más importante. Detecta ambigüedades y **pregunta**, no asumas. Preguntas en bloques de 3 a
5, con opciones (2–4) marcando tu recomendación y por qué. Espera respuesta antes de seguir.

Cierra estas incógnitas (checklist completo en `pattern.md §7`):

- **Fuente.** ¿Portamos una carpeta de `references/started-games/` o es un juego nuevo descrito? Si es
  de referencia, di qué forma tiene su engine (asteroids = clases/polling; tetris = matrices/eventos +
  doble canvas; arkanoid = objetos + assets/audio + `levels.js`) — ver `pattern.md §5`.
- **Slug destino (`game.id`).** Propón el mapeo referencia→slug (`03-tetris → caida`,
  `04-arkanoid → bloque-buster`) y **confírmalo**. Comprueba si ese slug **ya existe** en `games`:
  - Existe → **sin** migración de Supabase ni cover; solo engine + componente + registro.
  - No existe → el plan añadirá migración (`games` + `scores`) y clase `cover-*`.
- **Mapeo del HUD.** El HUD muestra score / vidas (♥) / nivel. Si el juego no tiene "vidas" (tetris),
  decide cómo mapear el snapshot (p. ej. reusar `lives` para otra métrica y adaptar la etiqueta) y
  regístralo. Contrato mínimo del snapshot: `score/lives/level/state`.
- **Controles** de teclado (y qué teclas necesitan `preventDefault`), y si hay ratón (arkanoid).
- **Assets** (spritesheet/audio) o segundo canvas (preview de tetris), si aplican.
- **Refactor de registro:** determina si este es el 2º engine (registro aún no existe) o uno posterior.

Si algo abre la caja de Pandora (multijugador, sonido global, mecánica nueva), señálalo como fuera de
alcance de este spec.

Deja de preguntar cuando puedas responder sin asumir: (1) qué archivos aparecen/cambian, (2) cuál es el
primer y el último paso, (3) cómo se verifica que el juego quedó terminado.

### Fase 3 — Desarrollar el spec sección por sección

**Sigue el método de la skill `/spec`** (`.claude/skills/spec/SKILL.md`, Fase 3) rellenando la
estructura de `.claude/skills/spec/template.md`. No generes el spec de una sola vez: desarrolla las
secciones **una a una**, mostrando cada una y esperando confirmación antes de la siguiente. Orden
estricto (secciones del `template.md`, aquí precargadas con el contenido de juego):

1. **Header.** Título `SPEC NN — Juego <TÍTULO> (<id>)`; `Estado: Borrador`;
   `Depende de: SPEC 05, SPEC 06`; fecha; objetivo en **una** frase.
2. **Alcance.** Dentro (engine + componente + registro + —si aplica— Supabase). Fuera explícito:
   escritura real de puntajes (espera auth), audio si no se porta, otros juegos, cambios de mecánica.
3. **Modelo de datos.** Entidades del engine (tipos/clases portadas 1:1) y la forma del `<Id>Snapshot`.
   Si el juego **no** entra a `games`, aquí van las columnas de la fila nueva y el formato de `scores`
   (ver `pattern.md §6`). Si ya está en `games`, dilo: "no introduce datos nuevos en Supabase".
4. **Plan de implementación** (pasos numerados, cada uno commitable y funcional). Orden recomendado:
   1. Portar el engine a `lib/games/<id>.ts` respetando el **contrato de SPEC 05** (`pattern.md §2`):
      closure sin globals, input en `start()`/`destroy()`, RAF con `dt` clampeado, `emitIfChanged`,
      sin dibujar HUD/overlay. _Verificación:_ `npm run build` compila el módulo.
   2. Crear `components/games/<Id>Game.tsx` (`'use client'`, `forwardRef`, `onSnapshot`) — `pattern.md §3`.
   3. **Solo si el registro no existe (2º engine):** crear `lib/games/types.ts` + `lib/games/registry.ts`
      y refactorizar `GamePlayer` (`isRocas` → `ENGINES[game.id]`, propagando a handlers, simulador y
      HUD) — `pattern.md §4`. **Si ya existe:** añadir la entrada `ENGINES["<id>"] = <Id>Game`.
   4. **Solo si el juego NO está en `games`:** migración `supabase/migrations/00NN_<id>.sql`
      (fila de `games` con `sort` = siguiente entero + ~10 `scores`) y clase `cover-<name>` en
      `app/globals.css` diseñada con `/frontend-design`. _Verificación:_ `select` en Supabase devuelve
      el juego y sus scores.
   5. Cablear botones/modal al engine (PAUSA/FIN/SALIR/JUGAR DE NUEVO) reusando los handlers de
      `GamePlayer`; **GUARDAR PUNTUACIÓN** sigue **deshabilitado**.
   6. Regresión: `npm run build` + `npm run dev` sin errores; se limpian RAF y listeners al salir.
5. **Criterios de aceptación** (checklist booleano y verificable: la nave/pieza responde al teclado, el
   HUD muestra estado real, PAUSA congela, FIN abre el modal, el juego aparece en `/games`, etc.).
6. **Decisiones tomadas y descartadas** (con motivo breve: p. ej. "Sí: registro por `id` —los ids ya
   vienen de Supabase, sin columna nueva"; "No: habilitar guardado —espera al spec de auth").
7. **Riesgos** (si aplican: StrictMode duplicando loops, `onChange` cada frame, deformación del canvas,
   assets que fallan al cargar, etc.).

Tras cada sección: muéstrala en markdown y pregunta "¿Esta sección queda así o la ajustamos?". Solo
avanza cuando el usuario confirme.

### Fase 4 — Guardar el spec

Guarda **siguiendo la Fase 4 de `/spec`** (`.claude/skills/spec/SKILL.md`); relee esas instrucciones
antes de escribir el archivo para no divergir de sus convenciones:

1. Determina el siguiente número mirando `specs/` (si el último es `06-…`, este es `07-`).
2. Slug del archivo: `juego-<id>` (p. ej. `07-juego-caida`). Confirma el nombre antes de escribir.
3. Escribe `specs/NN-juego-<id>.md` con las secciones aprobadas, en estado `Borrador`.
4. **Semilla del config si no existe** (igual que `/spec`): si falta `specs/.spec-config.yml`, créalo
   con el default (`AutoCreateBranch: true`); si ya existe, **no lo toques**.
5. Confirma al usuario: ruta creada; recuerda que está en `Borrador` (cámbialo a `Aprobado` tras
   releerlo); siguiente paso: `/spec-impl NN-juego-<id>`.
6. **Para aquí.** No propongas implementar ni escribas código.

## Reglas duras

- **Nunca escribas código** durante este comando. Solo el `.md` del spec al final.
- **Nunca apliques migraciones de Supabase** ni ejecutes `apply_migration`: eso es implementación. Como
  mucho, `execute_sql` de solo lectura (SELECT) en Fase 1 para saber qué juegos existen.
- **Nunca propongas implementar el spec** tras guardarlo. Tu trabajo termina con el archivo escrito.
- **Usa siempre `/frontend-design`** para cualquier UI nueva (portadas `cover-*`), por mandato de
  `CLAUDE.md`.
- **No asumas** decisiones que el usuario no confirmó (slug, mapeo del HUD, si hay assets). Pregunta.
- **No generes el spec entero de una vez.** Sección por sección, con confirmación.
- El engine **puede o no** existir en `references/`; ambos caminos son válidos.

## Argumentos

- `/add-game caida` → usa `caida` como slug destino sugerido; comprueba si existe en `games`.
- `/add-game 03-tetris` → fuente = carpeta de referencia; propón el mapeo a su slug (`caida`).
- `/add-game` sin argumento → empieza pidiendo el juego (carpeta o descripción de una frase).
