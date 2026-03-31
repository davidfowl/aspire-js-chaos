// Aspire TypeScript AppHost — weather API + frontend validation
import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();
await builder.addDockerComposeEnvironment('compose');

// --- Weather API backend ---
const api = builder.addNodeApp('api', './frameworks/api', 'server.js')
  .withHttpEndpoint({ port: 3001, env: 'PORT' })
  .withExternalHttpEndpoints();

await api.publishAsDockerComposeService(async (_r, s) => { await s.name.set('api'); });

// Helper: get API URL for server-side fetch
const apiEndpoint = await api.getEndpoint('http');

// --- Static SPAs: client-side fetch via Caddy proxy ---

// Vite with API proxy
{
  const app = builder.addViteApp('vite', './frameworks/vite', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: apiEndpoint })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('vite'); });
}

// React with API proxy
{
  const app = builder.addViteApp('react', './frameworks/react', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: apiEndpoint })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('react'); });
}

// Vue with API proxy
{
  const app = builder.addViteApp('vue', './frameworks/vue', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: apiEndpoint })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('vue'); });
}

// Astro static (no weather fetch — MPA, no client JS by default)
{
  const app = builder.addViteApp('astro', './frameworks/astro', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ spaFallback: false })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('astro'); });
}

// --- Node server frameworks: server-side fetch from API ---

// Nuxt
{
  const app = builder.addViteApp('nuxt', './frameworks/nuxt', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start' })
    .withEnvironment('API_URL', apiEndpoint)
    .withEnvironment('NUXT_API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nuxt'); });
}

// SvelteKit
{
  const app = builder.addViteApp('sveltekit', './frameworks/sveltekit', { runScriptName: 'dev' })
    .publishAsNodeServer('build/index.js', { outputPath: 'build' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('sveltekit'); });
}

// TanStack Start
{
  const app = builder.addViteApp('tanstack-start', './frameworks/tanstack-start', { runScriptName: 'dev' })
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('tanstack-start'); });
}

// Next.js standalone
{
  const app = builder.addViteApp('nextjs', './frameworks/nextjs', { runScriptName: 'dev' })
    .publishAsNextStandalone()
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nextjs'); });
}

// --- Frameworks needing node_modules at runtime ---

// Astro SSR
{
  const app = builder.addViteApp('astro-ssr', './frameworks/astro-ssr', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('astro-ssr'); });
}

// Remix
{
  const app = builder.addViteApp('remix', './frameworks/remix', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('remix'); });
}

await builder.build().run();
