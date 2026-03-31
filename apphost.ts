// Aspire TypeScript AppHost — doc-aligned framework deployment
import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();
await builder.addDockerComposeEnvironment('compose');

// Static frameworks: build to dist/, serve with Caddy
for (const fw of [
  { name: 'vite', display: 'Vite', path: './frameworks/vite' },
  { name: 'react', display: 'React', path: './frameworks/react' },
  { name: 'vue', display: 'Vue', path: './frameworks/vue' },
  { name: 'astro', display: 'Astro', path: './frameworks/astro' },
]) {
  const app = builder
    .addViteApp(fw.name, fw.path, { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', fw.display)
    .publishAsStaticWebsite()
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set(fw.name); });
}

// Node server frameworks: direct built artifact, no npm at runtime
// Nuxt: https://nuxt.com/docs/getting-started/deployment
{
  const app = builder.addViteApp('nuxt', './frameworks/nuxt', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Nuxt')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nuxt'); });
}

// SvelteKit: https://svelte.dev/docs/kit/adapter-node
{
  const app = builder.addViteApp('sveltekit', './frameworks/sveltekit', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'SvelteKit')
    .publishAsNodeServer('build/index.js', { outputPath: 'build' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('sveltekit'); });
}

// TanStack Start: https://tanstack.com/start/latest/docs/framework/react/deployment
{
  const app = builder.addViteApp('tanstack-start', './frameworks/tanstack-start', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'TanStack Start')
    .publishAsNodeServer('.output/server/index.mjs', { outputPath: '.output' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('tanstack-start'); });
}

// Next.js standalone: https://github.com/vercel/next.js/tree/canary/examples/with-docker
{
  const app = builder.addViteApp('nextjs', './frameworks/nextjs', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Next.js')
    .publishAsNextStandalone()
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('nextjs'); });
}

// Remix: needs npm at runtime (react-router-serve is in node_modules)
// https://github.com/remix-run/react-router-templates/tree/main/node-custom-server
{
  const app = builder.addViteApp('remix', './frameworks/remix', { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', 'Remix')
    .publishAsNpmScript({ startScriptName: 'start', runScriptArguments: '-- --port "$PORT"' })
    .withExternalHttpEndpoints();
  await app.publishAsDockerComposeService(async (_r, s) => { await s.name.set('remix'); });
}

await builder.build().run();
