"use client";

import { useMemo, useEffect } from "react";
import { EchoAPI } from "@/src/dapp/api";
import { getConfig } from "@/src/dapp/config";
import { useAppStore } from "@/app/store";
import type { NetworkConfig } from "@/src/contract/types";

/**
 * Module-level singleton.
 * All components share the same EchoAPI instance so mutations
 * (onboard, payment, review, etc.) are visible across pages
 * without requiring a global state refresh.
 */
let _instance: EchoAPI | null = null;
let _instanceConfigKey: string | null = null;

function getOrCreateAPI(config: NetworkConfig, network: "testnet" | "mainnet" | "local" = "testnet"): EchoAPI {
  const key = `${config.indexer}|${config.node}|${config.proofServer}`;
  if (!_instance || _instanceConfigKey !== key) {
    _instance = new EchoAPI(config, network);
    _instanceConfigKey = key;
  }
  return _instance;
}

/**
 * Returns a shared EchoAPI singleton.
 *
 * If the Lace wallet is connected and provides serviceUriConfig,
 * those endpoints are used. Otherwise falls back to the default
 * testnet configuration from config.ts.
 *
 * When the wallet API is available (walletApi in store), it is
 * automatically passed to the EchoAPI instance via setWallet()
 * so that real blockchain transactions can be submitted.
 */
export function useEchoAPI(): EchoAPI {
  const serviceUriConfig = useAppStore((s) => s.wallet.serviceUriConfig);
  const walletApi = useAppStore((s) => s.walletApi);

  const api = useMemo(() => {
    let config: NetworkConfig;
    let network: "testnet" | "mainnet" | "local" = "testnet";

    if (serviceUriConfig) {
      config = {
        indexer: serviceUriConfig.indexerUri,
        indexerWS: serviceUriConfig.indexerWsUri,
        node: serviceUriConfig.substrateNodeUri,
        proofServer: serviceUriConfig.proverServerUri,
      };
      // Detect network from wallet config endpoints
      if (serviceUriConfig.indexerUri.includes("localhost") || serviceUriConfig.indexerUri.includes("127.0.0.1")) {
        network = "local";
      }
    } else {
      config = getConfig("testnet");
    }

    return getOrCreateAPI(config, network);
  }, [serviceUriConfig]);

  // Pass the wallet API to the EchoAPI instance when it becomes available
  useEffect(() => {
    if (walletApi && api) {
      api.setWallet(walletApi);
    }
  }, [walletApi, api]);

  return api;
}
