---
title: Publish JavaScript apps
description: Learn how to publish JavaScript applications with Aspire, including static websites, Node.js server applications, and framework-specific deployment patterns.
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

Use `PublishAsStaticWebsite` for frameworks that compile to static files during `npm run build`. The resulting container serves the files using [Caddy](https://caddyserver.com), a lightweight HTTP server with automatic HTTPS support.

This is the right choice for:

- **Vite** apps (React, Vue, vanilla)
- **Astro** in default static mode
- Any SPA or static site generator that outputs to `dist/`

### Usage

:::code language="csharp" source="snippets/AppHost/Program.cs" id="StaticWebsite":::

```csharp
var frontend = builder.AddViteApp("frontend", "./frontend")
    .PublishAsStaticWebsite();
```

:::code language="typescript" source="snippets/apphost.ts" id="StaticWebsite":::

```typescript
const frontend = builder
    .addViteApp('frontend', './frontend')
    .publishAsStaticWebsite();
```

### What it generates

The publish pipeline generates a multi-stage Dockerfile:

```dockerfile
# Build stage: install dependencies and build
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: serve static files with Caddy
FROM caddy:2.7.4-alpine AS runtime
WORKDIR /srv
COPY --from=build /app/dist /srv
ENTRYPOINT ["caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

### SPA fallback

By default, `PublishAsStaticWebsite` enables SPA fallback routing — unknown paths are rewritten to `/index.html`. To disable this (for multi-page static sites):

```csharp
builder.AddViteApp("docs", "./docs-site")
    .PublishAsStaticWebsite(spaFallback: false);
```

## Publish as Node server

Use `PublishAsNodeServer` for frameworks that produce a self-contained Node.js server artifact during the build. The resulting container runs the built entry point directly with `node` — no package manager, no `node_modules` required at runtime.

This is the right choice for:

- **Nuxt** — builds to `.output/server/index.mjs` via [Nitro](https://nitro.build/deploy/runtimes/node)
- **SvelteKit** with [`adapter-node`](https://svelte.dev/docs/kit/adapter-node) — builds to `build/index.js`
- **TanStack Start** — builds to `.output/server/index.mjs` via Nitro
- **Next.js** with [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) — builds to `.next/standalone/server.js`

### Usage

The `entryPoint` parameter specifies the path to the Node.js entry point relative to the app directory. The optional `outputPath` parameter specifies which directory to copy into the runtime image.

:::code language="csharp" source="snippets/AppHost/Program.cs" id="NodeServer":::

```csharp
// Nuxt
builder.AddViteApp("nuxt-app", "./nuxt-app")
    .PublishAsNodeServer(
        entryPoint: ".output/server/index.mjs",
        outputPath: ".output");

// SvelteKit (requires @sveltejs/adapter-node)
builder.AddViteApp("svelte-app", "./svelte-app")
    .PublishAsNodeServer(
        entryPoint: "build/index.js",
        outputPath: "build");
```

:::code language="typescript" source="snippets/apphost.ts" id="NodeServer":::

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
# Build stage
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: only the built artifact, no node_modules
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
| **Nuxt** | None — `node-server` is the default Nitro preset |
| **SvelteKit** | Install `@sveltejs/adapter-node` and update `svelte.config.js` to use it instead of `adapter-auto` |
| **TanStack Start** | None — uses Nitro with `node-server` preset by default |
| **Next.js** | Set `output: "standalone"` in `next.config.ts` |

> [!TIP]
> For **Next.js**, the standalone output bundles dependencies into the server, so no `node_modules` are needed at runtime. See the [official Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) for the recommended container shape.

## Publish as npm script

Use `PublishAsNpmScript` for frameworks where the production server depends on packages in `node_modules` at runtime. The resulting container includes the full `node_modules` tree (or production-only dependencies) alongside the built output.

This is the right choice for:

- **Remix / React Router** — the `react-router-serve` binary lives in `node_modules`
- **Astro SSR** with [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/) — the built `entry.mjs` imports unbundled `@astrojs/*` packages

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

### What it generates

```dockerfile
# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: includes node_modules for runtime imports
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENTRYPOINT ["sh", "-c", "npm run start"]
```

> [!NOTE]
> Unlike `PublishAsNodeServer`, this method copies the entire application directory (including `node_modules`) into the runtime image. This results in a larger image but is required when the framework's server entry point imports packages that aren't bundled into the build output.

## How to choose the right method

Use this decision tree to pick the correct publish method:

1. **Does your framework build to static HTML/CSS/JS files?**
   - Yes → `PublishAsStaticWebsite`

2. **Does your framework produce a self-contained server artifact?**
   - Check: Can you run `node <entry-point>` in an empty directory with just the build output (no `node_modules`)?
   - Yes → `PublishAsNodeServer`

3. **Does the built server import packages from `node_modules`?**
   - Yes → `PublishAsNpmScript`

### Quick reference

| Framework | Default mode | Method | Entry point |
|-----------|-------------|--------|-------------|
| Vite / React / Vue | Static | `PublishAsStaticWebsite` | N/A (Caddy) |
| Astro (default) | Static | `PublishAsStaticWebsite` | N/A (Caddy) |
| Nuxt | Server | `PublishAsNodeServer` | `.output/server/index.mjs` |
| SvelteKit | Server | `PublishAsNodeServer` | `build/index.js` |
| TanStack Start | Server | `PublishAsNodeServer` | `.output/server/index.mjs` |
| Next.js (standalone) | Server | `PublishAsNodeServer` | `server.js` |
| Astro SSR | Server | `PublishAsNpmScript` | `node ./dist/server/entry.mjs` |
| Remix | Server | `PublishAsNpmScript` | `react-router-serve` |

## See also

- [Build Aspire apps with Node.js](/get-started/build-aspire-apps-with-nodejs)
- [Vite static deploy guide](https://vite.dev/guide/static-deploy.html)
- [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment)
- [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node)
- [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [Astro Docker recipe](https://docs.astro.build/en/recipes/docker/)
- [Remix deployment templates](https://github.com/remix-run/react-router-templates)
