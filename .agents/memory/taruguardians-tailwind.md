---
name: TaruGuardians Tailwind v3 setup
description: This Vite app uses Tailwind CSS v3 (not v4). The @tailwindcss/vite plugin must NOT be used; use postcss instead.
---

## Rule
Remove `@tailwindcss/vite` from imports and plugins. Add a `css.postcss.plugins` block in `vite.config.ts` with `tailwindcss` and `autoprefixer`.

## Why
The app was imported using Tailwind v3 (`tailwind.config.js` + `postcss.config.js`). The scaffold defaults to `@tailwindcss/vite` (v4). Mixing them causes build failures.

## How to apply
```ts
// vite.config.ts
css: {
  postcss: {
    plugins: [
      (await import('tailwindcss')).default,
      (await import('autoprefixer')).default,
    ],
  },
},
```
Also install: `pnpm --filter @workspace/taruguardians add -D tailwindcss@3 postcss autoprefixer` (already done).
