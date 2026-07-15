# SPEC 02 — Landing page y migración de rutas a `/games`

> **Estado:** Implemented
> **Depende de:** [01-mvp-visual-pantallas](01-mvp-visual-pantallas.md) (IMPLEMENTED)
> **Fecha:** 2026-07-08
> **Objetivo:** Portar la landing de `home.jsx` a una nueva ruta `/` y mover toda la sección de juegos (biblioteca, detalle y reproductor) bajo `/games`, con rutas 100% en inglés y sin implementar la página "Acerca de".

---

## Alcance

**Dentro:**

- Nueva **landing** en `/` portando `references/home-about/home.jsx` 1:1: hero con siluetas flotantes, sección "¿POR QUÉ ARCADE VAULT?", preview de juegos, stats, actividad en vivo, precios/FAQ y CTA final.
- Portar las clases CSS del home (`home-hero`, `home-title`, `feature-grid`, `mini-rail`, `home-stats`, `activity-grid`, `pricing-grid`, `home-final`, siluetas, etc.) desde `references/home-about/styles.css` a `app/globals.css`.
- `Home` como **componente `'use client'`** con animaciones completas: `useReveal` (IntersectionObserver reveal-on-scroll), `FloatingSilhouettes` y `FeatureIcon` (SVGs pixel), efectos de hover/tilt del template.
- Datos del home **hardcodeados 1:1** dentro del componente (features, mini-rail usa `GAMES.slice(0,6)`, stats, últimas puntuaciones, top jugadores, FAQ, pricing) — tal como el template.
- **Migración de rutas** — todo bajo `/games`, en inglés:
  - `/games` → biblioteca (mover la actual `app/page.tsx`).
  - `/games/[id]` → detalle (mover `app/juego/[id]/`).
  - `/games/[id]/play` → reproductor (mover `app/jugar/[id]/`).
  - `/hall-of-fame` → Salón de la Fama (mover `app/salon/`).
- Actualizar **todos los enlaces internos**: `GameCard` → `/games/[id]`; `GameDetail` "JUGAR AHORA" → `/games/[id]/play` y "volver" → `/games`; `GamePlayer` "volver al detalle" → `/games/[id]` y "salir" → `/games`; `HallOfFame` "explorar" → `/games`; `Auth` login → `/games`; `not-found` → `/games`.
- Actualizar el **`Nav`**: añadir enlace "Inicio" (→ `/`, activo solo en la landing); "Biblioteca" → `/games` (activo en `/games`, `/games/[id]` y `/games/[id]/play`); "Salón de la Fama" → `/hall-of-fame`; logo → `/`.
- CTAs de la landing: "EXPLORAR JUEGOS" / "VER TODOS" / "INSERTAR MONEDA" → `/games`; "CREAR CUENTA" / "EMPEZAR GRATIS" → `/auth`; "VER SALÓN" → `/hall-of-fame`.

**Fuera de alcance:**

- La página **"Acerca de" (`about.jsx`)**: no se implementa ni se enlaza en el nav (se elimina la entrada).
- Cualquier lógica nueva de datos: los arrays del home son estáticos, no se conectan a `lib/data.ts` (salvo el `GAMES.slice(0,6)` que ya existe).
- Redirecciones (301/rewrites) desde las rutas viejas `/juego/[id]`, `/jugar/[id]` y `/salon`: **se eliminan**, no se mantienen como alias.
- Todo lo ya excluido en el spec 01 (juegos reales, auth real, backend, tests unitarios, i18n).

---

## Modelo de datos

**No se introducen estructuras de datos nuevas ni persistencia nueva.**

- La landing reutiliza `GAMES` de `lib/data.ts` solo para el mini-rail (`GAMES.slice(0, 6)`).
- El resto del contenido del home (features, stats, últimas puntuaciones, top jugadores, FAQ, pricing) son **literales inline** dentro del componente `Home`, portados 1:1 desde `home.jsx`. No se extraen a `lib/data.ts` ni se tipan como estructuras reutilizables.
- No se tocan las claves de `localStorage` (`av_user`, `av_scores`) ni el `SessionProvider`.

---

## Plan de implementación

