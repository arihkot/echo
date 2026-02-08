/**
 * Echo Platform - Contract Deployment Script (SDK v3)
 *
 * Deploys all three Echo Compact contracts to a Midnight network.
 * Supports both local devnet and testnet.
 *
 * Usage:
 *   npm run deploy                  # deploys to local (default)
 *   npm run deploy -- --network testnet
 *
 * Prerequisites:
 * 1. Contracts compiled: npm run build:contracts
 * 2. For local network, Docker containers running:
 *    - Node:         midnightntwrk/midnight-node:0.20.1        (port 9944)
 *    - Proof server: bricktowers/proof-server:7.0.0             (port 6300)
 *    - Indexer:      midnightntwrk/indexer-standalone:3.0.0     (port 8088)
 * 3. For testnet, proof server running locally on port 6300
 * 4. Funded wallet seed (tNIGHT from faucet or local genesis)
 */

import { WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import { Buffer } from "buffer";
import * as Rx from "rxjs";
import { getConfig } from "./config.js";
import type {
  OrganizationPrivateState,
  SalaryPrivateState,
  ReviewPrivateState,
} from "../contract/types.js";
import {
  createOrganizationWitnesses,
  createSalaryWitnesses,
  createReviewWitnesses,
} from "../contract/witnesses.js";

// SDK v3 imports
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles, generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import type {
  WalletProvider,
  MidnightProvider,
} from "@midnight-ntwrk/midnight-js-types";

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: Needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

interface NetworkEndpoints {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { network: string } {
  const args = process.argv.slice(2);
  let network = "local";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--network" && args[i + 1]) {
      network = args[i + 1];
      i++;
    }
  }
  return { network };
}

// ---------------------------------------------------------------------------
// Console helpers
// ---------------------------------------------------------------------------

const formatBalance = (balance: bigint): string => balance.toLocaleString();

async function withStatus<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Pre-flight: verify services are reachable
// ---------------------------------------------------------------------------

