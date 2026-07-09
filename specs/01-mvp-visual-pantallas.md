# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Estado:** APRROVED
> **Depende de:** — (ninguna; primer spec del proyecto)
> **Fecha:** 2026-07-02
> **Objetivo:** Portar las seis pantallas del prototipo de `references/templates/` a páginas y componentes reales de Next.js App Router, solo en su capa visual, sin implementar ningún juego.

---

## Alcance

**Dentro:**

- Portar las 6 pantallas a rutas por archivos: `/` (biblioteca), `/juego/[id]` (detalle), `/jugar/[id]` (reproductor), `/auth` (acceso), `/salon` (Salón de la Fama).
- `Nav` (con menú móvil + backdrop) y `footer` montados en `app/layout.tsx`, presentes en todas las rutas.
- `SessionProvider` (Client Context) en el layout: lee/escribe `av_user` en `localStorage` y expone `user`, `login`, `signOut`, `saveScore`.
- Datos mock y tipos en `lib/data.ts` (`GAMES`, `CATS`, `seededScores`, tipo `Game`), portados 1:1 desde `data.jsx`.
- Reproductor con el **simulador visual completo**: ticker de puntuación (`setInterval`), HUD, pausa, FIN y modal de game-over que guarda en `av_scores`.
- `notFound()` + `app/not-found.tsx` con estética arcade para ids de juego inexistentes en `/juego/[id]` y `/jugar/[id]`.
- Split Server/Client: páginas como Server Components que leen los datos mock; interactividad (`Nav`, búsqueda/filtros, reproductor, auth, pestañas del salón) como hojas `'use client'`.
- Navegación con `next/link` y `useRouter` en sustitución del hash-router de `app.jsx`.
- Limpieza del scaffold: reemplazar `app/page.tsx` de ejemplo y borrar `public/next.svg` y `public/vercel.svg`.

**Fuera de alcance (para specs futuros):**

- Cualquier juego real jugable (lógica, canvas, motor). El reproductor es solo relleno visual.
- Autenticación real (validación, backend, OAuth con Google/GitHub — los botones son decorativos).
- Backend, base de datos o API de puntuaciones. Todo es mock/`localStorage`.
- Lectura y visualización de `av_scores` guardados (se escriben, pero ninguna pantalla los lee — igual que en el template).
- Puntuaciones reales por usuario en el Salón/detalle (siguen siendo generadas con `seededScores`).
- Tests automatizados (no hay runner configurado).
- Internacionalización (la UI queda en español, como el template).

---

## Modelo de datos

No se introducen estructuras nuevas: se portan 1:1 las de `data.jsx`, ahora tipadas en TypeScript.

```ts
// lib/data.ts

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;        // slug de ruta, ej. "bloque-buster"
  title: string;
  short: string;     // descripción de tarjeta
  long: string;      // descripción de detalle
  cat: GameCategory;
  cover: string;     // clase CSS de portada, ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;     // ya formateado, ej. "12.4K"
}

export const GAMES: Game[];              // los 8 juegos del template
export const CATS: readonly string[];    // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]

export interface ScoreRow { rank: number; name: string; score: number; date: string; }
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Sesión y persistencia (Client Context, sin cambios de forma respecto al template):

```ts
// components/SessionProvider.tsx

interface SessionUser { name: string; }       // localStorage "av_user"

interface SavedScore { game: string; name: string; score: number; at: number; } // append a "av_scores"

interface SessionValue {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void;      // null = invitado
  signOut: () => void;
  saveScore: (entry: { game: string; name: string; score: number }) => void;
}
```

Claves de `localStorage`: `av_user` (objeto o ausente) y `av_scores` (array; solo se escribe).

---

## Plan de implementación

Cada paso deja la app compilando y navegable (`npm run dev` sin errores).

1. **Datos mock tipados.** Crear `lib/data.ts` portando `GAMES`, `CATS` y `seededScores` desde `data.jsx`, con los tipos `Game`, `GameCategory`, `ScoreRow`. Verificación: `npm run build` compila; import de `GAMES` desde una página no falla.

2. **SessionProvider.** Crear `components/SessionProvider.tsx` (`'use client'`) con el Context: `user`, `login`, `signOut`, `saveScore`, hidratando desde `av_user` y escribiendo `av_user`/`av_scores`. Montarlo en `app/layout.tsx` envolviendo `#root`. Exportar hook `useSession()`. Verificación: la app carga; `useSession()` devuelve `user: null` en primera visita.