Cada paso deja la app compilando y navegable (`npm run dev` sin errores). Antes de tocar routing, consultar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (rutas anidadas y dinámicas).

1. **CSS del home.** Portar a `app/globals.css` todas las reglas de las secciones home de `references/home-about/styles.css` (`home-hero`, `home-silos`/`silo`, `home-title`, `hero-*`, `home-section`, `section-head`/`kicker`/`section-rule`, `feature-grid`/`feature-card`/`ft-*`, `mini-rail`/`mini-card`/`mini-*`, `home-stats`/`stat-*`, `activity-grid`/`activity-card`/`ac-*`/`ticker`/`tick-row`/`tk-*`/`top-*`/`tp-*`/`lb-link`, `pricing-grid`/`price-card`/`pc-*`/`pricing-faq`/`faq-*`, `home-final`/`final-*`, y las animaciones `reveal`/`.in`). *Verificación:* `npm run build` compila; las clases existen en el bundle.

2. **Componente `Home`.** Crear `components/Home.tsx` (`'use client'`) portando `home.jsx`: `useReveal` (IntersectionObserver), `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`, y el árbol de secciones. Sustituir `navigate(...)` por `next/link`/`useRouter`: EXPLORAR/VER TODOS/INSERTAR MONEDA → `/games`; CREAR CUENTA/EMPEZAR GRATIS → `/auth`; VER SALÓN → `/hall-of-fame`; mini-cards → `/games/[id]`. Usa `GAMES.slice(0,6)`. *Verificación:* el componente monta sin errores de hidratación en consola.

3. **Landing en `/`.** Reemplazar `app/page.tsx` para que renderice `<Home />`. *Verificación:* `/` muestra la landing completa con animaciones de scroll.

4. **Biblioteca en `/games`.** Crear `app/games/page.tsx` con el contenido de la antigua `app/page.tsx` (Server Component que renderiza `<Library games={GAMES} />`). *Verificación:* `/games` muestra las 8 tarjetas con búsqueda y filtros.

5. **Detalle en `/games/[id]`.** Mover `app/juego/[id]/page.tsx` a `app/games/[id]/page.tsx` (sin cambios de lógica). Borrar `app/juego/`. *Verificación:* `/games/bloque-buster` muestra el detalle; `/games/xxx` da 404.

6. **Reproductor en `/games/[id]/play`.** Mover `app/jugar/[id]/page.tsx` a `app/games/[id]/play/page.tsx`. Borrar `app/jugar/`. *Verificación:* `/games/bloque-buster/play` carga el reproductor; id inválido da 404.

7. **Enlaces internos.** Actualizar: `GameCard` → `/games/[id]`; `GameDetail` "JUGAR AHORA" → `/games/[id]/play`, "volver" → `/games`; `GamePlayer` "volver al detalle" → `/games/[id]`, "salir" → `/games`; `HallOfFame` "explorar" → `/games`; `Auth` login (2 sitios) → `/games`; `not-found` → `/games`. *Verificación:* `grep -rn '/juego\|/jugar' app components` no devuelve nada.

8. **Salón en `/hall-of-fame`.** Mover `app/salon/page.tsx` a `app/hall-of-fame/page.tsx`. Borrar `app/salon/`. *Verificación:* `/hall-of-fame` carga el Salón; `/salon` da 404.

