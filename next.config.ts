import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import "./app/shared/core/env";

// Importante (Windows/Turbopack): `process.cwd()` pode variar dependendo de como o Next
// inicializa workers/processos. Para resolução consistente de módulos, ancoramos na
// pasta onde este arquivo (`next.config.ts`) está localizado.
const projectRoot = (() => {
  // CJS
  if (typeof __dirname !== "undefined") {
    return path.resolve(__dirname);
  }

  // ESM fallback
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)));
})();
const isWindows = process.platform === "win32";
const buildStandalone = process.env.DOCKER_BUILD === "true" && !isWindows;
const enableSentryTunnel = process.env.SENTRY_TUNNEL_ROUTE === "true";

const nextConfig: NextConfig = {
  // Otimizações para produção
  reactStrictMode: true,

  // Evita warning de cross-origin em desenvolvimento ao acessar via IP da rede
  // (ex.: http://192.168.1.100:3000)
  allowedDevOrigins: ["192.168.1.100"],

  // Configuração de output
  // Para Docker: usar 'standalone' para build otimizado
  // Para Vercel: usar undefined (SSR por padrão)
  // Observação (Windows): o modo standalone tenta copiar arquivos traceados e pode falhar
  // com nomes como `node:inspector` (caractere ':' inválido no Windows), gerando warnings.
  output: buildStandalone ? "standalone" : undefined,

  // Otimizações de imagens
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // Compressão e otimizações
  compress: true,

  // Configurações de produção
  poweredByHeader: false,

  // Otimizações de bundle
  experimental: {
    optimizePackageImports: [
      "@radix-ui/react-accordion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "lucide-react",
    ],
    // Reduzir tamanho dos chunks
    optimizeCss: true,
  },

  // Configuração do Turbopack para tratar dependências opcionais
  turbopack: {
    resolveAlias: {
      // Stub vazio para dependências opcionais não utilizadas
      "@aws-sdk/client-s3": "@/lib/stubs/empty.js",
      // Compat: react-syntax-highlighter importa subpath legado do lowlight
      "lowlight/lib/core": "@/app/shared/library/compat/lowlight-core.js",
    },
  },

  // Configuração do Webpack para produção
  webpack: (config) => {
    // Garantir resolução a partir da raiz do projeto (evita bug com caminhos no Windows)
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.join(projectRoot, "node_modules"),
    ];
    // Ignorar dependências opcionais do unzipper
    config.resolve.alias = {
      ...config.resolve.alias,
      "@aws-sdk/client-s3": false,
      // Compat: react-syntax-highlighter importa subpath legado do lowlight
      "lowlight/lib/core": path.join(
        projectRoot,
        "app/shared/library/compat/lowlight-core.js",
      ),
    };

    // Ignorar módulos opcionais
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/unzipper/ },
    ];

    // Otimização de chunks para reduzir tamanho de assets e evitar buffering no Nginx
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          vendor: {
            name: "vendors",
            test: /node_modules/,
            priority: 10,
          },
          commons: {
            name: "commons",
            minChunks: 2,
          },
        },
      },
    };

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "sinesystech",

  project: "aluminify",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute:
    process.env.NODE_ENV === "production" && enableSentryTunnel
      ? "/monitoring"
      : undefined,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
