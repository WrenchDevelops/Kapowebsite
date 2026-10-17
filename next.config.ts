import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/search", destination: "/", permanent: false }];
  },
};

if (process.env.VERCEL) {
  const workersEnv = path.join(root, "lib/workers-env.ts");
  const stub = path.join(root, "lib/cloudflare-workers-stub.ts");
  nextConfig.webpack = (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      [workersEnv]: stub,
    };
    config.module.rules.push({
      test: /\.sql$/,
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  };
  nextConfig.turbopack = {
    resolveAlias: {
      "./lib/workers-env.ts": "./lib/cloudflare-workers-stub.ts",
      "../workers-env.ts": "./lib/cloudflare-workers-stub.ts",
      "../lib/workers-env.ts": "./lib/cloudflare-workers-stub.ts",
    },
  };
}

export default nextConfig;
