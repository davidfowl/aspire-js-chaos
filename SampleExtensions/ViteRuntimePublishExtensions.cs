using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.ApplicationModel.Docker;
using Aspire.Hosting.JavaScript;

namespace Aspire.Hosting;

public static class ViteRuntimePublishExtensions
{
    /// <summary>
    /// Publishes a Vite/JS app as a static website served by Caddy.
    /// Optionally proxies a single API path prefix to a backend endpoint.
    /// For more complex routing, use YARP with PublishWithStaticFiles instead.
    /// </summary>
    [AspireExport("publishAsStaticWebsite", Description = "Publishes a Vite app as a static website, optionally with an API proxy")]
    public static IResourceBuilder<ViteAppResource> PublishAsStaticWebsite(
        this IResourceBuilder<ViteAppResource> builder,
        bool spaFallback = true,
        string buildScriptName = "build",
        string? apiPath = null,
        EndpointReference? apiTarget = null)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentException.ThrowIfNullOrEmpty(buildScriptName);

        if (apiPath is not null && apiTarget is null)
            throw new ArgumentException("apiTarget is required when apiPath is specified.", nameof(apiTarget));
        if (apiTarget is not null && apiPath is null)
            throw new ArgumentException("apiPath is required when apiTarget is specified.", nameof(apiPath));

        var workingDirectory = builder.Resource.WorkingDirectory;

        // Wire the backend endpoint via standard Aspire WithReference
        string? proxyEnvVar = null;
        if (apiPath is not null && apiTarget is not null)
        {
            if (!apiPath.StartsWith('/'))
                apiPath = "/" + apiPath;

            builder.WithReference(apiTarget);
            proxyEnvVar = $"{apiTarget.Resource.Name.ToUpperInvariant()}_{apiTarget.EndpointName.ToUpperInvariant()}";
        }

        return builder.PublishAsDockerFile(container =>
        {
            foreach (var annotation in container.Resource.Annotations.OfType<DockerfileBuilderCallbackAnnotation>().ToArray())
                container.Resource.Annotations.Remove(annotation);

            container.WithDockerfileBuilder(workingDirectory, context =>
            {
                const string buildImage = "node:22-slim";
                const string runtimeImage = "caddy:2.7.4-alpine";

                context.Builder
                    .From(buildImage, "build")
                    .WorkDir("/app")
                    .Copy("package*.json", "./")
                    .Run("--mount=type=cache,target=/root/.npm npm ci")
                    .Copy(".", ".")
                    .Run($"npm run {buildScriptName}");

                context.Builder
                    .From(runtimeImage, "runtime")
                    .WorkDir("/srv")
                    .CopyFrom("build", "/app/dist", "/srv")
                    .CopyFrom("build", "/app/dist", "/app/dist")
                    .Run($"printf '%b' '{GetEscapedCaddyfile(spaFallback, apiPath, proxyEnvVar)}' > /etc/caddy/Caddyfile")
                    .Entrypoint(["caddy"])
                    .Cmd(["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]);
            });

            if (container.Resource.TryGetLastAnnotation<DockerfileBuildAnnotation>(out var a))
                a.HasEntrypoint = true;
            container.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
        });
    }

    [AspireExport("publishAsNodeServer", Description = "Publishes a JS app as a Node server running a built artifact directly")]
    public static IResourceBuilder<ViteAppResource> PublishAsNodeServer(
        this IResourceBuilder<ViteAppResource> builder,
        string entryPoint,
        string outputPath = ".",
        string buildScriptName = "build")
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentException.ThrowIfNullOrEmpty(entryPoint);
        ArgumentException.ThrowIfNullOrEmpty(buildScriptName);

        var workingDirectory = builder.Resource.WorkingDirectory;

        return builder.PublishAsDockerFile(container =>
        {
            foreach (var annotation in container.Resource.Annotations.OfType<DockerfileBuilderCallbackAnnotation>().ToArray())
                container.Resource.Annotations.Remove(annotation);

            container.WithDockerfileBuilder(workingDirectory, context =>
            {
                const string baseImage = "node:22-alpine";
                var normalizedOutput = NormalizePath(outputPath);
                var copySource = normalizedOutput == "." ? "/app" : $"/app/{normalizedOutput}";

                context.Builder
                    .From(baseImage, "build").EmptyLine().WorkDir("/app")
                    .Copy("package*.json", "./")
                    .Run("--mount=type=cache,target=/root/.npm npm ci")
                    .Copy(".", ".")
                    .Run($"npm run {buildScriptName}");

                context.Builder
                    .From(baseImage, "runtime").EmptyLine().WorkDir("/app")
                    .CopyFrom("build", copySource, copySource)
                    .EmptyLine()
                    .Env("NODE_ENV", "production").Env("HOST", "0.0.0.0").Env("HOSTNAME", "0.0.0.0")
                    .EmptyLine().User("node").EmptyLine()
                    .Entrypoint(["node", NormalizePath(entryPoint)]);
            });

            if (container.Resource.TryGetLastAnnotation<DockerfileBuildAnnotation>(out var a))
                a.HasEntrypoint = true;
            container.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
            foreach (var ann in container.Resource.Annotations.OfType<ContainerFilesSourceAnnotation>().ToArray())
                container.Resource.Annotations.Remove(ann);
        });
    }

