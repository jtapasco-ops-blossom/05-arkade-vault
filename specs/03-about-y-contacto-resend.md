# SPEC 03 — Página "Acerca de" y envío de correo con Resend

> **Estado:** Implemented
> **Depende de:** [02-landing-y-rutas-games](02-landing-y-rutas-games.md) (Implemented)
> **Fecha:** 2026-07-14
> **Objetivo:** Portar `references/home-about/about.jsx` 1:1 a una ruta `/about` y conectar su formulario de contacto a un envío de correo real vía Resend a través de un Route Handler en el servidor, con rate limiting local.

---

Este spec **revierte** explícitamente la decisión del spec 02 (que excluía la página "Acerca de" y quitaba su enlace del nav).

## Alcance

**Dentro:**

- Nueva ruta **`/about`** (Server Component en `app/about/page.tsx`) que renderiza `<About />`.
- **`components/About.tsx`** (`'use client'`) portando `references/home-about/about.jsx` 1:1: sección ABOUT (hero, misión, `highlight-row` con 3 tarjetas + iconos pixel), banner divisor animado, sección CONTACTO (intro con tips + formulario), animación `reveal` on-scroll (IntersectionObserver), shake en campos vacíos y la terminal de éxito (`terminal-success`).
- Portar el CSS de About desde `references/home-about/styles.css` a `app/globals.css` (`about`, `about-hero`, `about-title`, `about-mission`, `highlight-row`/`highlight`/`hl-*`, `about-divider`/`div-*`, `about-contact`/`contact-grid`/`contact-intro`/`contact-tips`/`tip`, `contact-form`, `terminal-success`/`term-*`/`line`/`caret`, y las reglas de `field`/`textarea` que aún falten).
- **Envío de correo real** con Resend:
  - Route Handler **`app/api/contact/route.ts`** (`POST`) que valida el payload, aplica rate limiting, llama a Resend desde el servidor y responde `{ ok: true }` o error.
  - `About.tsx` hace `fetch('/api/contact', ...)` en `onSubmit`; mantiene el look de la plantilla y añade estado **cargando** (`▶ ENVIANDO…`, botón deshabilitado) y estado **error** (terminal en rojo/magenta: `[ERROR] NO SE PUDO ENVIAR — INTENTA DE NUEVO` + botón reintentar).
  - Destinatario: `jtapascohenao@gmail.com` (correo con el que está registrada la cuenta Resend; el sandbox solo entrega a esa dirección). Remitente: `onboarding@resend.dev` (sandbox de Resend).
- **Rate limiting local** en el Route Handler: máximo **5 envíos por ventana de 10 minutos por IP** (`Map` en memoria). Al superarlo responde `429` sin llamar a Resend.
- Dependencia **`resend`** en `package.json`.
- Config de entorno: `RESEND_API_KEY` en `.env.local` (no versionado) y un `.env.example` versionado como plantilla.
- **Nav:** reañadir enlace "Acerca de" → `/about` (desktop + panel móvil), activo en `/about`.

**Fuera de alcance:**

- Persistir los mensajes (base de datos, log, dashboard): solo se envía el correo, no se guarda nada.
- Rate limiting distribuido/persistente (Redis, DB), captcha o verificación de humanidad: solo el límite local en memoria descrito arriba.
- Verificar un dominio propio en Resend / plantillas HTML enriquecidas del correo: se usa el sandbox `onboarding@resend.dev` y un cuerpo de correo simple (texto/HTML mínimo).
- Autoresponder al remitente del formulario (solo llega el mensaje al equipo).
- Cualquier cambio en las demás pantallas (landing, games, salón, auth) más allá del enlace del nav.
- i18n, tests unitarios, y todo lo ya excluido en specs 01 y 02.

---

## Modelo de datos

**No se introducen estructuras persistentes ni se toca `localStorage`.** El único dato nuevo es el contrato del endpoint de contacto (en memoria, por request):

**Payload de la petición** (`POST /api/contact`, JSON):

```ts
{
  name: string; // no vacío tras trim
  email: string; // no vacío tras trim, formato email
  msg: string; // no vacío tras trim
}
```

**Respuesta:**

```ts
// 200 OK
{ ok: true }

// 400 (payload inválido) | 429 (rate limit superado) | 500 (fallo de Resend/servidor)
{ ok: false, error: string }
```

**Estado del formulario en `About.tsx`** (cliente, no persistido):

- `form: { name, email, msg }` — igual que la plantilla.
- `status: 'idle' | 'sending' | 'sent' | 'error'` — reemplaza al `sent` booleano de la plantilla para cubrir los cuatro estados (idle, cargando, éxito, error).
- `shake: boolean` — igual que la plantilla (validación de campos vacíos en cliente antes de enviar).

**Rate limiting (servidor, en memoria):**

- `Map<string, number[]>` indexado por IP (de `x-forwarded-for`), guardando timestamps de envíos dentro de la ventana de 10 min. Máximo 5 por ventana.

**Config de entorno:**

- `RESEND_API_KEY` — leída solo en el servidor (`process.env`), nunca expuesta al cliente.