9. **Nav.** Añadir "Inicio" (→ `/`); "Biblioteca" → `/games`; "Salón de la Fama" → `/hall-of-fame`; logo → `/`. Reescribir `isActive`: `inicio` solo en `/`; `biblioteca` en `/games` y `/games/*`; `salon` en `/hall-of-fame`. Aplicar en desktop y panel móvil. *Verificación:* el enlace activo se resalta según la ruta; `grep -rn '/salon' app components` no devuelve nada.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings de TypeScript.
- [ ] `npm run dev` levanta la app y la consola del navegador no muestra errores ni warnings de hidratación en `/`.
- [ ] `/` muestra la landing con todas sus secciones: hero + siluetas flotantes, "¿POR QUÉ ARCADE VAULT?" (4 features), preview de 6 juegos, stats, actividad en vivo (últimas puntuaciones + top jugadores), precios/FAQ y CTA final.
- [ ] Al hacer scroll en `/`, las secciones con `.reveal` aparecen con la animación (clase `.in` añadida por el IntersectionObserver).
- [ ] En la landing: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS", "INSERTAR MONEDA" navegan a `/games`; "CREAR CUENTA" y "EMPEZAR GRATIS" a `/auth`; "VER SALÓN" a `/hall-of-fame`; cada mini-card a `/games/[id]`.
- [ ] `/games` muestra las 8 tarjetas; el buscador filtra por título; los chips filtran por categoría; sin resultados aparece "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta de `/games` navega a `/games/[id]` con el juego correcto.
- [ ] `/games/[id]` muestra el detalle; "JUGAR AHORA" navega a `/games/[id]/play`; "volver" navega a `/games`.
- [ ] `/games/[id]/play` carga el reproductor; "volver al detalle" navega a `/games/[id]`; "salir" navega a `/games`.
- [ ] `/games/no-existe` y `/games/no-existe/play` renderizan `app/not-found.tsx` (404), no un crash.
- [ ] Las rutas viejas `/juego/bloque-buster`, `/jugar/bloque-buster` y `/salon` devuelven 404 (ya no existen).
- [ ] `grep -rn '/juego\|/jugar\|/salon' app components` no devuelve ninguna coincidencia (sin rutas en español).
- [ ] En `/auth`, enviar el formulario redirige a `/games`; "JUGAR COMO INVITADO" también.
- [ ] En el `not-found`, el botón principal navega a `/games`.
- [ ] En el Salón (`/hall-of-fame`), el botón "explorar" navega a `/games`.
- [ ] El `Nav` muestra "Inicio", "Biblioteca" y "Salón de la Fama" (NO muestra "Acerca de"), tanto en desktop como en el panel móvil.
- [ ] El enlace "Inicio" se resalta solo en `/`; "Biblioteca" se resalta en `/games` y en `/games/*`; el logo navega a `/`.

> **Verificación:** al terminar la implementación, estos criterios se validarán de forma automatizada con **Playwright** (navegación real por `/`, `/games`, `/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`), comprobando destinos de navegación, los 404 de las rutas viejas y la ausencia del enlace "Acerca de".

### Escenarios Playwright

Cada escenario es un test end-to-end sobre el servidor de dev.

1. **Landing carga.** `goto('/')` → visibles el hero (`.home-hero`), las 4 `.feature-card`, 6 `.mini-card`, `.home-stats`, `.activity-grid`, `.pricing-grid`, `.home-final`.
2. **Reveal on scroll.** `goto('/')` → hacer scroll hasta `.pricing-grid` → su sección `.reveal` tiene la clase `.in`.
3. **CTA EXPLORAR.** Click en "EXPLORAR JUEGOS" → URL = `/games`.
4. **CTA CREAR CUENTA.** Click en "CREAR CUENTA" → URL = `/auth`.
5. **CTA VER SALÓN.** Click en "VER SALÓN →" → URL = `/hall-of-fame`.
6. **Mini-card.** Click en la primera `.mini-card` → URL coincide `/games/<id>`.
7. **Biblioteca.** `goto('/games')` → 8 tarjetas; escribir en el buscador filtra; chip de categoría filtra.
8. **Tarjeta → detalle.** Click en una tarjeta → URL = `/games/<id>` y muestra el título correcto.
9. **Detalle → jugar.** En `/games/bloque-buster` click "JUGAR AHORA" → URL = `/games/bloque-buster/play`.
10. **Detalle → volver.** Click "volver" → URL = `/games`.
11. **Reproductor → volver al detalle.** En `/games/bloque-buster/play` click "volver al detalle" → URL = `/games/bloque-buster`.
12. **Reproductor → salir.** Click "salir" → URL = `/games`.
13. **404 ruta nueva.** `goto('/games/no-existe')` → contenido de `not-found`; su botón → `/games`.
14. **404 rutas viejas.** `goto('/juego/bloque-buster')`, `goto('/jugar/bloque-buster')` y `goto('/salon')` → 404.
15. **Auth redirige.** En `/auth` enviar el form → URL = `/games`.
16. **Nav sin About.** En cualquier ruta, el `nav.links` contiene "Inicio", "Biblioteca", "Salón de la Fama" y NO "Acerca de".
17. **Nav estado activo.** En `/` "Inicio" tiene `.active`; en `/games` y `/games/<id>` "Biblioteca" tiene `.active`.