    [AspireExport("publishAsNextStandalone", Description = "Publishes a Next.js app using standalone output")]
    public static IResourceBuilder<ViteAppResource> PublishAsNextStandalone(
        this IResourceBuilder<ViteAppResource> builder,
        string buildScriptName = "build")
    {
        ArgumentNullException.ThrowIfNull(builder);

        var workingDirectory = builder.Resource.WorkingDirectory;

        return builder.PublishAsDockerFile(container =>
        {
            foreach (var annotation in container.Resource.Annotations.OfType<DockerfileBuilderCallbackAnnotation>().ToArray())
                container.Resource.Annotations.Remove(annotation);

            container.WithDockerfileBuilder(workingDirectory, context =>
            {
                const string baseImage = "node:22-alpine";

                context.Builder
                    .From(baseImage, "build").EmptyLine().WorkDir("/app")
                    .Copy("package*.json", "./")
                    .Run("--mount=type=cache,target=/root/.npm npm ci")
                    .Copy(".", ".")
                    .Run($"npm run {buildScriptName}");

                context.Builder
                    .From(baseImage, "runtime").EmptyLine().WorkDir("/app")
                    .Env("NODE_ENV", "production").Env("HOSTNAME", "0.0.0.0")
                    .EmptyLine()
                    .CopyFrom("build", "/app/public", "./public")
                    .CopyFrom("build", "/app/.next/standalone", "./")
                    .CopyFrom("build", "/app/.next/static", "./.next/static")
                    .EmptyLine().User("node").EmptyLine()
                    .Entrypoint(["node", "server.js"]);
            });

            if (container.Resource.TryGetLastAnnotation<DockerfileBuildAnnotation>(out var a))
                a.HasEntrypoint = true;
            container.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
            foreach (var ann in container.Resource.Annotations.OfType<ContainerFilesSourceAnnotation>().ToArray())
                container.Resource.Annotations.Remove(ann);
        });
    }

    [AspireExport("publishAsNpmScript", Description = "Publishes a JS app using npm run at runtime")]
    public static IResourceBuilder<ViteAppResource> PublishAsNpmScript(
        this IResourceBuilder<ViteAppResource> builder,
        string startScriptName = "start",
        string buildScriptName = "build",
        string? runScriptArguments = null)
    {
        ArgumentNullException.ThrowIfNull(builder);

        var workingDirectory = builder.Resource.WorkingDirectory;

        return builder.PublishAsDockerFile(container =>
        {
            foreach (var annotation in container.Resource.Annotations.OfType<DockerfileBuilderCallbackAnnotation>().ToArray())
                container.Resource.Annotations.Remove(annotation);

            container.WithDockerfileBuilder(workingDirectory, context =>
            {
                const string baseImage = "node:22-alpine";
                var runCommand = string.IsNullOrWhiteSpace(runScriptArguments)
                    ? $"npm run {startScriptName}"
                    : $"npm run {startScriptName} {runScriptArguments}";

                context.Builder
                    .From(baseImage, "build").EmptyLine().WorkDir("/app")
                    .Copy("package*.json", "./")
                    .Run("--mount=type=cache,target=/root/.npm npm ci")
                    .Copy(".", ".")
                    .Run($"npm run {buildScriptName}");

                context.Builder
                    .From(baseImage, "runtime").EmptyLine().WorkDir("/app")
                    .CopyFrom("build", "/app", "/app")
                    .EmptyLine()
                    .Env("NODE_ENV", "production").Env("HOST", "0.0.0.0").Env("HOSTNAME", "0.0.0.0")
                    .EmptyLine().User("root").EmptyLine()
                    .Entrypoint(["sh", "-c", runCommand]);
            });

            if (container.Resource.TryGetLastAnnotation<DockerfileBuildAnnotation>(out var a))
                a.HasEntrypoint = true;
            container.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
            foreach (var ann in container.Resource.Annotations.OfType<ContainerFilesSourceAnnotation>().ToArray())
                container.Resource.Annotations.Remove(ann);
        });
    }

    private static string NormalizePath(string path)
    {
        var p = path.Replace('\\', '/');
        if (p.StartsWith("./", StringComparison.Ordinal)) p = p[2..];
        return p;
    }

    private static string GetEscapedCaddyfile(bool spaFallback, string? apiPath, string? proxyEnvVar)
    {
        var lines = new List<string>
        {
            "{",
            "    auto_https off",
            "}",
            "",
            ":{$PORT} {",
            "    tracing"
        };

        if (apiPath is not null && proxyEnvVar is not null)
        {
            // Use handle blocks so the API proxy takes priority
            lines.Add($"    handle {apiPath}/* {{");
            lines.Add($"        reverse_proxy {{${proxyEnvVar}}}");
            lines.Add("    }");
            lines.Add("    handle {");
            lines.Add("        root * /srv");
            lines.Add("        file_server");
            if (spaFallback)
            {
                lines.Add("        try_files {path} /index.html");
            }
            lines.Add("    }");
        }
        else
        {
            lines.Add("    root * /srv");
            lines.Add("    file_server");
            if (spaFallback)
            {
                lines.Add("    try_files {path} /index.html");
            }
        }

        lines.Add("}");

        return string.Join("\\n", lines) + "\\n";
    }
}