---

## Plan de implementación

Cada paso deja la app compilando (`npm run build`) y navegable. Antes de tocar el Route Handler, consultar los docs locales de Next 16 en `node_modules/next/dist/docs/01-app` (Route Handlers y `app/api`).

1. **Dependencia + entorno.** Instalar `resend` (`npm install resend`). Crear `.env.example` versionado con `RESEND_API_KEY=` y añadir `RESEND_API_KEY=<key real>` a `.env.local` (verificar que `.env.local` esté en `.gitignore`). _Verificación:_ `resend` aparece en `package.json`; `.env.local` no se versiona.

2. **CSS de About.** Portar a `app/globals.css` las reglas de About ausentes desde `references/home-about/styles.css` (`about`/`about-hero`/`about-title`/`about-mission`, `highlight-row`/`highlight`/`hl-icon`/`hl-text`, `about-divider`/`div-bar`/`div-pixels`, `about-contact`/`contact-grid`/`contact-intro`/`contact-tips`/`tip`/`tip-led`, `contact-form`(+`::before`/`.shake`)/`textarea`, `terminal-success`/`term-bar`/`dot`/`term-title`/`term-body`/`line`/`prompt`/`success`/`caret`, y las de `field` que falten). Reutilizar tokens de color ya existentes. _Verificación:_ `npm run build` compila; las clases existen en el bundle.

3. **Route Handler `/api/contact`.** Crear `app/api/contact/route.ts` con `POST`: lee la IP de `x-forwarded-for` y aplica el rate limiting (5 envíos / 10 min por IP con un `Map` en memoria); si se supera responde `429 { ok:false, error }`. Parsea JSON y valida `name`/`email`/`msg` (no vacíos, email con formato); si es inválido responde `400 { ok:false, error }`. Instancia Resend con `process.env.RESEND_API_KEY` y envía `from: 'onboarding@resend.dev'`, `to: 'jtapascohenao@gmail.com'`, `subject` y cuerpo con nombre/email/mensaje; en fallo responde `500 { ok:false, error }`, en éxito `200 { ok:true }`. Anotar `// lazy:` que el `Map` es en memoria (se reinicia con el servidor, no cubre multi-instancia). _Verificación:_ `curl -X POST localhost:3000/api/contact` con payload válido devuelve `{ok:true}` y llega el correo; payload vacío devuelve `400`; a partir del 6.º envío en 10 min devuelve `429`.

4. **Componente `About`.** Crear `components/About.tsx` (`'use client'`) portando `about.jsx` 1:1 (hero, highlights + `HighlightIcon`, divisor, contacto). Sustituir el `sent` booleano por `status`; `onSubmit`: valida campos (shake si vacío), pone `status='sending'`, hace `fetch('/api/contact')`, y según respuesta pasa a `'sent'` o `'error'` (mensaje específico si el status HTTP es `429`). Botón: `▶ ENVIAR MENSAJE` (idle) / `▶ ENVIANDO…` deshabilitado (sending). Estado `sent` = terminal verde de la plantilla; estado `error` = terminal en rojo/magenta con `[ERROR] NO SE PUDO ENVIAR — INTENTA DE NUEVO` (o `[LÍMITE] DEMASIADOS MENSAJES — ESPERA UNOS MINUTOS` en `429`) + botón reintentar. Mantener el `useEffect` del IntersectionObserver (`reveal`). _Verificación:_ el componente monta sin errores de hidratación en consola.

5. **Ruta `/about`.** Crear `app/about/page.tsx` (Server Component) que renderiza `<About />`. _Verificación:_ `/about` muestra la página completa con las animaciones de scroll.

6. **Nav.** Añadir "Acerca de" → `/about` en desktop y en el panel móvil; extender `isActive` con `about` (activo cuando `pathname.startsWith('/about')`). _Verificación:_ el enlace aparece en ambos y se resalta solo en `/about`.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings de TypeScript.
- [ ] `npm run dev` levanta la app y la consola del navegador no muestra errores ni warnings de hidratación en `/about`.
- [ ] `/about` muestra todas las secciones portadas 1:1: hero (`about-hero`) con kicker, título y misión; `highlight-row` con 3 tarjetas (cada una con su icono pixel y color cyan/magenta/green); banner divisor (`about-divider`); sección CONTACTO con intro, 3 tips y formulario.
- [ ] Al hacer scroll, las secciones con `.reveal` reciben la clase `.in` (IntersectionObserver).
- [ ] Enviar el formulario con algún campo vacío **no** dispara petición: aplica la animación `shake` y no cambia de estado.
- [ ] Con los 3 campos llenos, al enviar el botón muestra `▶ ENVIANDO…` deshabilitado mientras espera la respuesta.
- [ ] Con envío exitoso aparece la terminal verde (`terminal-success`) con el mensaje que incluye el nombre en mayúsculas y el botón "ENVIAR OTRO MENSAJE" resetea el formulario a `idle`.
- [ ] Un envío exitoso hace llegar el correo a `jtapascohenao@gmail.com` con remitente `onboarding@resend.dev` y el nombre, email y mensaje del formulario en el cuerpo.
- [ ] Si el servidor/Resend falla, aparece la terminal de error (rojo/magenta) con `[ERROR] NO SE PUDO ENVIAR — INTENTA DE NUEVO` y un botón para reintentar que vuelve al formulario.
- [ ] A partir del 6.º envío en menos de 10 min desde la misma IP, `/api/contact` responde `429` y la UI muestra el mensaje de límite (`[LÍMITE] DEMASIADOS MENSAJES — ESPERA UNOS MINUTOS`); no se llama a Resend en ese caso.
- [ ] `POST /api/contact` con payload válido responde `200 { ok: true }`; con cualquier campo vacío o email inválido responde `400 { ok: false, error }`; nunca expone `RESEND_API_KEY` en la respuesta ni en el cliente.
- [ ] Existe `.env.example` versionado con `RESEND_API_KEY=`; `.env.local` contiene la key real y **no** está versionado.
- [ ] `resend` figura en las `dependencies` de `package.json`.
- [ ] El `Nav` muestra "Acerca de" → `/about` en desktop y en el panel móvil, resaltado solo en `/about`.

