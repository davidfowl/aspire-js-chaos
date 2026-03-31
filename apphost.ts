// Aspire TypeScript AppHost — doc-aligned framework deployment
import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();
await builder.addDockerComposeEnvironment('compose');

// --- Simple API backend for testing the proxy ---
const api = builder.addNodeApp('api', './frameworks/api', 'server.js')
  .withHttpEndpoint({ port: 3001, env: 'PORT' })
  .withExternalHttpEndpoints();

await api.publishAsDockerComposeService(async (_r, s) => { await s.name.set('api'); });

// --- Static frameworks ---

// Vite with API proxy: /api/* proxied to the backend via Caddy
{
  const app = builder.addViteApp('vite', './frameworks/vite', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Vite')
    .publishAsStaticWebsite({ apiPath: '/api', apiTarget: await api.getEndpoint('http') })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('vite'); });
}

// React, Vue, Astro — plain static, no proxy
for (const fw of [
  { name: 'react', display: 'React', path: './frameworks/react' },
  { name: 'vue', display: 'Vue', path: './frameworks/vue' },
  { name: 'astro', display: 'Astro (static)', path: './frameworks/astro' },
]) {
  const app = builder.addViteApp(fw.name, fw.path, { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', fw.display)
    .publishAsStaticWebsite()
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set(fw.name); });
}

// --- Node server frameworks ---

// Nuxt
{
  const app = builder.addViteApp('nuxt', './frameworks/nuxt', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Nuxt')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nuxt'); });
}

// SvelteKit
{
  const app = builder.addViteApp('sveltekit', './frameworks/sveltekit', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'SvelteKit')
    .publishAsNodeServer('build/index.js', { outputPath: 'build' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('sveltekit'); });
}

// TanStack Start
{
  const app = builder.addViteApp('tanstack-start', './frameworks/tanstack-start', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'TanStack Start')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('tanstack-start'); });
}

// Next.js standalone
{
  const app = builder.addViteApp('nextjs', './frameworks/nextjs', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Next.js')
    .publishAsNextStandalone()
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nextjs'); });
}

// --- Frameworks needing node_modules at runtime ---

// Astro SSR
{
  const app = builder.addViteApp('astro-ssr', './frameworks/astro-ssr', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Astro SSR')
    .publishAsNpmScript({ startScriptName: 'start' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('astro-ssr'); });
}

// Remix
{
  const app = builder.addViteApp('remix', './frameworks/remix', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Remix')
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('remix'); });
}

await builder.build().run();
