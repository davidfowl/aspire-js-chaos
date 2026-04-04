# Aspire JS Framework Chaos — Deployment Investigation

A sample repo proving that Aspire can deploy 10 JavaScript framework configurations using their **officially recommended** production runtime paths, validated with a weather API that each framework fetches and renders.

## Conclusion: Three Publish Methods

After reviewing each framework's official deployment docs, GitHub samples, and Dockerfiles — then validating with real server-side data fetching (not just hello-world scaffolds) — JavaScript frameworks fall into three categories:

### 1. `publishAsStaticWebsite` — Static files served by Caddy
Frameworks that build to a `dist/` folder of static files. No Node.js needed at runtime. Optionally proxies a single API path to a backend via Caddy reverse proxy (no CORS, no URL discovery problem).

| Framework | Build Output | Verified With | Docs |
|-----------|-------------|---------------|------|
| **Vite** | `dist/` | Client-side fetch via `/api/weather` Caddy proxy | [Static Deploy](https://vite.dev/guide/static-deploy.html) · [`vite preview` is not for production](https://vite.dev/guide/cli.html#vite-preview) |
| **React** | `dist/` | Client-side fetch via `/api/weather` Caddy proxy | Vite-based |
| **Vue** | `dist/` | Client-side fetch via `/api/weather` Caddy proxy | Vite-based |
| **Astro** (static) | `dist/` | Static page (no JS fetch by default) | [Deploy](https://docs.astro.build/en/guides/deploy/) · [`astro preview` is not for production](https://docs.astro.build/en/reference/cli-reference/#astro-preview) |

### 2. `publishAsNodeServer` — Self-contained Node artifact
Frameworks that produce a standalone server. The runtime image contains only the built output — no `node_modules`, no package manager.

| Framework | Build Output | Runtime Command | Verified With | Docs |
|-----------|-------------|-----------------|---------------|------|
| **SvelteKit** | `build/` | `node build/index.js` | SSR weather in HTML via `+page.server.ts` loader | [adapter-node](https://svelte.dev/docs/kit/adapter-node) |
| **TanStack Start** | `.output/` | `node .output/server/index.mjs` | SSR weather in HTML via `createServerFn` loader | [Deployment](https://tanstack.com/start/latest/docs/framework/react/deployment) · [Nitro](https://nitro.build/deploy/runtimes/node) |
| **Next.js** | `.next/standalone/` | `node server.js` | SSR weather in HTML via async server component | [with-docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) · [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) |

**Config requirements:**
- SvelteKit: install `@sveltejs/adapter-node`, update `svelte.config.js`
- Next.js: set `output: "standalone"` in `next.config.ts`
- TanStack Start: none (Nitro node-server preset is the default)

### 3. `publishAsNpmScript` — Needs `node_modules` at runtime
Frameworks where the built server imports unbundled packages from `node_modules`. The runtime image includes the full app + production dependencies.

| Framework | Runtime Command | Why `node_modules`? | Verified With | Docs |
|-----------|----------------|---------------------|---------------|------|
| **Nuxt** | `node .output/server/index.mjs` | `useAsyncData`/`useFetch` needs the full Nitro environment — hello-world works standalone but server-side data fetching breaks without it | SSR weather via server API route + `useAsyncData` | [Deployment](https://nuxt.com/docs/getting-started/deployment) |
| **Astro SSR** | `node ./dist/server/entry.mjs` | `entry.mjs` imports unbundled `@astrojs/internal-helpers` | SSR weather via frontmatter fetch (`prerender=false`) | [Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/) · [Docker recipe](https://docs.astro.build/en/recipes/docker/) |
| **Remix** | `react-router-serve ./build/server/index.js` | `react-router-serve` binary lives in `node_modules` | SSR weather via `loader()` function | [node-custom-server Dockerfile](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server) |

## Lessons Learned During Validation

### Hello-world lies
Our initial categorization based on scaffold apps was wrong. Nuxt appeared to work as a self-contained artifact (`publishAsNodeServer`) because the hello-world didn't do server-side data fetching. Once we added `useAsyncData` calling a backend API, it broke — Nuxt needs the full Nitro environment with `node_modules` at runtime.

**Rule: always validate publish methods with real server-side data fetching, not just page loads.**

### Framework-specific gotchas discovered
- **Nuxt 4**: Pages must be under `app/pages/`, not root `pages/`. Uses `NUXT_` prefix for `runtimeConfig` env vars.
- **Astro SSR**: Must set `export const prerender = false` — default pre-renders at build time. Use `process.env` not `import.meta.env` (which is build-time).
- **SvelteKit**: Requires `@sveltejs/adapter-node` — `adapter-auto` doesn't produce a deployable Node artifact.
- **Next.js**: Requires `output: "standalone"` — without it, `node_modules` are needed at runtime.

### Static sites and API backends
Most SPAs call one backend API. `publishAsStaticWebsite` solves this with an optional Caddy reverse proxy:

```typescript
const api = await builder.addNodeApp('api', './api', 'server.js')
    .withHttpEndpoint({ port: 3001, env: 'PORT' });

await builder.addViteApp('frontend', './frontend')
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })
    .withExternalHttpEndpoints();
```

Browser calls `/api/weather` on the same origin → Caddy proxies to backend → **no CORS, no URL discovery problem**.

For more complex routing (multiple backends, auth, BFF), use YARP with `PublishWithStaticFiles`.

### SPA fallback
`publishAsStaticWebsite` enables SPA fallback by default (`spaFallback: true`), rewriting unknown routes to `/index.html`. This is what React/Vue/Angular SPAs need for client-side routing. Disable for multi-page static sites like Astro:

```typescript
app.publishAsStaticWebsite({ spaFallback: false })
```

### No `vite preview` in production
Our earlier POC used `npm run preview` for Nuxt, SvelteKit, and TanStack Start. The framework docs are clear: preview servers are **not production servers**. The updated sample uses each framework's recommended built artifact or start command.

### User permissions
Self-contained Node artifacts (bucket 2) run as `USER node` (non-root). Frameworks needing `node_modules` (bucket 3) run as root because npm may need write access. The earlier POC's `USER root` hack for `vite preview` (writing to `node_modules/.vite-temp`) goes away with correct production runtimes.

## How to Run

```bash
# Start in dev mode
aspire run

# Deploy to Docker Compose
aspire deploy
```

## API Surface

Three methods, no special cases needed:

```typescript
// Static files + optional API proxy
await app.publishAsStaticWebsite()
await app.publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })

// Self-contained Node server artifact
await app.publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })

// Needs node_modules at runtime
await app.publishAsNpmScript({ startScriptName: 'start' })
```

The `publishAsNextStandalone()` helper is a convenience for Next.js's unique copy shape (`.next/standalone` + `.next/static` + `public`), but conceptually it's the same as `publishAsNodeServer`.

For full documentation — including framework-specific gotchas, generated Dockerfile shapes, the decision tree for choosing a method, and how these relate to Aspire's existing deployment models — see **[docs/publishing-javascript-apps.md](docs/publishing-javascript-apps.md)**.
