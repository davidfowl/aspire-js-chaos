# Aspire JS Framework Chaos

A sample repo proving that Aspire can deploy **14 JavaScript framework configurations** using their officially recommended production runtime paths, validated with a weather API that each framework fetches and renders.

## Three Publish Methods

JavaScript frameworks fall into three deployment categories:

### 1. `publishAsStaticWebsite` — Static files served by YARP
Frameworks that build to a `dist/` folder of static files. No Node.js needed at runtime. YARP reverse-proxies API requests to the backend — no CORS, no URL discovery problem.

| Framework | Build Output | Verified With |
|-----------|-------------|---------------|
| **Vite** | `dist/` | Client-side fetch via `/api/weather` |
| **React** | `dist/` | Client-side fetch via `/api/weather` |
| **Vue** | `dist/` | Client-side fetch via `/api/weather` |
| **Angular** | `dist/` | Client-side fetch via `/api/weather` |
| **Astro** (static) | `dist/` | Client-side fetch via `/api/weather` |

### 2. `publishAsNodeServer` — Self-contained Node artifact
Frameworks that produce a standalone server. The runtime image contains only the built output — no `node_modules`, no package manager.

| Framework | Build Output | Runtime Command | Verified With |
|-----------|-------------|-----------------|---------------|
| **SvelteKit** | `build/` | `node build/index.js` | SSR weather via `+page.server.ts` loader |
| **TanStack Start** | `.output/` | `node .output/server/index.mjs` | SSR weather via `createServerFn` loader |
| **Next.js** | `.next/standalone/` | `node server.js` | SSR weather via async server component |

### 3. `publishAsNpmScript` — Needs `node_modules` at runtime
Frameworks where the built server imports unbundled packages from `node_modules`. The runtime image includes the full app + production dependencies.

| Framework | Why `node_modules`? | Verified With |
|-----------|---------------------|---------------|
| **Nuxt** | `useAsyncData`/`useFetch` needs the full Nitro environment | SSR weather via server API route + `useAsyncData` |
| **Astro SSR** | `entry.mjs` imports unbundled `@astrojs/internal-helpers` | SSR weather via frontmatter fetch |
| **Remix** | `react-router-serve` binary lives in `node_modules` | SSR weather via `loader()` function |
| **Qwik City** | Server entry imports unbundled Qwik packages | SSR weather via `routeLoader$` |

### Not yet deployable

| Framework | Status |
|-----------|--------|
| **SolidStart v2** | Alpha — h3 v2 + srvx has a Node URL parsing bug. Scaffolded and ready for when it stabilizes. |

## Key Patterns

### Static sites and API backends

`publishAsStaticWebsite` handles the API proxy in production via YARP:

```typescript
const api = await builder.addNodeApp('api', './api', 'server.js')
    .withHttpEndpoint({ port: 3001, env: 'PORT' });

await builder.addViteApp('frontend', './frontend')
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })
    .withExternalHttpEndpoints();
```

Browser calls `/api/weather` on the same origin → YARP proxies to backend → **no CORS, no URL discovery problem**.

### Dev mode proxy

In dev mode, each framework needs its own proxy config to forward `/api` requests to the backend. Aspire injects `API_HTTP` as an environment variable:

- **Vite/React/Vue**: `vite.config.ts` with `server.proxy` reading `process.env.API_HTTP`
- **Astro**: `astro.config.mjs` with `vite.server.proxy` reading `process.env.API_HTTP`
- **Angular**: `proxy.conf.js` reading `process.env.API_HTTP` (referenced in `angular.json`)

### SSR frameworks and `API_URL`

Server-side frameworks (Nuxt, SvelteKit, etc.) fetch weather data from the backend during SSR. They receive the backend URL via `process.env.API_URL`, injected by `.withEnvironment('API_URL', apiEndpoint)`.

## Lessons Learned

### Hello-world lies
Nuxt appeared to work as a self-contained artifact (`publishAsNodeServer`) because the hello-world didn't do server-side data fetching. Once we added `useAsyncData`, it broke. **Always validate with real server-side data fetching.**

### Framework-specific gotchas
- **Angular**: Uses Vite internally but dev proxy is configured via `proxy.conf.js`, not `vite.config.ts`. `addViteApp` works — injects `--port` into `ng serve` correctly.
- **Nuxt 4**: Pages under `app/pages/`, not root `pages/`. Uses `NUXT_` prefix for `runtimeConfig` env vars.
- **Astro SSR**: Must set `export const prerender = false`. Use `process.env` not `import.meta.env`.
- **SvelteKit**: Requires `@sveltejs/adapter-node`.
- **Next.js**: Requires `output: "standalone"`.
- **Qwik City**: Needs Node 20+ (Vite 7 requirement). Uses `routeLoader$` for SSR data loading.

## How to Run

```bash
# Start in dev mode
aspire run

# Deploy to Docker Compose
aspire deploy

# Tear down deployment
aspire do docker-compose-down-compose
```

## API Surface

Three methods, no special cases needed:

```typescript
// Static files + YARP API proxy
await app.publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })

// Self-contained Node server artifact
await app.publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })

// Needs node_modules at runtime
await app.publishAsNpmScript({ startScriptName: 'start' })
```
