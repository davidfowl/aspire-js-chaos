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

### What it generates

Without API proxy:

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2.7.4-alpine AS runtime
WORKDIR /srv
COPY --from=build /app/dist /srv
ENTRYPOINT ["caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

With API proxy, the generated Caddyfile adds a `handle` block:

```caddyfile
:{$PORT} {
    tracing
    handle /api/* {
        reverse_proxy {$API_HTTP}
    }
    handle {
        root * /srv
        file_server
        try_files {path} /index.html
    }
}
```

The `API_HTTP` environment variable is injected automatically by Aspire's `WithReference` mechanism.

### SPA fallback

By default, `PublishAsStaticWebsite` enables SPA fallback routing — unknown paths are rewritten to `/index.html`. To disable this (for multi-page static sites like Astro):

```csharp
builder.AddViteApp("docs", "./docs-site")
    .PublishAsStaticWebsite(spaFallback: false);
```

## Publish as Node server

Use `PublishAsNodeServer` for frameworks that produce a self-contained Node.js server artifact during the build. The resulting container runs the built entry point directly with `node` — no package manager, no `node_modules` required at runtime.

This is the right choice for:


- **SvelteKit** with [`adapter-node`](https://svelte.dev/docs/kit/adapter-node) — builds to `build/index.js`
- **TanStack Start** — builds to `.output/server/index.mjs` via Nitro
- **Next.js** with [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) — builds to `.next/standalone/server.js`

### Usage

The `entryPoint` parameter specifies the path to the Node.js entry point relative to the app directory. The optional `outputPath` parameter specifies which directory to copy into the runtime image.

```csharp
// Nuxt (needs node_modules — see PublishAsNpmScript)
// builder.AddViteApp("nuxt-app", "./nuxt-app")
//     .PublishAsNpmScript(startScriptName: "start");
        outputPath: ".output");

// SvelteKit (requires @sveltejs/adapter-node)
builder.AddViteApp("svelte-app", "./svelte-app")
    .PublishAsNodeServer(
        entryPoint: "build/index.js",
        outputPath: "build");
```

```typescript
// Nuxt
builder
    .addViteApp('nuxt-app', './nuxt-app')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' });

// SvelteKit (requires @sveltejs/adapter-node)
builder
    .addViteApp('svelte-app', './svelte-app')
    .publishAsNodeServer('build/index.js', { outputPath: 'build' });
```

### What it generates

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output /app/.output
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", ".output/server/index.mjs"]
```

### Framework configuration requirements

Some frameworks require configuration changes before `PublishAsNodeServer` will work:

| Framework | Required configuration |
|-----------|----------------------|
| **SvelteKit** | Install `@sveltejs/adapter-node` and update `svelte.config.js` |
| **TanStack Start** | None — uses Nitro with `node-server` preset by default |
| **Next.js** | Set `output: "standalone"` in `next.config.ts` |

> [!TIP]
> For **Next.js**, the standalone output bundles dependencies into the server, so no `node_modules` are needed at runtime. See the [official Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker).

## Publish as npm script

Use `PublishAsNpmScript` for frameworks where the production server depends on packages in `node_modules` at runtime. The resulting container includes the full application alongside the built output.

This is the right choice for:

- **Nuxt** — `useAsyncData`/`useFetch` needs the full Nitro environment with `node_modules` at runtime. Hello-world works standalone, but server-side data fetching breaks without it. See the [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment).
- **Remix / React Router** — the `react-router-serve` binary lives in `node_modules`. See the [official Dockerfile](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server).
- **Astro SSR** with [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/) — the built `entry.mjs` imports unbundled `@astrojs/*` packages. See the [official Docker recipe](https://docs.astro.build/en/recipes/docker/).

### Usage

```csharp
// Remix
builder.AddViteApp("remix-app", "./remix-app")
    .PublishAsNpmScript(
        startScriptName: "start",
        runScriptArguments: "-- --port \"$PORT\"");

// Astro SSR
builder.AddViteApp("astro-ssr", "./astro-ssr")
    .PublishAsNpmScript(startScriptName: "start");
```

```typescript
// Remix
builder
    .addViteApp('remix-app', './remix-app')
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' });

// Astro SSR
builder
    .addViteApp('astro-ssr', './astro-ssr')
    .publishAsNpmScript({ startScriptName: 'start' });
```

> [!NOTE]
> Unlike `PublishAsNodeServer`, this method copies the entire application directory (including `node_modules`) into the runtime image. This results in a larger image but is required when the server entry point imports packages that aren't bundled into the build output.

## How to choose the right method

1. **Does your framework build to static HTML/CSS/JS files?**
   - Yes → `PublishAsStaticWebsite`
   - Does it call a backend API? → Add `apiPath` and `apiTarget`
   - Need complex routing? → Use YARP with `PublishWithStaticFiles`

2. **Does your framework produce a self-contained server artifact?**
   - Test: Can you run `node <entry-point>` with just the build output (no `node_modules`)?
   - Yes → `PublishAsNodeServer`

3. **Does the built server import packages from `node_modules`?**
   - Yes → `PublishAsNpmScript`

### Quick reference

| Framework | Default mode | Method | Entry point |
|-----------|-------------|--------|-------------|
| Vite / React / Vue | Static | `PublishAsStaticWebsite` | N/A (Caddy) |
| Astro (default) | Static | `PublishAsStaticWebsite` | N/A (Caddy) |
| Nuxt | Server | `PublishAsNpmScript` | `node .output/server/index.mjs` |
| SvelteKit | Server | `PublishAsNodeServer` | `build/index.js` |
| TanStack Start | Server | `PublishAsNodeServer` | `.output/server/index.mjs` |
| Next.js (standalone) | Server | `PublishAsNodeServer` | `server.js` |
| Astro SSR | Server | `PublishAsNpmScript` | `node ./dist/server/entry.mjs` |
| Remix | Server | `PublishAsNpmScript` | `react-router-serve` |

## Relationship to existing deployment models

The [Deploy JavaScript apps](https://aspire.dev/deployment/javascript-apps/) page describes three deployment models for static frontends that call backend APIs:

| Model | Aspire API | Solves CORS? | Solves URL discovery? |
|-------|-----------|-------------|---------------------|
| Backend serves frontend | `PublishWithContainerFiles` | ✅ | ✅ |
| Reverse proxy serves frontend | `PublishWithStaticFiles` (YARP) | ✅ | ✅ |
| Standalone static site | `PublishAsStaticWebsite()` | ❌ | ❌ |
| Static site + API proxy | `PublishAsStaticWebsite(apiPath, apiTarget)` | ✅ | ✅ |
| Server-rendered JS app | `PublishAsNodeServer` / `PublishAsNpmScript` | ✅ (can proxy) | ✅ (server-side) |

Server-rendered frameworks (Nuxt, SvelteKit, Next.js, etc.) sidestep both CORS and URL discovery entirely because the server can proxy API calls or inject configuration at render time.

## See also

- [Deploy JavaScript apps](https://aspire.dev/deployment/javascript-apps/) — deployment models for static frontends
- [JavaScript integration](https://aspire.dev/integrations/frameworks/javascript/) — hosting integration reference
- [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment)
- [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node)
- [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [Astro Docker recipe](https://docs.astro.build/en/recipes/docker/)
- [Remix deployment templates](https://github.com/remix-run/react-router-templates)
