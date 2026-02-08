import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // These packages contain WASM modules and node-only APIs.
  // serverExternalPackages keeps them out of the SSR bundle.
  serverExternalPackages: [
    "@midnight-ntwrk/compact-runtime",
    "@midnight-ntwrk/ledger",
    "@midnight-ntwrk/onchain-runtime",
    "@midnight-ntwrk/wallet",
    "@midnight-ntwrk/wallet-api",
    "@midnight-ntwrk/zswap",
    "@midnight-ntwrk/midnight-js-contracts",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
    "@midnight-ntwrk/midnight-js-level-private-state-provider",
    "@midnight-ntwrk/midnight-js-network-id",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider",
    "@midnight-ntwrk/midnight-js-types",
    "@midnight-ntwrk/dapp-connector-api",
  ],

  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for Midnight SDK packages
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM file handling rule
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    if (!isServer) {
      // Alias isomorphic-ws to our browser shim.
      // The real isomorphic-ws browser.js only has `export default WebSocket`
      // but @midnight-ntwrk packages do `import * as ws from 'isomorphic-ws'`
      // then `ws.WebSocket`, which needs a named export.
      config.resolve.alias = {
        ...config.resolve.alias,
        "isomorphic-ws": path.resolve(__dirname, "src/shims/isomorphic-ws.js"),
      };

      // Polyfill/ignore Node.js built-ins for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        child_process: false,
      };
    }

    return config;
  },
};

export default nextConfig;
