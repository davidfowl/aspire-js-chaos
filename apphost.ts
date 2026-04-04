// Aspire TypeScript AppHost — weather API + frontend validation
import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();
await builder.addDockerComposeEnvironment('compose');

// --- Weather API backend ---
const api = await builder.addNodeApp('api', './frameworks/api', 'server.js')
  .withHttpEndpoint({ port: 3001, env: 'PORT' })
  .withExternalHttpEndpoints();

// Helper: get API URL for server-side fetch
const apiEndpoint = await api.getEndpoint('http');

// --- Static SPAs: client-side fetch via Caddy proxy ---

// Vite with API proxy
{
  await builder.addViteApp('vite', './frameworks/vite', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })
    .withExternalHttpEndpoints();
}

// React with API proxy
{
  await builder.addViteApp('react', './frameworks/react', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })
    .withExternalHttpEndpoints();
}

// Vue with API proxy
{
  await builder.addViteApp('vue', './frameworks/vue', { runScriptName: 'dev' })
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api })
    .withExternalHttpEndpoints();
}

// Astro static (no weather fetch — MPA, no client JS by default)
{
  await builder.addViteApp('astro', './frameworks/astro', { runScriptName: 'dev' })
    .publishAsStaticWebsite()
    .withExternalHttpEndpoints();
}

// --- Node server frameworks: server-side fetch from API ---

// Nuxt
{
  await builder.addViteApp('nuxt', './frameworks/nuxt', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start' })
    .withEnvironment('API_URL', apiEndpoint)
    .withEnvironment('NUXT_API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

// SvelteKit
{
  await builder.addViteApp('sveltekit', './frameworks/sveltekit', { runScriptName: 'dev' })
    .publishAsNodeServer('build/index.js', { outputPath: 'build' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

// TanStack Start
{
  await builder.addViteApp('tanstack-start', './frameworks/tanstack-start', { runScriptName: 'dev' })
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

// Next.js standalone
{
  await builder.addNextJsApp('nextjs', './frameworks/nextjs', { runScriptName: 'dev' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

// --- Frameworks needing node_modules at runtime ---

// Astro SSR
{
  await builder.addViteApp('astro-ssr', './frameworks/astro-ssr', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

// Remix
{
  await builder.addViteApp('remix', './frameworks/remix', { runScriptName: 'dev' })
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
    .withEnvironment('API_URL', apiEndpoint)
    .withExternalHttpEndpoints();
}

await builder.build().run();
