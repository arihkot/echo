/**
 * Echo Platform - Provider Configuration (SDK v3)
 *
 * Sets up all the Midnight SDK providers needed for contract interaction.
 * Bridges the Lace DApp Connector v4 wallet API into the SDK's
 * WalletProvider and MidnightProvider interfaces.
 *
 * Provider chain for transactions:
 *   Circuit call -> ZK proof generation (proofProvider)
 *   -> Transaction balancing (walletProvider.balanceTx via Lace)
 *   -> Transaction submission (midnightProvider.submitTx via Lace)
 */

import type { NetworkConfig, MidnightWalletAPI } from "../contract/types";

/**
 * Creates a fully configured MidnightProviders object for a specific contract.
 *
 * This function wires together:
 * - LevelDB private state storage (browser IndexedDB via level)
 * - Indexer-backed public data provider (reads on-chain state)
 * - Node-based ZK config provider (loads prover/verifier keys from disk)
 * - HTTP proof server (generates ZK proofs)
 * - Lace v4 wallet (balances and submits transactions)
 */
export async function configureProviders(options: {
  config: NetworkConfig;
  contractName: string;
  wallet: MidnightWalletAPI;
}) {
  const { config, contractName, wallet } = options;

  // Dynamic imports for tree-shaking and SSR compatibility
  const { httpClientProofProvider } = await import(
    "@midnight-ntwrk/midnight-js-http-client-proof-provider"
  );
  const { indexerPublicDataProvider } = await import(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );
  const { NodeZkConfigProvider } = await import(
    "@midnight-ntwrk/midnight-js-node-zk-config-provider"
  );
  const { levelPrivateStateProvider } = await import(
    "@midnight-ntwrk/midnight-js-level-private-state-provider"
  );

  const contractPath = `./contracts/managed/${contractName}`;

  // Get wallet addresses from Lace v4 DApp Connector.
  // Lace v4 uses getUnshieldedAddress() which returns { unshieldedAddress: string }.
  // The v3 SDK's WalletProvider needs getCoinPublicKey() and getEncryptionPublicKey() methods.
  const { unshieldedAddress } = await wallet.getUnshieldedAddress();

  // Build the wallet provider bridge (v3 interface uses getter methods, not properties)
  const walletProvider: any = {
    getCoinPublicKey() {
      return unshieldedAddress;
    },
    getEncryptionPublicKey() {
      // Lace v4 doesn't expose encryptionPublicKey; use address as fallback
      return unshieldedAddress;
    },
    async balanceTx(tx: any, ttl?: Date) {
      // Lace v4 wallet balances the transaction:
      // 1. Attaches DUST tokens for gas
      // 2. Signs the transaction
      // 3. Returns a balanced + proven transaction
      const balanced = await wallet.balanceUnsealedTransaction(tx);
      return balanced;
    },
  };

  const midnightProvider = {
    async submitTx(tx: any) {
      return wallet.submitTransaction(tx);
    },
  };

  const zkConfigProvider = new NodeZkConfigProvider(contractPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `echo-${contractName}-state`,
      walletProvider,
    }),

    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),

    zkConfigProvider,

    // v3: httpClientProofProvider requires both url and zkConfigProvider
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),

    walletProvider,

    midnightProvider,
  };
}

/**
 * Creates providers for read-only operations (no wallet needed).
 * Used for querying on-chain state without submitting transactions.
 */
export async function configureReadOnlyProviders(config: NetworkConfig) {
  const { indexerPublicDataProvider } = await import(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );

  return {
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
  };
}