---

## Decisiones

- **Sí:** envío desde un **Route Handler** (`app/api/contact/route.ts`) que llama a Resend en el servidor. La `RESEND_API_KEY` nunca puede tocar el cliente; un endpoint propio es la única forma segura.
- **No:** llamar a Resend directamente desde el componente cliente. Expondría la API key en el bundle del navegador — inaceptable.
- **Sí:** remitente `onboarding@resend.dev` (sandbox de Resend). Funciona sin verificar dominio y es suficiente para el MVP; el destinatario es el correo del propio usuario.
- **No:** verificar un dominio propio y usar `contacto@dominio.com`. Añade fricción de infraestructura que el prototipo no necesita todavía.
- **Sí:** reemplazar el `sent` booleano de la plantilla por un `status` de 4 valores (`idle`/`sending`/`sent`/`error`). El envío real introduce carga y fallo, estados que el booleano original no puede representar.
- **No:** mantener solo éxito/shake como la plantilla. Dejaría al usuario sin feedback durante la espera y sin salida si Resend falla.
- **Sí:** rate limiting local en memoria (5 / 10 min por IP). Evita abuso básico del endpoint sin introducir dependencias ni infraestructura; suficiente para un prototipo.
- **No:** rate limiting con Redis/DB o captcha. Sobredimensionado para el MVP; se puede escalar en un spec posterior si aparece abuso real.
- **Sí:** reañadir "Acerca de" al nav y crear `/about`, revirtiendo el spec 02. Decisión explícita del usuario en esta iteración.
- **Sí:** ruta en inglés `/about`, coherente con `/games` y `/hall-of-fame` del spec 02 (la UI sigue en español).
- **No:** persistir los mensajes. Fuera del objetivo (solo enviar el correo).
- **Sí:** cuerpo de correo simple con nombre/email/mensaje. Fidelidad al contenido del formulario sin invertir en plantillas HTML que nadie ha pedido.

---

## Riesgos

| Riesgo                                                                                                                                                       | Mitigación                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` filtrada al cliente o al repositorio.                                                                                                       | La key se lee solo en el Route Handler (`process.env`, servidor); `.env.local` está en `.gitignore`; solo se versiona `.env.example` con el valor vacío.                                                                                                                                            |
| El sandbox `onboarding@resend.dev` solo entrega a la dirección/correo verificado de la cuenta Resend; a otros destinatarios el envío puede rechazarse (403). | El destinatario es `jtapascohenao@gmail.com`, el correo con el que está registrada la cuenta Resend (verificado durante la implementación: enviar a `jtapasco@blossom.technology` daba 403). Para recibir en otra dirección hay que verificar un dominio en resend.com/domains y cambiar el `from`. |
| El rate limiting en memoria se reinicia con el servidor y no cubre despliegues multi-instancia (cada instancia cuenta por separado).                         | Aceptado para el prototipo y anotado con `// lazy:`; si se escala, migrar a un store compartido (Redis) en un spec posterior.                                                                                                                                                                       |
| Hydration mismatch en `About`: el `useEffect` del IntersectionObserver o el render difieren entre SSR y cliente.                                             | El observer corre en `useEffect` tras el montaje; el estado inicial (`status='idle'`, `.reveal` sin `.in`) es idéntico en servidor y cliente.                                                                                                                                                       |
| El usuario queda sin feedback si la petición se cuelga o Resend tarda/da error.                                                                              | Estado `sending` (botón deshabilitado) durante la espera y estado `error` con mensaje + botón de reintento ante cualquier fallo de red o `4xx/5xx`.                                                                                                                                                 |
| Colisión de clases CSS al portar las reglas de About a `globals.css` (nombres o `field`/`textarea` ya presentes).                                            | Portar solo las reglas ausentes (verificado: 0 coincidencias de About hoy); reutilizar tokens de color ya definidos en vez de redeclararlos.                                                                                                                                                        |
