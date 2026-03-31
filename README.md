# Aspire JS Framework Chaos — Deployment Investigation

A sample repo proving that Aspire can deploy 9 different JavaScript frameworks using their **officially recommended** production runtime paths.

## Conclusion: Three Deployment Buckets

After reviewing each framework's official deployment docs and samples, JavaScript frameworks fall into three clear categories:

### 1. Static Website (Caddy)
Frameworks that build to a `dist/` folder of static files. No Node.js needed at runtime.

| Framework | Build Command | Output | Docs |
|-----------|--------------|--------|------|
| **Vite** | `vite build` | `dist/` | [vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy.html) |
| **React** | `vite build` | `dist/` | Vite-based |
| **Vue** | `vite build` | `dist/` | Vite-based |
| **Astro** | `astro build` | `dist/` | [docs.astro.build/en/guides/deploy](https://docs.astro.build/en/guides/deploy/) |

> **Important**: Both Vite and Astro docs explicitly state that `vite preview` / `astro preview` are **not production servers**.

### 2. Node Built Artifact (direct `node` entrypoint)
Frameworks that produce a standalone server artifact during build. No npm/package-manager needed at runtime.

| Framework | Build Output | Runtime Command | Official Reference |
|-----------|-------------|-----------------|-------------------|
| **Next.js** | `.next/standalone/` + `.next/static/` + `public/` | `node server.js` | [with-docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) |
| **Nuxt** | `.output/` | `node .output/server/index.mjs` | [nuxt.com/docs/getting-started/deployment](https://nuxt.com/docs/getting-started/deployment) |
| **SvelteKit** | `build/` | `node build/index.js` | [svelte.dev/docs/kit/adapter-node](https://svelte.dev/docs/kit/adapter-node) |
| **TanStack Start** | `.output/` (Nitro) | `node .output/server/index.mjs` | [nitro.build/deploy/runtimes/node](https://nitro.build/deploy/runtimes/node) |

> **Key insight**: Next.js requires `output: "standalone"` in `next.config.ts`. SvelteKit requires `@sveltejs/adapter-node` instead of `adapter-auto`.

### 3. npm Script at Runtime
Frameworks where the server binary lives in `node_modules` and must be invoked via npm.

| Framework | Runtime Command | Why npm? | Official Reference |
|-----------|----------------|----------|-------------------|
| **Remix** | `npm run start` → `react-router-serve ./build/server/index.js` | `react-router-serve` is an npm dependency, not a built artifact | [node-custom-server Dockerfile](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server) |

## Framework-Specific Setup Requirements

### Next.js
- **Config**: Set `output: "standalone"` in `next.config.ts`
- **Dockerfile shape**: Copy `.next/standalone`, `.next/static`, and `public` into runtime image
- **Runtime**: `node server.js` (no npm needed)
- **Env**: `HOSTNAME=0.0.0.0` for container binding

### Nuxt
- **Config**: Optionally set `nitro.preset: 'node-server'` in `nuxt.config.ts`
- **Dockerfile shape**: Copy `.output/` into runtime image
- **Runtime**: `node .output/server/index.mjs`
- **Env**: Respects `PORT` and `HOST` env vars

### SvelteKit
- **Config**: Install `@sveltejs/adapter-node` and update `svelte.config.js`
- **Dockerfile shape**: Copy `build/` into runtime image
- **Runtime**: `node build/index.js`
- **Env**: Respects `PORT` and `HOST` env vars

### TanStack Start
- **Config**: Uses Nitro under the hood, no special config needed
- **Dockerfile shape**: Copy `.output/` into runtime image
- **Runtime**: `node .output/server/index.mjs`
- **Env**: Respects `PORT` and `HOST` env vars

### Remix / React Router
- **Config**: Default scaffold works
- **Dockerfile shape**: Copy `build/`, `package.json`, `node_modules` (prod-only) into runtime image
- **Runtime**: `npm run start` (which runs `react-router-serve ./build/server/index.js`)
- **Env**: Pass `--port "$PORT"` via run script arguments

## Important Implementation Notes

### `.dockerignore`
Each framework directory has a `.dockerignore` to exclude `node_modules` and build artifacts from Docker context. Without this, Docker builds fail with disk exhaustion errors.

### External Endpoints
All frameworks use `.withExternalHttpEndpoints()` in the AppHost so that `aspire deploy` exposes host-visible URLs.

### No `vite preview` in Production
Our earlier POC used `npm run preview` for Nuxt, SvelteKit, and TanStack Start. This is **wrong** — those are dev/preview servers, not production servers. The updated sample uses the framework-recommended built artifacts directly.

### User Permissions
With direct Node artifact entrypoints, containers run as `USER node` (non-root). The earlier POC needed `USER root` because `vite preview` writes temp files to `node_modules/.vite-temp`. That problem goes away when you use the correct production runtime.

## How to Run

```bash
# Start in dev mode
aspire run

# Deploy to Docker Compose
aspire deploy
```

## AppHost Structure

The `apphost.ts` uses three helper methods matching the three deployment buckets:

```typescript
// Static frameworks
app.publishAsStaticWebsite()

// Built Node artifact (no npm at runtime)
app.publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })

// Next.js standalone (special copy shape)
app.publishAsNextStandalone()

// npm script at runtime (Remix)
app.publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
```
