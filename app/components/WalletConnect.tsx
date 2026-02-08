"use client";

import { useEffect } from "react";
import { Wallet, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useAppStore } from "@/app/store";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import type { MidnightWalletAPI } from "@/src/contract/types";

const LACE_CHROME_URL =
  "https://chromewebstore.google.com/detail/lace-midnight-preview/hgeekaiplokcnmakghbdfbgnlfheichg";

// Midnight network to connect to.
// Lace supports: "mainnet", "preprod", "preview", "qanet", "undeployed"
// The Lace wallet must be configured for this network.
const MIDNIGHT_NETWORK = "undeployed";

/**
 * Lace Midnight DApp Connector v4.0.0
 *
 * Connector: window.midnight.mnLace
 *   connect(networkId) -> Promise<MidnightWalletAPI>
 *
 * API methods return wrapper objects, not raw values:
 *   getUnshieldedAddress()  -> { unshieldedAddress: string }
 *   getConfiguration()      -> { networkId, indexerUri, indexerWsUri, ... }
 */
interface MidnightConnector {
  name: string;
  apiVersion: string;
  icon: string;
  connect(networkId: string): Promise<MidnightWalletAPI>;
}

function getLaceConnector(): MidnightConnector | null {
  if (typeof window === "undefined") return null;
  const mn = (window as unknown as Record<string, unknown>).midnight as
    | Record<string, unknown>
    | undefined;
  if (!mn) return null;
  const lace = mn["mnLace"] as MidnightConnector | undefined;
  if (!lace || typeof lace.connect !== "function") return null;
  return lace;
}

export function WalletConnect() {
  const { wallet, setWallet, setWalletApi, disconnectWallet, addNotification } = useAppStore();

  // Detect Lace on mount (extension may inject after page load)
  useEffect(() => {
    const check = () => {
      if (getLaceConnector()) {
        setWallet({ isLaceInstalled: true });
      }
    };
    check();
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [setWallet]);

  const handleConnect = async () => {
    const connector = getLaceConnector();
    if (!connector) {
      setWallet({
        error: "Lace Midnight Preview wallet not detected. Please install the Chrome extension.",
      });
      addNotification({
        type: "error",
        title: "Wallet not found",
        message: "Install the Lace Midnight Preview extension for Chrome.",
      });
      return;
    }

    setWallet({ isConnecting: true, error: null });

    try {
      // v4 API: connect(networkId) returns wallet API (auto-approves on undeployed)
      const api = await connector.connect(MIDNIGHT_NETWORK);
      setWalletApi(api);

      // v4 returns wrapper objects: { unshieldedAddress: string }
      const { unshieldedAddress } = await api.getUnshieldedAddress();
      const address = unshieldedAddress;

      // Get service URIs from wallet configuration
      let serviceUriConfig = null;
      try {
        const config = await api.getConfiguration();
        serviceUriConfig = {
          indexerUri: config.indexerUri ?? "",
          indexerWsUri: config.indexerWsUri ?? "",
          proverServerUri: config.proverServerUri ?? "",
          substrateNodeUri: config.substrateNodeUri ?? "",
        };
      } catch {
        // non-fatal — wallet may not expose config
      }

      setWallet({
        isConnected: true,
        isConnecting: false,
        isLaceInstalled: true,
        address,
        serviceUriConfig,
        error: null,
      });

      addNotification({
        type: "success",
        title: "Wallet connected",
        message: `${address.slice(0, 16)}...${address.slice(-4)}`,
      });
    } catch (err: unknown) {
      console.error("[Echo] Wallet connection failed:", err);
      const message =
        err instanceof Error ? err.message : String(err);
      setWallet({
        isConnecting: false,
        isConnected: false,
        error: message,
      });
      addNotification({
        type: "error",
        title: "Connection failed",
        message,
      });
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    addNotification({
      type: "info",
      title: "Wallet disconnected",
    });
  };

  // --- Lace not installed ---
  if (!wallet.isLaceInstalled && !wallet.isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Wallet className="w-4 h-4" />}
          onClick={handleConnect}
        >
          Connect Wallet
        </Button>
        {wallet.error && (
          <a
            href={LACE_CHROME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-echo-accent hover:text-echo-accent/80 transition-colors"
          >
            Install Lace
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // --- Connecting ---
  if (wallet.isConnecting) {
    return (
      <Button variant="outline" size="sm" loading disabled>
        Connecting...
      </Button>
    );
  }

  // --- Not connected but Lace installed ---
  if (!wallet.isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Wallet className="w-4 h-4" />}
          onClick={handleConnect}
        >
          Connect Wallet
        </Button>
        {wallet.error && (
          <span className="flex items-center gap-1 text-xs text-echo-danger">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        )}
      </div>
    );
  }

  // --- Connected ---
  return (
    <div className="flex items-center gap-3">
      <Badge variant="success" dot>
        Lace
      </Badge>
      <button
        onClick={handleDisconnect}
        title={`Address: ${wallet.address}`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-echo-surface border border-echo-border
                   hover:border-echo-accent/30 transition-all duration-200 text-sm"
      >
        <span className="text-echo-muted font-mono text-xs">
          {wallet.address.slice(0, 10)}...{wallet.address.slice(-4)}
        </span>
        <CheckCircle className="w-3.5 h-3.5 text-echo-success" />
      </button>
    </div>
  );
}
