---
title: Publish JavaScript apps
description: Learn how to publish JavaScript applications with Aspire, including static websites with API proxies, Node.js server applications, and framework-specific deployment patterns.
---

# Publish JavaScript apps

When you publish a JavaScript application with Aspire, the framework generates a production-ready container image. The shape of that container depends on how your framework produces its build output. There is no single "generic JavaScript runtime" — instead, you choose the publish method that matches your framework's recommended deployment model.

## Publish methods

Aspire provides three built-in publish methods for JavaScript applications:

| Method | Use when | Runtime image contains |
|--------|----------|----------------------|
| `PublishAsStaticWebsite` | Your app builds to static HTML/CSS/JS files | Caddy file server + `dist/` |
| `PublishAsNodeServer` | Your build produces a self-contained Node.js server | Node.js + built artifact only |
| `PublishAsNpmScript` | Your server entry point imports packages from `node_modules` at runtime | Node.js + built output + production `node_modules` |

## Publish as static website

Use `PublishAsStaticWebsite` for frameworks that compile to static files during `npm run build`. The resulting container serves the files using [Caddy](https://caddyserver.com), a lightweight HTTP server.

This is the right choice for:

- **Vite** apps (React, Vue, vanilla)
- **Astro** in default static mode
- Any SPA or static site generator that outputs to `dist/`

### Basic usage

```csharp
var frontend = builder.AddViteApp("frontend", "./frontend")
    .PublishAsStaticWebsite();
```

```typescript
const frontend = builder
    .addViteApp('frontend', './frontend')
    .publishAsStaticWebsite();
```

### With API proxy

Static sites that call a backend API face two deployment problems:

1. **CORS** — the browser is on a different origin than the API
2. **Backend URL discovery** — `VITE_*` variables are baked at build time, but the API URL isn't known until deploy time

`PublishAsStaticWebsite` solves both by optionally adding a reverse proxy route to Caddy. Requests matching the path prefix are proxied to the backend — same origin, no CORS, no URL discovery needed:

```csharp
var api = builder.AddNodeApp("api", "./api", "server.js")
    .WithHttpEndpoint(port: 3001, env: "PORT");

var frontend = builder.AddViteApp("frontend", "./frontend")
    .PublishAsStaticWebsite(
        apiPath: "/api",
        apiTarget: api.GetEndpoint("http"))
    .WithExternalHttpEndpoints();
```

```typescript
const api = builder.addNodeApp('api', './api', 'server.js')
    .withHttpEndpoint({ port: 3001, env: 'PORT' });

const frontend = builder
    .addViteApp('frontend', './frontend')
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: await api.getEndpoint('http') })
    .withExternalHttpEndpoints();
```

The browser calls `/api/hello` on the same origin. Caddy proxies it to the backend. No CORS configuration needed.

For more complex routing (multiple backends, path transforms, auth, BFF patterns), use YARP with `PublishWithStaticFiles` instead. See [Deploy JavaScript apps](https://aspire.dev/deployment/javascript-apps/) for the full deployment models.

### SPA fallback

By default, `PublishAsStaticWebsite` enables SPA fallback routing — unknown paths are rewritten to `/index.html`. This is what React, Vue, and Angular SPAs need for client-side routing — without it, refreshing on `/dashboard` returns a 404.

To disable SPA fallback for multi-page static sites:

```csharp
builder.AddViteApp("docs", "./docs-site")
    .PublishAsStaticWebsite(spaFallback: false);
```

## Publish as Node server

Use `PublishAsNodeServer` for frameworks that produce a self-contained Node.js server artifact during the build. The resulting container runs the built entry point directly with `node` — no package manager, no `node_modules` required at runtime.

This is the right choice for:

- **SvelteKit** with [`adapter-node`](https://svelte.dev/docs/kit/adapter-node) — builds to `build/index.js`
- **TanStack Start** — builds to `.output/server/index.mjs` via [Nitro](https://nitro.build/deploy/runtimes/node)
- **Next.js** with [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) — builds to `.next/standalone/server.js`

### Usage

```csharp
// SvelteKit
builder.AddViteApp("svelte-app", "./svelte-app")
    .PublishAsNodeServer(
        entryPoint: "build/index.js",
        outputPath: "build");

// TanStack Start
builder.AddViteApp("tanstack-app", "./tanstack-app")
    .PublishAsNodeServer(
        entryPoint: ".output/server/index.mjs",
        outputPath: ".output");
```

```typescript
// SvelteKit
builder
    .addViteApp('svelte-app', './svelte-app')
    .publishAsNodeServer('build/index.js', { outputPath: 'build' });

// TanStack Start
builder
    .addViteApp('tanstack-app', './tanstack-app')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' });
```

> [!TIP]
> For **Next.js**, the standalone output bundles all dependencies into the server, so no `node_modules` are needed at runtime. See the [official Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker). The Next.js standalone has a unique copy shape (`.next/standalone` + `.next/static` + `public`) — use the `PublishAsNextStandalone` convenience helper.

## Publish as npm script

Use `PublishAsNpmScript` for frameworks where the production server depends on packages in `node_modules` at runtime. The resulting container includes the full application alongside the built output.

This is the right choice for:

- **Nuxt** — `useAsyncData`/`useFetch` needs the full Nitro environment with `node_modules` at runtime. See the [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment).
- **Remix / React Router** — `react-router-serve` is an npm package, not a standalone binary. See the [official Dockerfile](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server).
- **Astro SSR** with [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/) — the built `entry.mjs` imports unbundled `@astrojs/*` packages. See the [official Docker recipe](https://docs.astro.build/en/recipes/docker/).

### Usage

```csharp
// Nuxt
builder.AddViteApp("nuxt-app", "./nuxt-app")
    .PublishAsNpmScript(startScriptName: "start");

// Remix
builder.AddViteApp("remix-app", "./remix-app")
    .PublishAsNpmScript(
        startScriptName: "start",
        runScriptArguments: "-- --port \"$PORT\"");
```

```typescript
// Nuxt
builder
    .addViteApp('nuxt-app', './nuxt-app')
    .publishAsNpmScript({ startScriptName: 'start' });

// Remix
builder
    .addViteApp('remix-app', './remix-app')
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' });
```

> [!NOTE]
> Unlike `PublishAsNodeServer`, this method copies the entire application directory (including `node_modules`) into the runtime image. This results in a larger image but is required when the server entry point imports packages that aren't bundled into the build output.

> [!WARNING]
> **Nuxt appears to work with `PublishAsNodeServer` in a hello-world scaffold**, because the Nitro build bundles server code into a standalone `.output/`. But once your Nuxt app does server-side data fetching with `useAsyncData` or `useFetch`, it breaks without the full `node_modules` at runtime. Always use `PublishAsNpmScript` for Nuxt.

## Framework-specific gotchas

These are issues discovered during real deployment validation — not in the framework docs, and not visible with hello-world apps.

### Nuxt

- **Directory structure**: Nuxt 4 uses `app/pages/` for pages, not a root `pages/` directory. If your page isn't rendering, check that it's in the right location.
- **Environment variables**: Nuxt maps `runtimeConfig` keys to env vars with a `NUXT_` prefix. To pass `apiUrl` at runtime, set `NUXT_API_URL` in the container — not `API_URL`.
- **Server API routes**: The recommended pattern for calling external APIs from Nuxt is a [server API route](https://nuxt.com/docs/guide/directory-structure/server) (`server/api/weather.ts`) that uses `useRuntimeConfig()`, consumed by the page via `useAsyncData('/api/weather')`.
- **Publish method**: Use `PublishAsNpmScript`, not `PublishAsNodeServer`. The Nitro bundle appears self-contained, but server-side data fetching (`useAsyncData`, `useFetch`) fails without the full environment.

### Astro SSR

- **Pre-rendering**: Astro pre-renders pages at build time by default, even with the Node adapter. Add `export const prerender = false` to any page that needs to run at request time (e.g., fetching data from an API).
- **Environment variables**: Use `process.env.API_URL`, not `import.meta.env.API_URL`. `import.meta.env` values are resolved at build time and baked into the output.
- **Runtime dependencies**: The built `entry.mjs` imports from unbundled packages like `@astrojs/internal-helpers`. Use `PublishAsNpmScript` — the [official Docker recipe](https://docs.astro.build/en/recipes/docker/#multi-stage-build-using-ssr) confirms `node_modules` must be copied into the runtime image.

### SvelteKit

- **Adapter**: The default `@sveltejs/adapter-auto` does not produce a deployable Node.js artifact. Install `@sveltejs/adapter-node` and update `svelte.config.js`:
  ```js
  import adapter from '@sveltejs/adapter-node';
  export default { kit: { adapter: adapter() } };
  ```
- **Server-side data**: Use `+page.server.ts` with a `load` function for server-side fetching. The `API_URL` env var is available via `process.env` in the load function.
- **Output shape**: The `build/` directory contains everything needed — no `node_modules` required at runtime.

### Next.js

- **Standalone output**: Set `output: "standalone"` in `next.config.ts`. Without this, the build output requires `node_modules` at runtime.
- **Copy shape**: The standalone build produces three directories that must be copied separately: `.next/standalone/` (server + bundled deps), `.next/static/` (client assets), and `public/` (static files). See the [official with-docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker).
- **Server components**: Default App Router components are server components. Use `async` functions directly in the component body to fetch data — no special loader pattern needed.
- **Binding**: Set `HOSTNAME=0.0.0.0` for the standalone server to accept external connections in a container.

### TanStack Start

- **Nitro preset**: Uses Nitro with the `node-server` preset by default. The `.output/server/index.mjs` entry point is self-contained.
- **Server functions**: Use `createServerFn` for server-side data fetching in route loaders.
- **Environment variables**: `process.env.API_URL` is available at runtime in server functions.

### Remix / React Router

- **Server binary**: `react-router-serve` lives in `node_modules` — it's not bundled into the build output. This is why Remix needs `PublishAsNpmScript`.
- **Port binding**: Pass `-- --port "$PORT"` as `runScriptArguments` so the server listens on Aspire's assigned port.
- **Route structure**: The default route file may be at `app/routes/home.tsx`, not `app/routes/index.tsx`. Check your route configuration.

### Vite / React / Vue (static)

- **Preview is not production**: Both [Vite](https://vite.dev/guide/cli.html#vite-preview) and framework docs explicitly state that `vite preview` is not a production server. Always use `PublishAsStaticWebsite` with Caddy.
- **API calls**: Use the `apiPath`/`apiTarget` option on `PublishAsStaticWebsite` to proxy API calls through Caddy. Do not use `VITE_*` env vars for runtime API URLs — they are baked at build time.

## How to choose the right method

1. **Does your framework build to static HTML/CSS/JS files?**
   - Yes → `PublishAsStaticWebsite`
   - Does it call a backend API? → Add `apiPath` and `apiTarget`
   - Need complex routing? → Use YARP with `PublishWithStaticFiles`

2. **Does your framework produce a self-contained server artifact?**
   - Test: Can you run `node <entry-point>` in an empty directory with just the build output, **and** do server-side data fetching successfully?
   - Yes → `PublishAsNodeServer`

3. **Does the built server import packages from `node_modules`, or does server-side data fetching fail without them?**
   - Yes → `PublishAsNpmScript`

### Quick reference

| Framework | Method | Entry point | Config required |
|-----------|--------|-------------|-----------------|
| Vite / React / Vue | `PublishAsStaticWebsite` | N/A (Caddy) | None |
| Astro (static) | `PublishAsStaticWebsite` | N/A (Caddy) | None |
| SvelteKit | `PublishAsNodeServer` | `build/index.js` | `@sveltejs/adapter-node` |
| TanStack Start | `PublishAsNodeServer` | `.output/server/index.mjs` | None |
| Next.js | `PublishAsNodeServer` | `server.js` | `output: "standalone"` |
| Nuxt | `PublishAsNpmScript` | `node .output/server/index.mjs` | `NUXT_` env prefix |
| Astro SSR | `PublishAsNpmScript` | `node ./dist/server/entry.mjs` | `@astrojs/node`, `prerender: false` |
| Remix | `PublishAsNpmScript` | `react-router-serve` | None |

## Relationship to existing deployment models

The [Deploy JavaScript apps](https://aspire.dev/deployment/javascript-apps/) page describes three deployment models for static frontends that call backend APIs:

| Model | Aspire API | Solves CORS? | Solves URL discovery? |
|-------|-----------|-------------|---------------------|
| Backend serves frontend | `PublishWithContainerFiles` | ✅ | ✅ |
| Reverse proxy serves frontend | `PublishWithStaticFiles` (YARP) | ✅ | ✅ |
| Standalone static site | `PublishAsStaticWebsite()` | ❌ | ❌ |
| Static site + API proxy | `PublishAsStaticWebsite(apiPath, apiTarget)` | ✅ | ✅ |
| Server-rendered JS app | `PublishAsNodeServer` / `PublishAsNpmScript` | ✅ (can proxy) | ✅ (server-side) |

Server-rendered frameworks sidestep both CORS and URL discovery entirely because the server can proxy API calls or inject configuration at render time.

## See also

- [Deploy JavaScript apps](https://aspire.dev/deployment/javascript-apps/) — deployment models for static frontends
- [JavaScript integration](https://aspire.dev/integrations/frameworks/javascript/) — hosting integration reference
- [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment)
- [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node)
- [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [Astro Docker recipe](https://docs.astro.build/en/recipes/docker/)
- [Remix deployment templates](https://github.com/remix-run/react-router-templates)
