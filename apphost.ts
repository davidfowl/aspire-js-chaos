// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();
await builder.addDockerComposeEnvironment('compose');

const frameworks = [
  { name: 'vite', display: 'Vite', path: './frameworks/vite', publish: { kind: 'static' } },
  { name: 'react', display: 'React', path: './frameworks/react', publish: { kind: 'static' } },
  { name: 'vue', display: 'Vue', path: './frameworks/vue', publish: { kind: 'static' } },
  { name: 'astro', display: 'Astro', path: './frameworks/astro', publish: { kind: 'static' } },
  { name: 'nextjs', display: 'Next.js', path: './frameworks/nextjs', publish: { kind: 'node', runScript: 'start', runScriptArguments: '-- --hostname 0.0.0.0 --port "$PORT"' } },
  { name: 'nuxt', display: 'Nuxt', path: './frameworks/nuxt', publish: { kind: 'node', runScript: 'preview', runScriptArguments: '-- --port "$PORT"' } },
  { name: 'sveltekit', display: 'SvelteKit', path: './frameworks/sveltekit', publish: { kind: 'node', runScript: 'preview', runScriptArguments: '-- --host 0.0.0.0 --port "$PORT"' } },
  { name: 'tanstack-start', display: 'TanStack Start', path: './frameworks/tanstack-start', publish: { kind: 'node', runScript: 'preview', runScriptArguments: '-- --host 0.0.0.0 --port "$PORT"' } },
  { name: 'remix', display: 'Remix', path: './frameworks/remix', publish: { kind: 'node', runScript: 'start', runScriptArguments: '-- --port "$PORT"' } },
] as const;

for (const framework of frameworks) {
  const app = builder
    .addViteApp(framework.name, framework.path, { runScriptName: 'dev' })
    .withEnvironment('FRAMEWORK', framework.display);

  const publishableApp = (framework.publish.kind === 'static'
    ? app.publishAsStaticWebsite()
    : app.withNodeRuntimeDockerPublish({
      startScriptName: framework.publish.runScript,
      buildScriptName: 'build',
      runScriptArguments: framework.publish.runScriptArguments,
    }))
    .withExternalHttpEndpoints();

  await publishableApp.publishAsDockerComposeService(async (_resource, service) => {
    await service.name.set(framework.name);
  });
}

await builder.build().run();