3. **Nav + footer en el layout.** Crear `components/Nav.tsx` (`'use client'`) portando `nav.jsx` (menú móvil, backdrop, coin-counter, botón login/sign-out) usando `next/link` + `usePathname` para el estado activo, y `useSession()` para el usuario. Añadir el `footer` al `layout.tsx`. Verificación: nav visible en todas las rutas; el hamburger abre/cierra el panel móvil.

4. **Biblioteca (`/`).** Reemplazar `app/page.tsx` (Server Component) que renderiza `components/Library.tsx` (`'use client'`) portando `biblioteca.jsx` (hero, búsqueda, chips de categoría, grid) y `GameCard` con el efecto tilt. Las tarjetas enlazan a `/juego/[id]`. Borrar `public/next.svg` y `public/vercel.svg`. Verificación: se ven las 8 tarjetas; búsqueda y filtros funcionan; clic navega al detalle.

5. **Detalle (`/juego/[id]`).** Crear `app/juego/[id]/page.tsx` (Server Component): busca el juego en `GAMES`, llama `notFound()` si no existe, y renderiza portada, info, stat-strip, acciones y el leaderboard con `seededScores`. Botón "JUGAR AHORA" enlaza a `/jugar/[id]`. Verificación: `/juego/bloque-buster` muestra el detalle; `/juego/xxx` da 404.

6. **not-found arcade.** Crear `app/not-found.tsx` con estética neón y enlace a `/`. Verificación: id inexistente muestra esta pantalla, no un error genérico.

7. **Auth (`/auth`).** Crear `app/auth/page.tsx` → `components/Auth.tsx` (`'use client'`) portando `auth.jsx` (pestañas iniciar/crear, campos, "jugar como invitado", social decorativa). Al enviar: `login({name})` + `router.push('/')`. Verificación: enviar el form crea sesión y redirige; el nav pasa a mostrar el nombre.

8. **Reproductor (`/jugar/[id]`).** Crear `app/jugar/[id]/page.tsx` → `components/GamePlayer.tsx` (`'use client'`) portando `reproductor.jsx`: HUD, ticker `setInterval`, subida de nivel, pausa, arena/CRT, modal de FIN con `saveScore`. `notFound()` si el id no existe. Verificación: la puntuación sube sola; pausa la congela; FIN abre el modal y "GUARDAR" persiste en `av_scores`.

9. **Salón de la Fama (`/salon`).** Crear `app/salon/page.tsx` → `components/HallOfFame.tsx` (`'use client'`) portando `salon.jsx`: pestañas por juego, podio, tabla y fila "TU MEJOR MARCA" si hay usuario. Verificación: cambiar de pestaña recalcula el ranking; con sesión aparece la fila del usuario.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings de TypeScript.
- [ ] `npm run dev` levanta la app y la consola del navegador no muestra errores.
- [ ] Las rutas `/`, `/juego/[id]`, `/jugar/[id]`, `/auth` y `/salon` cargan directamente por URL (no dependen de estado en memoria).
- [ ] La biblioteca muestra las 8 tarjetas; escribir en el buscador filtra por título; los chips filtran por categoría; sin resultados aparece el bloque "NO HAY RESULTADOS".
- [ ] Hacer clic en una tarjeta navega a `/juego/[id]` con el juego correcto.
- [ ] `/juego/no-existe` y `/jugar/no-existe` renderizan `app/not-found.tsx` (404), no un crash.
- [ ] El detalle muestra portada, tags, descripción larga, stat-strip y un leaderboard de 10 filas generado con `seededScores`.
- [ ] "JUGAR AHORA" en el detalle navega a `/jugar/[id]`.
- [ ] En el reproductor la puntuación sube sola; "PAUSA" la congela y muestra el overlay "EN PAUSA"; "FIN" abre el modal de game-over.
- [ ] En el modal, "GUARDAR PUNTUACIÓN" añade una entrada a `av_scores` en `localStorage` y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] En `/auth`, enviar el formulario guarda `av_user` en `localStorage`, redirige a `/`, y el `Nav` pasa a mostrar el nombre con `▾`.
- [ ] "JUGAR COMO INVITADO" entra sin usuario y redirige a `/`.
- [ ] El botón del usuario en el `Nav` cierra sesión (borra `av_user`) y vuelve a mostrar "Iniciar Sesión".
- [ ] La sesión persiste tras recargar la página (se rehidrata desde `av_user`).
- [ ] El Salón muestra podio + tabla por juego; cambiar de pestaña recalcula el ranking; con sesión aparece la fila "TU MEJOR MARCA".
- [ ] El `Nav` está en todas las rutas; el hamburger abre/cierra el panel móvil; el enlace activo se resalta según la ruta.
- [ ] `public/next.svg` y `public/vercel.svg` ya no existen.

