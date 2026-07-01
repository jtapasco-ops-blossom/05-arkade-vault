# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: read the local Next.js docs first

This repo pins **Next.js 16.2.9** (with React 19.2.4), which has breaking changes vs. older Next.js you may know. Before writing any App Router, routing, config, or data-fetching code, read the relevant guide under `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`). Do not rely on training-data conventions.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config: `next/core-web-vitals` + `next/typescript`)

There is no test runner configured yet.

## Architecture

Next.js **App Router** project. Source lives in `app/` (currently the default scaffold: `layout.tsx`, `page.tsx`, `globals.css`). TypeScript is `strict`; the `@/*` path alias maps to the repo root.

**Styling**: Tailwind CSS **v4** via `@tailwindcss/postcss` — there is **no `tailwind.config.js`**. Theme tokens are declared in CSS with `@theme inline` inside `app/globals.css`. Tailwind is imported with `@import "tailwindcss"`.

### `templates/` — the source of truth for the UI

The product's actual design is prototyped in `templates/` as standalone **browser-global JSX** (each file ends with `window.ComponentName = ...`, no ES modules/JSX build) plus a large hand-written `templates/styles.css` and `Arcade Vault.html` harness. These are the **design reference to port into real App Router pages/components** — they are not wired into the Next.js app. Screens present (Spanish domain UI):

- `nav.jsx` — top nav + mobile menu
- `auth.jsx` — sign-in
- `biblioteca.jsx` — game library (home)
- `detalle.jsx` — game detail
- `reproductor.jsx` — game player
- `salon.jsx` — "Salón de la Fama" (leaderboard/hall of fame)
- `data.jsx`, `app.jsx` — mock data + client-side router/shell

When implementing a screen, mirror the corresponding template's markup, class names, and the neon/arcade visual language in `templates/styles.css`, adapting the browser-global components into real React/TypeScript modules under `app/`.

## Workflow

This project follows **Spec Driven Design** using the `/spec` and `/spec-impl` skills (from `Klerith/fernando-skills`, installed via `npx skills@latest add Klerith/fernando-skills`). Draft/confirm a spec before implementing.