---

## Decisiones

- **Sí:** landing en `/` y biblioteca en `/games`. La landing es la puerta de entrada natural; deja las URLs de producto (`/games`, `/games/[id]`) limpias y jerárquicas.
- **No:** mantener la biblioteca en `/` y colgar la landing de `/home`. Rompía la convención de que la raíz es el punto de entrada de marketing.
- **Sí:** anidar el reproductor como `/games/[id]/play`. Refleja la relación "juego → jugar ese juego" en la propia URL y agrupa toda la sección bajo `/games`.
- **No:** dejar el reproductor en una ruta hermana (`/play/[id]`). Válido, pero pierde la jerarquía juego→play y deja una ruta suelta.
- **Sí:** rutas 100% en inglés (`/games`, `/play`, `/hall-of-fame`). Consistencia y evita mezclar idiomas en las URLs (la UI sigue en español).
- **No:** conservar `/salon`, `/juego`, `/jugar`. Mezclaban español en las rutas; decisión explícita del usuario de eliminarlas.
- **Sí:** eliminar las rutas viejas sin redirección (404 directo). El proyecto es un MVP visual sin tráfico real ni enlaces externos que preservar.
- **No:** dejar redirects `/juego`→`/games`, `/salon`→`/hall-of-fame`. Añade middleware/config innecesario para un prototipo sin usuarios.
- **Sí:** `Home` como componente `'use client'` con animaciones completas (`useReveal`, siluetas, tilt). Es la vida visual de la landing y sigue el criterio del spec 01 de mantener los efectos del template.
- **No:** landing estática Server Component sin JS. Más simple pero mata el reveal-on-scroll y las animaciones que definen la página.
- **Sí:** datos del home hardcodeados 1:1 (actividad, stats, FAQ, pricing). Fidelidad total al template; no hay fuente real para esos datos.
- **No:** extraer la actividad/top jugadores a `lib/data.ts`. Introduciría estructura y lógica que nadie consume todavía (YAGNI).
- **Sí:** eliminar "Acerca de" del nav y no crear la página. Decisión explícita del usuario; evita un enlace muerto.
- **Sí:** los destinos "volver/redirigir" apuntan a `/games` (biblioteca), no a la landing. Conserva el flujo original del spec 01 (tras login/salir vuelves a los juegos, no a marketing).
- **Sí:** validar los criterios con Playwright al cierre. Los cambios son sobre todo de navegación y routing, ideales para tests e2e.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Enlaces rotos tras la migración: algún `href`/`push` a `/juego`, `/jugar` o `/salon` queda sin actualizar y navega a un 404. | El paso 7/9 termina con `grep -rn '/juego\|/jugar\|/salon' app components` que debe salir vacío; los escenarios Playwright #3–#15 cubren cada destino de navegación. |
| Hydration mismatch en `Home`: el `useReveal` (IntersectionObserver) o las siluetas manipulan el DOM y difieren entre SSR y cliente. | `useReveal` corre en `useEffect` tras el montaje (no en el render); el estado inicial de `.reveal` es el mismo en servidor y cliente, y solo se añade `.in` en el cliente. |
| Colisión/duplicación de clases al portar ~770 líneas a `app/globals.css` (nombres que ya existan o `@theme`/tokens repetidos). | Portar solo las reglas de secciones home ausentes (verificado: 0 coincidencias hoy); reutilizar los tokens de color ya definidos en `globals.css` en vez de redeclararlos. |
| Conflicto de rutas en `/games`: el índice `/games` y el dinámico `/games/[id]` conviven, y `[id]` podría capturar rutas no deseadas. | En App Router `page.tsx` en `app/games/` sirve `/games` exacto y `app/games/[id]/` solo los hijos; `notFound()` en el detalle cubre ids inválidos (escenario #13). |
| Caché del dev server tras mover carpetas (`.next`) sirve rutas viejas o da errores de módulos. | Reiniciar `npm run dev` (o borrar `.next`) tras mover `app/juego`, `app/jugar` y `app/salon`. |
