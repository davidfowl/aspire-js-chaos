# Aspire JS Framework Chaos — Deployment Investigation

A sample repo proving that Aspire can deploy 10 JavaScript framework configurations using their **officially recommended** production runtime paths.

## Conclusion: Three Deployment Buckets

After reviewing each framework's official deployment docs, GitHub samples, and Dockerfiles, JavaScript frameworks fall into three clear categories:

### 1. Static Website (Caddy)
Frameworks that build to a `dist/` folder of static files. No Node.js needed at runtime.

| Framework | Build Command | Output | Docs |
|-----------|--------------|--------|------|
| **Vite** | `vite build` | `dist/` | [Deploying a Static Site](https://vite.dev/guide/static-deploy.html) · [`vite preview` is not a production server](https://vite.dev/guide/cli.html#vite-preview) |
| **React** | `vite build` | `dist/` | Vite-based — same as above |
| **Vue** | `vite build` | `dist/` | Vite-based — same as above |
| **Astro** (static) | `astro build` | `dist/` | [Deploy your Astro Site](https://docs.astro.build/en/guides/deploy/) · [Output config](https://docs.astro.build/en/reference/configuration-reference/#output) · [`astro preview` is not for production](https://docs.astro.build/en/reference/cli-reference/#astro-preview) |

### 2. Node Built Artifact (direct `node` entrypoint, no npm at runtime)
Frameworks that produce a self-contained server artifact during build. The runtime image only needs the built output — no `node_modules`, no package manager.

#### Next.js (standalone output)
- **Output layout**: `.next/standalone/` (self-contained server + bundled deps), `.next/static/` (client assets), `public/` (static files)
- **Runtime**: `node server.js`
- **Config required**: `output: "standalone"` in `next.config.ts`
- **Docs**: [Deploying](https://nextjs.org/docs/app/building-your-application/deploying) · [Self-Hosting Guide](https://nextjs.org/docs/app/guides/self-hosting) · [`output: "standalone"` reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- **Sample Dockerfile**: [`vercel/next.js/examples/with-docker`](https://github.com/vercel/next.js/tree/canary/examples/with-docker) — runtime stage uses `CMD ["node", "server.js"]`, copies only standalone + static + public, no npm

#### Nuxt (Nitro node-server preset)
- **Output layout**: `.output/server/index.mjs` (self-contained server), `.output/public/` (client assets)
- **Runtime**: `node .output/server/index.mjs`
- **Config**: Optionally set `nitro.preset: 'node-server'` in `nuxt.config.ts` (it's the default)
- **Docs**: [Nuxt Deployment — Node.js Server](https://nuxt.com/docs/getting-started/deployment#nodejs-server) · [Nitro Node Server Preset](https://nitro.build/deploy/runtimes/node)
- **Env vars**: `PORT` (default 3000), `HOST` (default 0.0.0.0)

#### SvelteKit (adapter-node)
- **Output layout**: `build/` directory with `build/index.js` as entry point
- **Runtime**: `node build` or `node build/index.js`
- **Config required**: Install `@sveltejs/adapter-node` and update `svelte.config.js`
- **Docs**: [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node) · [Adapters overview](https://svelte.dev/docs/kit/adapters)
- **Env vars**: `PORT`, `HOST`, `ORIGIN`

#### TanStack Start (Nitro)
- **Output layout**: `.output/server/index.mjs` (self-contained server), `.output/public/` (client assets) — same shape as Nuxt (both use Nitro)
- **Runtime**: `node .output/server/index.mjs`
- **Docs**: [TanStack Start Deployment](https://tanstack.com/start/latest/docs/framework/react/deployment) · [Nitro Node Server Preset](https://nitro.build/deploy/runtimes/node)

### 3. Node with Runtime Dependencies (needs `node_modules` at runtime)
Frameworks where the built server entry point imports unbundled packages from `node_modules` at runtime. The runtime image must include production dependencies.

#### Astro SSR (node adapter, standalone mode)
- **Output layout**: `dist/server/entry.mjs` (server entry), `dist/client/` (client assets)
- **Runtime**: `node ./dist/server/entry.mjs`
- **Why node_modules?**: The built `entry.mjs` imports from unbundled packages like `@astrojs/internal-helpers` at runtime. This is confirmed by Astro's official multi-stage Docker example which copies `node_modules` into the runtime image.
- **Config required**: Install `@astrojs/node` adapter, set `mode: 'standalone'`
- **Docs**: [Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/) · [Astro Docker recipe](https://docs.astro.build/en/recipes/docker/)
- **Sample Dockerfile**: From the [Astro Docker docs](https://docs.astro.build/en/recipes/docker/#multi-stage-build-using-ssr):
  ```dockerfile
  COPY --from=prod-deps /app/node_modules ./node_modules
  COPY --from=build /app/dist ./dist
  CMD ["node", "./dist/server/entry.mjs"]
  ```

#### Remix / React Router
- **Output layout**: `build/server/index.js` (server), `build/client/` (client assets)
- **Runtime**: `npm run start` → `react-router-serve ./build/server/index.js`
- **Why node_modules?**: `react-router-serve` is an npm package in `node_modules`, not a standalone binary
- **Docs**: [React Router Deploying](https://reactrouter.com/start/framework/deploying)
- **Sample Dockerfile**: [`remix-run/react-router-templates/node-custom-server`](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server) — runtime stage uses `CMD ["npm", "run", "start"]`, copies `node_modules` (prod-only) + `build/`

## Important Implementation Notes

### `.dockerignore`
Each framework directory has a `.dockerignore` to exclude `node_modules` and build artifacts from Docker context. Without this, Docker builds fail with disk exhaustion errors.

### External Endpoints
All frameworks use `.withExternalHttpEndpoints()` in the AppHost so that `aspire deploy` exposes host-visible URLs.

### No `vite preview` in Production
Our earlier POC used `npm run preview` for Nuxt, SvelteKit, and TanStack Start. This is **wrong** — those are dev/preview servers, not production servers. The updated sample uses the framework-recommended built artifacts directly.

### User Permissions
With direct Node artifact entrypoints (bucket 2), containers run as `USER node` (non-root). Frameworks in bucket 3 that use `npm run` currently run as root because npm may need write access. The earlier POC needed `USER root` for `vite preview` because it writes temp files to `node_modules/.vite-temp` — that problem goes away with the correct production runtime.

### Astro: Two Modes
Astro appears in both bucket 1 (static, default) and bucket 3 (SSR with node adapter). The mode depends on whether the user adds `@astrojs/node` and configures server-side rendering. This sample includes both variants.

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
// Static frameworks (Caddy)
app.publishAsStaticWebsite()

// Static site with API proxy — no CORS, no URL discovery problem
app.publishAsStaticWebsite({ apiPath: '/api', apiTarget: await api.getEndpoint('http') })

// Built Node artifact — self-contained, no npm at runtime
app.publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })

// Next.js standalone — special copy shape for .next/standalone + .next/static + public
app.publishAsNextStandalone()

// Needs node_modules at runtime (Astro SSR, Remix)
app.publishAsNpmScript({ startScriptName: 'start' })
```

### Static sites and API backends

Most SPAs are static files that call one backend API. `publishAsStaticWebsite` supports this directly with an optional API proxy:

```typescript
const api = builder.addNodeApp('api', './api', 'server.js')
    .withHttpEndpoint({ port: 3001, env: 'PORT' });

const frontend = builder.addViteApp('frontend', './frontend')
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: await api.getEndpoint('http') })
    .withExternalHttpEndpoints();
```

At deploy time, Caddy adds a `reverse_proxy` rule for `/api/*` to the backend — the browser calls `/api/...` on the same origin, so there's no CORS and no need to bake the backend URL at build time.

For anything more complex (multiple backends, path transforms, auth/BFF), use YARP with `PublishWithStaticFiles`.

### SPA fallback

`publishAsStaticWebsite` enables SPA fallback by default (`spaFallback: true`), which rewrites unknown routes to `/index.html`. This is what React, Vue, and Angular SPAs need for client-side routing — without it, refreshing on `/dashboard` returns a 404.

For multi-page static sites like Astro (static mode), disable it:

```typescript
app.publishAsStaticWebsite({ spaFallback: false })
```
