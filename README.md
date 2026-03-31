# Aspire JS chaos

This repo is a proof-of-concept for publishing a mixed set of JavaScript frameworks from an Aspire TypeScript AppHost.

The core conclusion is that JavaScript publish does not fit a single deployment model. The sample proves two workable paths:

* A static website path for frameworks that emit static assets.
* A generic Node runtime path for frameworks that need a server process.

## Conclusions

The following frameworks worked with a static website runtime backed by a generated Dockerfile and Caddy:

* Vite
* React
* Vue
* Astro

The following frameworks worked with a generic Node runtime Dockerfile generated with `WithDockerfileBuilder`:

* Next.js
* Nuxt
* SvelteKit
* TanStack Start
* Remix

This points to a product direction with two built-in publish paths:

1. `PublishAsStaticWebsite(...)` for true static output.
2. A generic Node-based publish path for frameworks that require `start` or `preview`.

Framework-specific Dockerfiles do not appear to be required for the current sample set, although the generic Node path still needs framework-specific run commands and arguments.

## Verified runtime mapping

The current sample uses these publish modes:

| Framework | Publish mode | Runtime command |
| --- | --- | --- |
| Vite | Static website | Caddy serving built assets |
| React | Static website | Caddy serving built assets |
| Vue | Static website | Caddy serving built assets |
| Astro | Static website | Caddy serving built assets |
| Next.js | Generic Node runtime | `npm run start -- --hostname 0.0.0.0 --port "$PORT"` |
| Nuxt | Generic Node runtime | `npm run preview -- --port "$PORT"` |
| SvelteKit | Generic Node runtime | `npm run preview -- --host 0.0.0.0 --port "$PORT"` |
| TanStack Start | Generic Node runtime | `npm run preview -- --host 0.0.0.0 --port "$PORT"` |
| Remix | Generic Node runtime | `npm run start -- --port "$PORT"` |

## Important implementation notes

A few details were required to make the proof-of-concept work reliably:

* Docker build contexts must exclude `node_modules` and build output. Each framework sample includes a `.dockerignore`.
* Preview-based runtimes needed an external HTTP endpoint to make Docker Compose publish host-visible URLs.
* The Vite preview-based runtimes in this sample are run as `root` in the container so Vite can write temporary config files during startup.
* Static apps were verified both internally and through exposed Compose endpoints.
* Node-backed apps were verified through exposed Compose endpoints after `aspire deploy`.

## AppHost shape

The AppHost currently chooses a publish mode per framework in `apphost.ts`:

* Static frameworks use `publishAsStaticWebsite()`
* Server frameworks use `withNodeRuntimeDockerPublish(...)`
* All published apps use `withExternalHttpEndpoints()`

## Running the sample

Install dependencies:

```bash
npm install
```

Deploy to local Docker Compose with Aspire:

```bash
aspire deploy
```

The deploy output will print the localhost URL for each framework.

## Why this repo exists

This repo exists to capture the practical findings behind JavaScript publishing in Aspire before porting the proven behavior into the product codebase and issue discussion.
