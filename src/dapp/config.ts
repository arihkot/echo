/**
 * Echo Platform - Network Configuration
 *
 * Defines connection endpoints for different Midnight network environments.
 * Follows the pattern from Midnight's counter DApp example.
 */

import type { NetworkConfig } from "../contract/types.js";

export const configs: Record<string, NetworkConfig> = {
  testnet: {
    indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
    indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
    node: "https://rpc.testnet-02.midnight.network",
    proofServer: "http://127.0.0.1:6300",
  },

  local: {
    indexer: "http://localhost:8088/api/v3/graphql",
    indexerWS: "ws://localhost:8088/api/v3/graphql/ws",
    node: "http://localhost:9944",
    proofServer: "http://127.0.0.1:6300",
  },
};

export function getConfig(network: string = "testnet"): NetworkConfig {
  const config = configs[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}. Available: ${Object.keys(configs).join(", ")}`);
  }
  return config;
}