async function checkService(name: string, url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { signal: controller.signal, method: "GET" });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function preflight(config: NetworkEndpoints) {
  console.log("[preflight] Checking services...");

  const checks = await Promise.all([
    checkService("Node", config.node),
    checkService("Indexer", config.indexer),
    checkService("Proof Server", config.proofServer),
  ]);

  const labels = ["Node", "Indexer", "Proof Server"];
  const urls = [config.node, config.indexer, config.proofServer];
  let allOk = true;

  for (let i = 0; i < checks.length; i++) {
    const status = checks[i] ? "OK" : "UNREACHABLE";
    console.log(`  ${labels[i].padEnd(14)} ${urls[i]}  [${status}]`);
    if (!checks[i]) allOk = false;
  }

  if (!allOk) {
    throw new Error(
      "One or more services are unreachable. Make sure your Docker containers are running.",
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Verify compiled contracts exist
// ---------------------------------------------------------------------------

function verifyCompiledContracts(contractsPath: string) {
  const names = ["organization", "salary", "review"];
  const missing: string[] = [];
  for (const name of names) {
    const indexPath = path.join(contractsPath, "managed", name, "contract", "index.js");
    if (!fs.existsSync(indexPath)) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Compiled contracts missing: ${missing.join(", ")}. Run: npm run build:contracts`,
    );
  }
}

// ---------------------------------------------------------------------------
// HD Wallet key derivation
// ---------------------------------------------------------------------------

function deriveKeysFromSeed(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") {
    throw new Error("Failed to initialize HDWallet from seed");
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== "keysDerived") {
    throw new Error("Failed to derive keys");
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
}

// ---------------------------------------------------------------------------
// Wallet sub-wallet config builders
// ---------------------------------------------------------------------------

function buildShieldedConfig(config: NetworkEndpoints) {
  return {
    networkId: getNetworkId(),
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, "ws")),
  };
}

function buildUnshieldedConfig(config: NetworkEndpoints) {
  return {
    networkId: getNetworkId(),
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  };
}

function buildDustConfig(config: NetworkEndpoints) {
  return {
    networkId: getNetworkId(),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, "ws")),
  };
}

// ---------------------------------------------------------------------------
// Wallet construction
// ---------------------------------------------------------------------------

async function buildWallet(config: NetworkEndpoints, seed: string): Promise<WalletContext> {
  const ctx = await withStatus("Building wallet from seed", async () => {
    const keys = deriveKeysFromSeed(seed);
    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

    const shieldedWallet = ShieldedWallet(buildShieldedConfig(config))
      .startWithSecretKeys(shieldedSecretKeys);
    const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config))
      .startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
    const dustWallet = DustWallet(buildDustConfig(config))
      .startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

    const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await wallet.start(shieldedSecretKeys, dustSecretKey);

    return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
  });

  // Show wallet address immediately
  console.log(`  Unshielded address: ${ctx.unshieldedKeystore.getBech32Address()}`);

  return ctx;
}

// ---------------------------------------------------------------------------
// Wallet sync & funding
// ---------------------------------------------------------------------------

async function waitForSyncAndFunds(ctx: WalletContext, isLocal: boolean) {
  const syncedState = await withStatus("Syncing with network", () =>
    Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
      ),
    ),
  );

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`  Balance: ${formatBalance(balance)} tNIGHT`);

  if (balance === 0n) {
    if (isLocal) {
      console.log("  Waiting for genesis funds...");
    } else {
      console.log("  Fund via https://faucet.preprod.midnight.network/");
      console.log("  Waiting for incoming tokens...");
    }

    const fundedBalance = await Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(10_000),
        Rx.filter((s) => s.isSynced),
        Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
        Rx.filter((b) => b > 0n),
      ),
    );
    console.log(`  Balance: ${formatBalance(fundedBalance)} tNIGHT`);
  }
}

// ---------------------------------------------------------------------------
// DUST registration and generation
// ---------------------------------------------------------------------------

async function registerForDustGeneration(ctx: WalletContext) {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  // Check if dust is already available
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.walletBalance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  // Only register coins that haven't been designated yet
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (nightUtxos.length === 0) {
    // All coins already registered — just wait for dust to generate
    await withStatus("Waiting for dust tokens to generate", () =>
      Rx.firstValueFrom(
        ctx.wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      ctx.unshieldedKeystore.getPublicKey(),
      (payload) => ctx.unshieldedKeystore.signData(payload),
    );
    const finalized = await ctx.wallet.finalizeRecipe(recipe);
    await ctx.wallet.submitTransaction(finalized);
  });

  // Wait for dust to actually generate
  await withStatus("Waiting for dust tokens to generate", () =>
    Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Intent signing workaround (v3 wallet SDK bug)
// ---------------------------------------------------------------------------

/**
 * Sign all unshielded offers in a transaction's intents, using the correct
 * proof marker for Intent.deserialize. This works around a bug in the wallet
 * SDK where signRecipe hardcodes 'pre-proof', which fails for proven
 * (UnboundTransaction) intents that contain 'proof' data.
 */
function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >(
      "signature",
      proofMarker,
      "pre-binding",
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}

// ---------------------------------------------------------------------------
// WalletProvider & MidnightProvider bridge
// ---------------------------------------------------------------------------

async function createWalletAndMidnightProvider(
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: ctx.shieldedSecretKeys,
          dustSecretKey: ctx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Work around wallet SDK bug: sign manually with correct proof markers
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      }

      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx: any) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { network } = parseArgs();
  const config = getConfig(network);
  const isLocal = network === "local";

  console.log("=".repeat(60));
  console.log("  Echo - Anonymous Salary & Workplace Transparency Platform");
  console.log(`  Deploying to: ${network}${isLocal ? " (undeployed)" : ""}`);
  console.log("=".repeat(60));
  console.log();

  // --------------------------------------------------------
  // Pre-flight checks
  // --------------------------------------------------------
  const contractsPath = path.join(process.cwd(), "contracts");
  verifyCompiledContracts(contractsPath);
  await preflight(config);

  // --------------------------------------------------------
  // Set network ID (v3 uses lowercase strings)
  // --------------------------------------------------------
  if (isLocal) {
    setNetworkId("undeployed");
    console.log("  NetworkId: undeployed");
  } else {
    setNetworkId("testnet");
    console.log("  NetworkId: testnet");
  }
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // --------------------------------------------------------
    // Step 1: Wallet Setup
    // --------------------------------------------------------
    console.log("[1/5] Wallet Setup");
    console.log("-".repeat(40));

    let walletSeed: string;

    if (isLocal) {
      // Local devnet has a well-known pre-funded genesis wallet seed.
      walletSeed = "0000000000000000000000000000000000000000000000000000000000000001";
      console.log("  Using genesis wallet seed (pre-funded on local devnet)");
    } else {
      const choice = await rl.question(
        "Do you have an existing wallet seed? (y/n): ",
      );

      if (choice.toLowerCase() === "y") {
        walletSeed = await rl.question("Enter your 64-character hex seed: ");
        walletSeed = walletSeed.trim();
        if (!/^[0-9a-fA-F]{64}$/.test(walletSeed)) {
          throw new Error("Seed must be exactly 64 hex characters");
        }
      } else {
        const seed = generateRandomSeed();
        walletSeed = Buffer.from(seed).toString("hex");
        console.log();
        console.log("  IMPORTANT: Save this seed securely!");
        console.log(`  Seed: ${walletSeed}`);
        console.log();
      }
    }

    // --------------------------------------------------------
    // Step 2: Network + Wallet Init (v3 wallet-sdk-facade)
    // --------------------------------------------------------
    console.log();
    console.log("[2/5] Connecting to network");
    console.log("-".repeat(40));
    console.log(`  Network:      ${network}`);
    console.log(`  Node:         ${config.node}`);
    console.log(`  Indexer:      ${config.indexer}`);
    console.log(`  Proof Server: ${config.proofServer}`);
    console.log();

    // Build wallet from seed using v3 wallet-sdk-facade
    const walletCtx = await buildWallet(config, walletSeed);

    // Wait for sync and check balance
    await waitForSyncAndFunds(walletCtx, isLocal);

    // Register NIGHT UTXOs for dust generation (required for tx fees)
    await registerForDustGeneration(walletCtx);
    console.log();

    // --------------------------------------------------------
    // Step 3: Organization Setup
    // --------------------------------------------------------
    console.log("[3/5] Organization Setup");
    console.log("-".repeat(40));

    const orgName = await rl.question("  Organization name: ");
    const orgIndustry = await rl.question(
      "  Industry (e.g., Technology, Finance): ",
    );
    console.log();

    // --------------------------------------------------------
    // Step 4: Deploy Contracts
    // --------------------------------------------------------
    console.log("[4/5] Deploying Contracts");
    console.log("-".repeat(40));

    // Create the wallet+midnight provider bridge
    const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletCtx);

    // Generate admin secret key
    const adminSk = new Uint8Array(32);
    crypto.getRandomValues(adminSk);
    const adminSkHex = Array.from(adminSk, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");

    // Org metadata commitment inputs
    const encoder = new TextEncoder();
    const metadataBytes = new Uint8Array(32);
    const metadataJson = encoder.encode(
      JSON.stringify({ name: orgName, industry: orgIndustry }),
    );
    metadataBytes.set(metadataJson.slice(0, 32));

    const metaRandomness = new Uint8Array(32);
    crypto.getRandomValues(metaRandomness);

    // Shared public data provider
    const publicDataProvider = indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    );

    // ---- Organization Contract ----
    console.log("  [1/3] Deploying organization contract...");
    const orgZkPath = path.join(contractsPath, "managed", "organization");
    const OrgModule = await import(
      path.join(orgZkPath, "contract", "index.js")
    );

    // Use withWitnesses — our contracts require witness functions (adminSecretKey, etc.)
    // that are called during the initialState constructor circuit.
    // Cast through any because dynamic imports lose the Contract generic parameter,
    // causing the conditional type in withWitnesses to resolve to 'never'.
    const orgCompiledContract = (CompiledContract.make(
      "organization",
      OrgModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createOrganizationWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, orgZkPath),
    );

    const orgZkConfigProvider = new NodeZkConfigProvider(orgZkPath);
    const orgProviders = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "echo-org-state",
        walletProvider: walletAndMidnightProvider,
      }),
      publicDataProvider,
      zkConfigProvider: orgZkConfigProvider,
      proofProvider: httpClientProofProvider(config.proofServer, orgZkConfigProvider),
      walletProvider: walletAndMidnightProvider,
      midnightProvider: walletAndMidnightProvider,
    };

    const orgInitialPrivateState: OrganizationPrivateState = {
      adminSecretKey: adminSk,
    };

    const orgDeployed = await deployContract(orgProviders, {
      compiledContract: orgCompiledContract,
      privateStateId: "echoOrgState",
      initialPrivateState: orgInitialPrivateState,
      args: [adminSk, metadataBytes, metaRandomness],
    } as any);

    const orgAddress = orgDeployed.deployTxData.public.contractAddress;
    console.log(`        Address: ${orgAddress}`);

    // ---- Salary Contract ----
    console.log("  [2/3] Deploying salary contract...");
    const salaryZkPath = path.join(contractsPath, "managed", "salary");
    const SalaryModule = await import(
      path.join(salaryZkPath, "contract", "index.js")
    );

    const salaryCompiledContract = (CompiledContract.make(
      "salary",
      SalaryModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createSalaryWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, salaryZkPath),
    );

    const salaryZkConfigProvider = new NodeZkConfigProvider(salaryZkPath);
    const salaryProviders = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "echo-salary-state",
        walletProvider: walletAndMidnightProvider,
      }),
      publicDataProvider,
      zkConfigProvider: salaryZkConfigProvider,
      proofProvider: httpClientProofProvider(config.proofServer, salaryZkConfigProvider),
      walletProvider: walletAndMidnightProvider,
      midnightProvider: walletAndMidnightProvider,
    };

    const salaryInitialPrivateState: SalaryPrivateState = {
      adminSecretKey: adminSk,
      payments: new Map(),
      reviewTokens: new Map(),
    };

    const salaryDeployed = await deployContract(salaryProviders, {
      compiledContract: salaryCompiledContract,
      privateStateId: "echoSalaryState",
      initialPrivateState: salaryInitialPrivateState,
      args: [adminSk],
    } as any);

    const salaryAddress = salaryDeployed.deployTxData.public.contractAddress;
    console.log(`        Address: ${salaryAddress}`);

    // ---- Review Contract ----
    console.log("  [3/3] Deploying review contract...");
    const reviewZkPath = path.join(contractsPath, "managed", "review");
    const ReviewModule = await import(
      path.join(reviewZkPath, "contract", "index.js")
    );

    const reviewCompiledContract = (CompiledContract.make(
      "review",
      ReviewModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createReviewWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, reviewZkPath),
    );

    const reviewZkConfigProvider = new NodeZkConfigProvider(reviewZkPath);
    const reviewProviders = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "echo-review-state",
        walletProvider: walletAndMidnightProvider,
      }),
      publicDataProvider,
      zkConfigProvider: reviewZkConfigProvider,
      proofProvider: httpClientProofProvider(config.proofServer, reviewZkConfigProvider),
      walletProvider: walletAndMidnightProvider,
      midnightProvider: walletAndMidnightProvider,
    };

    const reviewInitialPrivateState: ReviewPrivateState = {
      adminSecretKey: adminSk,
      reviewTokens: new Map(),
      submittedReviews: [],
    };

    const reviewDeployed = await deployContract(reviewProviders, {
      compiledContract: reviewCompiledContract,
      privateStateId: "echoReviewState",
      initialPrivateState: reviewInitialPrivateState,
      args: [adminSk],
    } as any);

    const reviewAddress = reviewDeployed.deployTxData.public.contractAddress;
    console.log(`        Address: ${reviewAddress}`);
    console.log();

    // --------------------------------------------------------
    // Step 5: Save Deployment Info
    // --------------------------------------------------------
    console.log("[5/5] Saving Deployment Info");
    console.log("-".repeat(40));

    const deployment = {
      network,
      orgName,
      orgIndustry,
      organizationContractAddress: orgAddress,
      salaryContractAddress: salaryAddress,
      reviewContractAddress: reviewAddress,
      deployedAt: new Date().toISOString(),
      adminSecretKeyHex: adminSkHex,
      walletSeed,
      note: "KEEP THIS FILE SECURE - contains admin keys and wallet seed",
    };

    fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
    console.log("  Saved to deployment.json");
    console.log();

    console.log("=".repeat(60));
    console.log("  Deployment complete!");
    console.log();
    console.log("  Organization: " + orgAddress);
    console.log("  Salary:       " + salaryAddress);
    console.log("  Review:       " + reviewAddress);
    console.log();
    console.log("  Run `npm run dev` to start the web interface.");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nDeployment failed:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
