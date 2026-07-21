# SPEC 04 — Conexión a Supabase (plumbing)

> **Estado:** Implementado
> **Depende de:** [SPEC 03 — About y Contacto con Resend](./03-about-y-contacto-resend.md) (Implemented)
> **Fecha:** 2026-07-20
> **Objetivo:** Dejar la conexión a Supabase lista (paquetes, variables de entorno y clientes server/browser/proxy) sin cambiar ningún comportamiento de la app.

## Por qué existe este spec

La app tiene auth y puntajes 100% simulados (`components/SessionProvider.tsx` sobre
`localStorage` y `seededScores()` en `lib/data.ts`). Antes de implementar auth o
un leaderboard reales necesitamos la plomería de Supabase instalada y verificada.
Este spec **solo** deja esa base lista; no reemplaza el mock ni migra datos.

Nota Next 16: el quickstart oficial de Supabase usa `middleware.ts`. En Next 16 ese
convenio está deprecado y renombrado a **`proxy.ts`** (archivo raíz que exporta
`proxy`). Este spec adapta el refresco de sesión a `proxy.ts`.

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Añadir variables de entorno de Supabase a `.env.local` y placeholders a `.env.example`.
- Crear `lib/supabase/server.ts` — cliente para Server Components / Route Handlers.
- Crear `lib/supabase/client.ts` — cliente para componentes `'use client'`.
- Crear `lib/supabase/proxy.ts` — helper `updateSession(request)` que refresca la
  sesión vía cookies.
- Crear `proxy.ts` en la raíz que invoca `updateSession` (convenio Next 16).
- Verificar que la conexión funciona (el cliente instancia y `getUser()` responde
  sin error) y que las rutas existentes siguen funcionando.

**Fuera de alcance (para specs futuros):**

- Autenticación real (registro/login, OAuth Google/GitHub, invitado). Sigue mock.
- Reemplazar `components/SessionProvider.tsx`.
- Mover puntajes / Salón de la Fama a tablas Supabase (RLS, esquema).
- Cualquier tabla, migración o query de datos (incluido el ejemplo `todos` del paste).
- Proteger rutas mediante `proxy` (el `proxy` solo refresca cookies, no redirige).

## Modelo de datos

Este spec **no introduce estructuras de datos nuevas**. No crea tablas ni tipos de
dominio. Solo añade clientes de conexión y variables de entorno:

```bash
# .env.local (gitignoreado)
NEXT_PUBLIC_SUPABASE_URL=https://cccffrzrmhltkscaegcj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ambas van con prefijo `NEXT_PUBLIC_` porque el cliente browser las necesita; la
publishable key de Supabase está diseñada para ser pública (la seguridad se apoya
en RLS, fuera de alcance aquí).

## Plan de implementación

> Antes de escribir código de proxy/config, consultar los docs locales de Next 16
> en `node_modules/next/dist/docs/01-app` (en especial `03-api-reference/03-file-conventions/proxy.md`).

1. Instalar dependencias: `npm install @supabase/supabase-js @supabase/ssr`.
   _Verificación:_ ambos aparecen en `package.json` y `package-lock.json`.

2. Añadir a `.env.local` las vars `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Añadir las mismas claves (con valores
   placeholder) a `.env.example`.
   _Verificación:_ `.env.local` tiene ambas vars; `.env.example` documenta ambas
   sin valores reales.

3. Crear `lib/supabase/server.ts`: `createClient(cookieStore)` con
   `createServerClient` de `@supabase/ssr`, leyendo las dos env vars, con
   `getAll`/`setAll` sobre el cookieStore (el `catch` de `setAll` es esperado en
   Server Components).
   _Verificación:_ `npm run build` no falla al importar el módulo.

4. Crear `lib/supabase/client.ts`: `createClient()` con `createBrowserClient`.
   _Verificación:_ importable desde un componente `'use client'` sin error de tipos.

5. Crear `lib/supabase/proxy.ts`: helper `updateSession(request: NextRequest)` que
   crea el server client sobre las cookies del request/response y llama a
   `supabase.auth.getUser()` para refrescar la sesión; devuelve el `NextResponse`.
   _Verificación:_ tipa sin errores.

6. Crear `proxy.ts` en la raíz: `export async function proxy(request)` que retorna
   `updateSession(request)`, con `export const config = { matcher: [...] }`
   excluyendo assets estáticos (`_next/static`, `_next/image`, `favicon.ico`, imágenes).
   _Verificación:_ `npm run dev` arranca y las rutas `/`, `/games`, `/hall-of-fame`,
   `/about`, `/auth` cargan igual que antes (sin regresiones).

7. Smoke test de conexión (temporal, se elimina al terminar): en un Server Component
   o Route Handler efímero, `const supabase = createClient(await cookies())` y
   `await supabase.auth.getUser()` — debe resolver sin lanzar (usuario null es OK).
   No requiere ninguna tabla.
   _Verificación:_ la llamada resuelve sin excepción; luego se borra el smoke test.

## Criterios de aceptación

- [x] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json`.
- [x] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [x] `.env.example` documenta ambas claves (sin valores reales).
- [x] Existen `lib/supabase/server.ts`, `lib/supabase/client.ts` y `lib/supabase/proxy.ts`.
- [x] Existe `proxy.ts` en la raíz que exporta `proxy` (no `middleware.ts`).
- [x] `npm run build` termina sin errores.
- [x] `npm run dev` arranca y `/`, `/games`, `/games/[id]`, `/hall-of-fame`, `/about`, `/auth` cargan sin errores en consola.
- [x] Una llamada a `supabase.auth.getUser()` desde el server resuelve sin lanzar.
- [x] `components/SessionProvider.tsx` y el resto del comportamiento siguen intactos (sin cambios).

## Decisiones

- **Sí:** helpers en `lib/supabase/`. Convención del repo (`lib/data.ts` ya vive ahí); no se crea `utils/`.
- **Sí:** `proxy.ts` en vez de `middleware.ts`. Next 16 deprecó `middleware`; usar el convenio actual evita warnings y futura rotura.
- **Sí:** nombres de env `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Coinciden con las claves que ya tiene el usuario (publishable key, no la legacy anon key).
- **No:** implementar auth o reemplazar el `SessionProvider` mock. Va en un spec 05+.
- **No:** crear tablas o aplicar el `page.tsx` de `todos` del paste. Es solo ilustrativo de los docs.
- **No:** usar `proxy` para proteger/redirigir rutas. Aquí solo refresca cookies de sesión.

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| El paste asume `middleware.ts`; en Next 16 rompe o avisa.                        | Usar `proxy.ts` + `export function proxy`, según docs locales de Next 16.                                                                 |
| Nota de Next 16: `proxy` no debe depender de "shared modules/globals".           | Importar solo el helper de creación de cliente (patrón estándar de Supabase); sin estado global compartido.                               |
| Secretos reales (`SUPABASE_DB_PASS`, Resend key) están en `.env` en texto plano. | `.env*` está gitignoreado; mover secretos a `.env.local` y dejar `.env.example` sin valores. `SUPABASE_DB_PASS` no lo usa el SDK cliente. |
| Vars ausentes en runtime → cliente lanza.                                        | `.env.example` documenta las claves; el smoke test (paso 7) detecta la conexión antes de cerrar el spec.                                  |

## Lo que **no** está en este spec

- Autenticación real (email/password, OAuth Google/GitHub, invitado).
- Reemplazo de `components/SessionProvider.tsx`.
- Leaderboard / Salón de la Fama con datos persistidos (tablas + RLS).
- Cualquier esquema, migración o query de datos.

Cada uno, si aterriza, va en su propio spec.
