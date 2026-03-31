# Aspire JS Framework Chaos — Deployment Investigation

A sample repo proving that Aspire can deploy 9 different JavaScript frameworks using their **officially recommended** production runtime paths.

## Conclusion: Three Deployment Buckets

After reviewing each framework's official deployment docs and samples, JavaScript frameworks fall into three clear categories:

### 1. Static Website (Caddy)
Frameworks that build to a `dist/` folder of static files. No Node.js needed at runtime.

| Framework | Build Command | Output | Docs |
|-----------|--------------|--------|------|
| **Vite** | `vite build` | `dist/` | [Deploying a Static Site](https://vite.dev/guide/static-deploy.html) · [`vite preview` is not a production server](https://vite.dev/guide/cli.html#vite-preview) |
| **React** | `vite build` | `dist/` | Vite-based — same as above |
| **Vue** | `vite build` | `dist/` | Vite-based — same as above |
| **Astro** | `astro build` | `dist/` | [Deploy your Astro Site](https://docs.astro.build/en/guides/deploy/) · [Output configuration](https://docs.astro.build/en/reference/configuration-reference/#output) · [`astro preview` is not for production](https://docs.astro.build/en/reference/cli-reference/#astro-preview) |

### 2. Node Built Artifact (direct `node` entrypoint)
Frameworks that produce a standalone server artifact during build. No npm/package-manager needed at runtime.

#### Next.js (standalone output)
- **Output layout**: `.next/standalone/` (self-contained server), `.next/static/` (client assets), `public/` (static files)
- **Runtime**: `node server.js`
- **Config required**: `output: "standalone"` in `next.config.ts`
- **Docs**: [Deploying — Self-Hosting](https://nextjs.org/docs/app/building-your-application/deploying) · [Self-Hosting Guide](https://nextjs.org/docs/app/guides/self-hosting) · [`output: "standalone"` reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- **Sample**: [`vercel/next.js/examples/with-docker`](https://github.com/vercel/next.js/tree/canary/examples/with-docker) — uses `CMD ["node", "server.js"]`, not npm

#### Nuxt (Nitro node-server preset)
- **Output layout**: `.output/server/index.mjs` (server entry), `.output/public/` (client assets)
- **Runtime**: `node .output/server/index.mjs`
- **Config**: Optionally set `nitro.preset: 'node-server'` in `nuxt.config.ts` (it's the default)
- **Docs**: [Nuxt Deployment — Node.js Server](https://nuxt.com/docs/getting-started/deployment#nodejs-server) · [Nitro Node Server Preset](https://nitro.build/deploy/runtimes/node)
- **Env vars**: `PORT` (default 3000), `HOST` (default 0.0.0.0), `NITRO_PORT`, `NITRO_HOST`

#### SvelteKit (adapter-node)
- **Output layout**: `build/` directory with `build/index.js` as entry point
- **Runtime**: `node build` or `node build/index.js`
- **Config required**: Install `@sveltejs/adapter-node` and update `svelte.config.js`
- **Docs**: [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node) · [Adapters overview](https://svelte.dev/docs/kit/adapters) · [`vite preview` is not a production server](https://vite.dev/guide/cli.html#vite-preview)
- **Env vars**: `PORT`, `HOST`, `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER`

#### TanStack Start (Nitro)
- **Output layout**: `.output/server/index.mjs` (server entry), `.output/public/` (client assets) — same as Nuxt (both use Nitro)
- **Runtime**: `node .output/server/index.mjs`
- **Docs**: [TanStack Start Deployment](https://tanstack.com/start/latest/docs/framework/react/deployment) · [Nitro Node Server Preset](https://nitro.build/deploy/runtimes/node)
- **Note**: Docs are provider/preset-oriented; the Nitro node-server preset is the generic self-hosting path

### 3. npm Script at Runtime
Frameworks where the server binary lives in `node_modules` and must be invoked via npm.

#### Remix / React Router
- **Output layout**: `build/server/index.js` (server), `build/client/` (client assets)
- **Runtime**: `npm run start` → `react-router-serve ./build/server/index.js`
- **Why npm?**: `react-router-serve` is an npm package in `node_modules`, not a standalone binary
- **Docs**: [React Router Deploying](https://reactrouter.com/start/framework/deploying)
- **Samples**: [`remix-run/react-router-templates/node-custom-server`](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server) — Dockerfile uses `CMD ["npm", "run", "start"]` · [`remix-run/react-router-templates/default`](https://github.com/remix-run/react-router-templates/tree/main/default)

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

The `apphost.ts` uses helper methods matching the three deployment buckets:

```typescript
// Static frameworks
app.publishAsStaticWebsite()

// Built Node artifact (no npm at runtime)
app.publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })

// Next.js standalone (special copy shape for .next/standalone + .next/static + public)
app.publishAsNextStandalone()

// npm script at runtime (Remix — react-router-serve is in node_modules)
app.publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
```