---

## Decisiones

- **Sí:** rutas por archivos de App Router (`/`, `/juego/[id]`, `/jugar/[id]`, `/auth`, `/salon`). Es lo idiomático en Next 16, da URLs reales y navegación con `next/link`.
- **No:** replicar el hash-router de `app.jsx`. Rompía las convenciones de Next 16 y no aporta nada frente a rutas reales.
- **Sí:** shells Server Component + hojas `'use client'`. Las páginas leen datos mock en el servidor; solo la interactividad es cliente. Mejor rendimiento y menos JS.
- **No:** todo `'use client'`. Más cercano al template pero renuncia a las ventajas de Server Components sin motivo.
- **Sí:** persistir `av_user` y `av_scores` en `localStorage` vía `SessionProvider`. Mantiene el comportamiento del template (login persistente, guardado de score).
- **No:** sesión solo en memoria. Perdía el login al recargar, degradando fidelidad.
- **Sí:** mantener el simulador visual del reproductor (ticker, pausa, FIN). Es relleno decorativo, no un juego, y encaja con "solo visual".
- **No:** pantalla CRT estática. Más honesta pero mata la vida visual que tiene el template.
- **Sí:** `notFound()` + `app/not-found.tsx` arcade para ids inválidos. Idiomático y evita el crash que tenía el reproductor original.
- **No:** `redirect('/')` en id inválido. Oculta el error sin pantalla dedicada.
- **Sí:** datos y componentes en `lib/` y `components/` en la raíz (alias `@/*`). Convención estándar, separa datos/UI de las rutas.
- **No:** `app/_lib` / `app/_components`. Válido, pero mezcla infra con el árbol de rutas sin ganancia.
- **Sí:** escribir `av_scores` aunque ninguna pantalla lo lea. Fidelidad 1:1 con el template; su lectura queda para un spec futuro.
- **Nota:** los botones de OAuth (Google/GitHub) y las pestañas de auth son decorativos; no hay validación ni backend (definición rápida acordada en el bloque de preguntas).

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Hydration mismatch: el servidor renderiza `user: null` pero el cliente rehidrata `av_user` desde `localStorage`, y el `Nav` difiere entre SSR y cliente. | Leer `localStorage` en un `useEffect` tras el montaje (no en el render inicial); el `Nav` parte de "Iniciar Sesión" y se actualiza al hidratarse. Evita divergencia en el primer render. |
| `localStorage` no disponible (SSR, modo privado, o acceso antes del montaje). | Acceso siempre dentro de `useEffect`/handlers de cliente y envuelto en `try/catch` (como en `app.jsx`). La app funciona sin persistir si falla. |
| Efectos solo-cliente del reproductor (`setInterval`) y el tilt de `GameCard` (acceso a `getBoundingClientRect`) rompen en Server Components. | Ambos viven en componentes `'use client'`; los timers se limpian en el cleanup del `useEffect`. |

---

## Lo que **no** entra en este spec

- Juegos reales jugables (lógica/motor/canvas).
- Autenticación real y OAuth funcional.
- Backend, base de datos o API de puntuaciones.
- Lectura/visualización de `av_scores`.
- Tests automatizados e i18n.

Cada uno de estos, si llega, va en su propio spec.
