/**
 * Echo Platform - DApp API
 *
 * High-level API for interacting with Echo's three Compact contracts
 * deployed on the Midnight blockchain.
 *
 * Architecture:
 * - Contracts are deployed once (deploy flow) or connected to (reconnect flow)
 * - Each mutation (onboard, payment, review) calls the corresponding
 *   circuit via `callTx`, which generates ZK proofs and submits on-chain
 * - Read operations query the indexer for current on-chain state
 * - The Lace v4 wallet handles transaction balancing and submission
 *
 * The API preserves the same public interface as the previous mock
 * implementation so all frontend pages work unchanged.
 */

import type {
  EchoDeployment,
  ReviewRatings,
  OrganizationLedgerState,
  SalaryLedgerState,
  ReviewLedgerState,
  OrgAnalytics,
  NetworkConfig,
  MidnightWalletAPI,
  OrganizationPrivateState,
  SalaryPrivateState,
  ReviewPrivateState,
  RatingDistribution,
} from "../contract/types";

// NOTE: Witnesses and providers are imported dynamically to avoid
// pulling WASM-heavy @midnight-ntwrk packages into the webpack bundle
// at static analysis time. All SDK imports happen lazily when methods
// are actually called at runtime.

// ============================================================
// Published Review Type (stored off-chain, indexed by content hash)
// ============================================================

export interface PublishedReview {
  id: string;
  anonId: string;
  date: string;
  period: number;
  ratings: ReviewRatings;
  content: string;
  verified: boolean;
}

export interface PeriodTrend {
  period: number;
  payments: number;
  reviews: number;
  avgRating: number;
}

// ============================================================
// Internal types for deployed contract handles
// ============================================================

interface DeployedContractHandle {
  callTx: Record<string, (...args: any[]) => Promise<any>>;
  deployTxData: {
    public: {
      contractAddress: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

// ============================================================
// Local simulation state
// ============================================================
// When no blockchain deployment is configured, the API operates
// in "local" mode using in-memory state. This allows the frontend
// to be fully interactive for demos and development. Once a real
// deployment is connected, all reads/writes go on-chain instead.

interface LocalOrgState {
  employeeCount: number;
  hrOperatorCount: number;
  auditorCount: number;
  round: number;
  status: string;
  employees: string[];
  hrOperators: string[];
}

interface LocalSalaryState {
  totalPaymentsProcessed: number;
  totalPayrollAmount: number;
  currentPeriod: number;
  activeDisputes: number;
  bands: [number, number, number, number, number];
  round: number;
}

interface LocalReviewState {
  totalReviews: number;
  currentReviewPeriod: number;
  round: number;
  ratingCounters: {
    culture: [number, number, number, number, number];
    compensation: [number, number, number, number, number];
    management: [number, number, number, number, number];
    workLifeBalance: [number, number, number, number, number];
    careerGrowth: [number, number, number, number, number];
  };
}

function makeDefaultLocalOrg(): LocalOrgState {
  return {
    employeeCount: 0,
    hrOperatorCount: 0,
    auditorCount: 0,
    round: 0,
    status: "ACTIVE",
    employees: [],
    hrOperators: [],
  };
}

function makeDefaultLocalSalary(): LocalSalaryState {
  return {
    totalPaymentsProcessed: 0,
    totalPayrollAmount: 0,
    currentPeriod: 1,
    activeDisputes: 0,
    bands: [0, 0, 0, 0, 0],
    round: 0,
  };
}

function makeDefaultLocalReview(): LocalReviewState {
  return {
    totalReviews: 0,
    currentReviewPeriod: 1,
    round: 0,
    ratingCounters: {
      culture: [0, 0, 0, 0, 0],
      compensation: [0, 0, 0, 0, 0],
      management: [0, 0, 0, 0, 0],
      workLifeBalance: [0, 0, 0, 0, 0],
      careerGrowth: [0, 0, 0, 0, 0],
    },
  };
}

// ============================================================
// localStorage persistence for local simulation
// ============================================================

const LOCAL_STORAGE_KEY = "echo_local_state";

interface PersistedLocalState {
  org: LocalOrgState;
  salary: LocalSalaryState;
  review: LocalReviewState;
  publishedReviews: PublishedReview[];
  periodTrends: PeriodTrend[];
  nextAnonId: number;
}

function saveLocalState(state: PersistedLocalState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}

function loadLocalState(): PersistedLocalState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLocalState;
    // Basic shape validation
    if (parsed.org && parsed.salary && parsed.review && Array.isArray(parsed.publishedReviews)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Echo API Class
// ============================================================

export class EchoAPI {
  private config: NetworkConfig;
  private network: "testnet" | "mainnet" | "local";
  private wallet: MidnightWalletAPI | null = null;
  private deployment: EchoDeployment | null = null;

  // Deployed contract handles (set after deploy or connect)
  private orgContract: DeployedContractHandle | null = null;
  private salaryContract: DeployedContractHandle | null = null;
  private reviewContract: DeployedContractHandle | null = null;

  // Contract modules (loaded lazily)
  private orgModule: any = null;
  private salaryModule: any = null;
  private reviewModule: any = null;

  // Providers for each contract
  private orgProviders: any = null;
  private salaryProviders: any = null;
  private reviewProviders: any = null;

  // Published reviews (off-chain storage — would use IPFS/Arweave in full production)
  // For now we maintain a local cache that persists for the session
  private _publishedReviews: PublishedReview[] = [];
  private _nextAnonId = 1;

  // Period trends (derived from on-chain data snapshots)
  private _periodTrends: PeriodTrend[] = [];

  // Local simulation state (used when no deployment is configured)
  private _localOrg: LocalOrgState = makeDefaultLocalOrg();
  private _localSalary: LocalSalaryState = makeDefaultLocalSalary();
  private _localReview: LocalReviewState = makeDefaultLocalReview();

  constructor(config: NetworkConfig, network: "testnet" | "mainnet" | "local" = "testnet") {
    this.config = config;
    this.network = network;
    // Restore persisted local state if available
    const persisted = loadLocalState();
    if (persisted) {
      this._localOrg = persisted.org;
      this._localSalary = persisted.salary;
      this._localReview = persisted.review;
      this._publishedReviews = persisted.publishedReviews;
      this._periodTrends = persisted.periodTrends;
      this._nextAnonId = persisted.nextAnonId ?? 1;
    }
  }

  /** Persist all local simulation state to localStorage */
  private _persistLocal(): void {
    saveLocalState({
      org: this._localOrg,
      salary: this._localSalary,
      review: this._localReview,
      publishedReviews: this._publishedReviews,
      periodTrends: this._periodTrends,
      nextAnonId: this._nextAnonId,
    });
  }

  /** Returns the current network config. */
  getConfig(): NetworkConfig {
    return this.config;
  }

  /** Whether contracts are deployed and connected on-chain */
  isDeployed(): boolean {
    return this.deployment !== null;
  }

  /**
   * Set the Lace wallet API instance.
   * Must be called before any transaction-submitting operations.
   */
  setWallet(wallet: MidnightWalletAPI) {
    this.wallet = wallet;
  }

  /** Check if wallet is configured */
  hasWallet(): boolean {
    return this.wallet !== null;
  }

  // ----------------------------------------------------------
  // Contract Module Loading
  // ----------------------------------------------------------

  private async loadContractModules() {
    if (!this.orgModule) {
      this.orgModule = await import(
        /* webpackIgnore: true */
        "../../contracts/managed/organization/contract/index.js"
      );
    }
    if (!this.salaryModule) {
      this.salaryModule = await import(
        /* webpackIgnore: true */
        "../../contracts/managed/salary/contract/index.js"
      );
    }
    if (!this.reviewModule) {
      this.reviewModule = await import(
        /* webpackIgnore: true */
        "../../contracts/managed/review/contract/index.js"
      );
    }
  }

  // ----------------------------------------------------------
  // Provider Setup
  // ----------------------------------------------------------

  private async setupProviders() {
    if (!this.wallet) {
      throw new Error("Wallet not connected. Call setWallet() first.");
    }

    const { configureProviders } = await import("./providers");

    if (!this.orgProviders) {
      this.orgProviders = await configureProviders({
        config: this.config,
        contractName: "organization",
        wallet: this.wallet,
      });
    }
    if (!this.salaryProviders) {
      this.salaryProviders = await configureProviders({
        config: this.config,
        contractName: "salary",
        wallet: this.wallet,
      });
    }
    if (!this.reviewProviders) {
      this.reviewProviders = await configureProviders({
        config: this.config,
        contractName: "review",
        wallet: this.wallet,
      });
    }
  }

  // ----------------------------------------------------------
  // Deployment
  // ----------------------------------------------------------

  /**
   * Deploy all three Echo contracts for a new organization.
   *
   * Flow:
   * 1. Load compiled contract modules
   * 2. Configure providers for each contract
   * 3. Deploy organization contract (sets admin, creates employee tree)
   * 4. Deploy salary contract (links to org admin)
   * 5. Deploy review contract (links to org admin)
   * 6. Return deployment addresses
   */
  async deployOrganization(params: {
    adminSecretKey: Uint8Array;
    orgMetadata: { name: string; industry: string; size: string; country: string };
    walletSeed: string;
  }): Promise<EchoDeployment> {
    const { deployContract } = await import(
      /* webpackIgnore: true */
      "@midnight-ntwrk/midnight-js-contracts"
    );
    const { CompiledContract } = await import(
      /* webpackIgnore: true */
      "@midnight-ntwrk/compact-js"
    );
    const {
      createOrganizationWitnesses,
      createSalaryWitnesses,
      createReviewWitnesses,
    } = await import("../contract/witnesses");

    await this.loadContractModules();
    await this.setupProviders();

    console.log(`Deploying Echo contracts for: ${params.orgMetadata.name}`);

    // Create metadata bytes and randomness for the org contract constructor
    const encoder = new TextEncoder();
    const metadataBytes = new Uint8Array(32);
    const metadataJson = encoder.encode(JSON.stringify(params.orgMetadata));
    metadataBytes.set(metadataJson.slice(0, 32));

    const metaRandomness = new Uint8Array(32);
    crypto.getRandomValues(metaRandomness);

    // Initial private states
    const orgPrivateState: OrganizationPrivateState = {
      adminSecretKey: params.adminSecretKey,
    };

    const salaryPrivateState: SalaryPrivateState = {
      adminSecretKey: params.adminSecretKey,
      payments: new Map(),
      reviewTokens: new Map(),
    };

    const reviewPrivateState: ReviewPrivateState = {
      adminSecretKey: params.adminSecretKey,
      reviewTokens: new Map(),
      submittedReviews: [],
    };

    // v3: Use CompiledContract.make().pipe(withWitnesses, withCompiledFileAssets)
    // instead of new Contract(witnesses). Our contracts need actual witnesses
    // because the initialState constructor circuit calls them (e.g., adminSecretKey).
    // Cast through any because dynamic imports lose the Contract generic parameter.
    const orgZkPath = `./contracts/managed/organization`;
    const salaryZkPath = `./contracts/managed/salary`;
    const reviewZkPath = `./contracts/managed/review`;

    // Step 1: Deploy organization contract
    // Constructor: initialState(context, sk, metadata, metaRand)
    console.log("Step 1/3: Deploying organization contract...");
    const orgCompiledContract = (CompiledContract.make(
      "organization",
      this.orgModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createOrganizationWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, orgZkPath),
    );

    const orgDeployed = await deployContract(this.orgProviders, {
      compiledContract: orgCompiledContract,
      privateStateId: "echoOrgState",
      initialPrivateState: orgPrivateState,
      args: [params.adminSecretKey, metadataBytes, metaRandomness],
    } as any);
    console.log(`  Organization: ${orgDeployed.deployTxData.public.contractAddress}`);

    // Step 2: Deploy salary contract
    // Constructor: initialState(context, sk)
    console.log("Step 2/3: Deploying salary contract...");
    const salaryCompiledContract = (CompiledContract.make(
      "salary",
      this.salaryModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createSalaryWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, salaryZkPath),
    );

    const salaryDeployed = await deployContract(this.salaryProviders, {
      compiledContract: salaryCompiledContract,
      privateStateId: "echoSalaryState",
      initialPrivateState: salaryPrivateState,
      args: [params.adminSecretKey],
    } as any);
    console.log(`  Salary: ${salaryDeployed.deployTxData.public.contractAddress}`);

    // Step 3: Deploy review contract
    // Constructor: initialState(context, sk)
    console.log("Step 3/3: Deploying review contract...");
    const reviewCompiledContract = (CompiledContract.make(
      "review",
      this.reviewModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createReviewWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, reviewZkPath),
    );

    const reviewDeployed = await deployContract(this.reviewProviders, {
      compiledContract: reviewCompiledContract,
      privateStateId: "echoReviewState",
      initialPrivateState: reviewPrivateState,
      args: [params.adminSecretKey],
    } as any);
    console.log(`  Review: ${reviewDeployed.deployTxData.public.contractAddress}`);

    // Store contract handles
    this.orgContract = orgDeployed;
    this.salaryContract = salaryDeployed;
    this.reviewContract = reviewDeployed;

    const deployment: EchoDeployment = {
      organizationContractAddress: orgDeployed.deployTxData.public.contractAddress,
      salaryContractAddress: salaryDeployed.deployTxData.public.contractAddress,
      reviewContractAddress: reviewDeployed.deployTxData.public.contractAddress,
      deployedAt: new Date().toISOString(),
      network: this.network,
      orgName: params.orgMetadata.name,
    };

    this.deployment = deployment;
    return deployment;
  }

  /**
   * Connect to existing deployed contracts.
   * Uses findDeployedContract to reconnect with the on-chain state.
   */
  async connectToDeployment(deployment: EchoDeployment): Promise<void> {
    const { findDeployedContract } = await import(
      "@midnight-ntwrk/midnight-js-contracts"
    );
    const { CompiledContract } = await import(
      /* webpackIgnore: true */
      "@midnight-ntwrk/compact-js"
    );
    const {
      createOrganizationWitnesses,
      createSalaryWitnesses,
      createReviewWitnesses,
    } = await import("../contract/witnesses");

    await this.loadContractModules();
    await this.setupProviders();

    this.deployment = deployment;

    console.log(`Connecting to Echo deployment for: ${deployment.orgName}`);

    // v3: Use CompiledContract.make().pipe(withWitnesses, withCompiledFileAssets)
    // Our contracts require actual witnesses because circuit transitions call
    // witness functions (adminSecretKey, hrSecretKey, etc.).
    // Cast through any because dynamic imports lose the Contract generic parameter,
    // causing the conditional type in withWitnesses to resolve to 'never'.
    const orgZkPath = `./contracts/managed/organization`;
    const salaryZkPath = `./contracts/managed/salary`;
    const reviewZkPath = `./contracts/managed/review`;

    // Reconnect to each contract using its address
    const orgCompiledContract = (CompiledContract.make(
      "organization",
      this.orgModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createOrganizationWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, orgZkPath),
    );

    this.orgContract = await findDeployedContract(this.orgProviders, {
      compiledContract: orgCompiledContract,
      contractAddress: deployment.organizationContractAddress,
      privateStateId: "echoOrgState",
    } as any);

    const salaryCompiledContract = (CompiledContract.make(
      "salary",
      this.salaryModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createSalaryWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, salaryZkPath),
    );

    this.salaryContract = await findDeployedContract(this.salaryProviders, {
      compiledContract: salaryCompiledContract,
      contractAddress: deployment.salaryContractAddress,
      privateStateId: "echoSalaryState",
    } as any);

    const reviewCompiledContract = (CompiledContract.make(
      "review",
      this.reviewModule.Contract,
    ) as any).pipe(
      (self: any) => (CompiledContract as any).withWitnesses(self, createReviewWitnesses()),
      (self: any) => (CompiledContract as any).withCompiledFileAssets(self, reviewZkPath),
    );

    this.reviewContract = await findDeployedContract(this.reviewProviders, {
      compiledContract: reviewCompiledContract,
      contractAddress: deployment.reviewContractAddress,
      privateStateId: "echoReviewState",
    } as any);

    console.log("Connected to all three contracts.");
  }

  // ----------------------------------------------------------
  // Ledger State Reading
  // ----------------------------------------------------------

  /**
   * Read the organization contract's on-chain ledger state.
   * Uses the indexer to fetch the current state and the compiled
   * ledger() parser to decode it into typed fields.
   */
  private async readOrgLedger() {
    this.ensureDeployed();
    const stateValue = await this.orgProviders.publicDataProvider.queryContractState(
      this.deployment!.organizationContractAddress,
    );
    if (!stateValue) {
      throw new Error("Organization contract state not found on-chain");
    }
    return this.orgModule.ledger(stateValue);
  }

  private async readSalaryLedger() {
    this.ensureDeployed();
    const stateValue = await this.salaryProviders.publicDataProvider.queryContractState(
      this.deployment!.salaryContractAddress,
    );
    if (!stateValue) {
      throw new Error("Salary contract state not found on-chain");
    }
    return this.salaryModule.ledger(stateValue);
  }

  private async readReviewLedger() {
    this.ensureDeployed();
    const stateValue = await this.reviewProviders.publicDataProvider.queryContractState(
      this.deployment!.reviewContractAddress,
    );
    if (!stateValue) {
      throw new Error("Review contract state not found on-chain");
    }
    return this.reviewModule.ledger(stateValue);
  }

  // ----------------------------------------------------------
  // Organization Operations
  // ----------------------------------------------------------

  /**
   * Register a new HR operator.
   * Requires admin authentication (proves admin key knowledge via ZK).
   */
  async addHrOperator(hrPublicKey: string): Promise<string> {
    if (!this.deployment) {
      // Local simulation
      this._localOrg.hrOperators.push(hrPublicKey);
      this._localOrg.hrOperatorCount++;
      this._localOrg.round++;
      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    const hrPkBytes = hexToBytes(hrPublicKey);
    const result = await this.orgContract!.callTx.addHrOperator(hrPkBytes);
    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Onboard a new employee.
   * Requires HR authentication (proves HR membership via MerkleTree).
   * The employee commitment is added to the employee tree.
   */
  async onboardEmployee(employeeCommitment: string): Promise<string> {
    if (!this.deployment) {
      // Local simulation
      this._localOrg.employees.push(employeeCommitment);
      this._localOrg.employeeCount++;
      this._localOrg.round++;
      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    const commitmentBytes = hexToBytes(employeeCommitment);
    const result = await this.orgContract!.callTx.onboardEmployee(commitmentBytes);
    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Offboard an employee by submitting their nullifier.
   * Requires HR authentication.
   */
  async offboardEmployee(employeeNullifier: string): Promise<string> {
    if (!this.deployment) {
      // Local simulation
      if (this._localOrg.employeeCount > 0) {
        this._localOrg.employeeCount--;
      }
      this._localOrg.round++;
      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    const nullifierBytes = hexToBytes(employeeNullifier);
    const result = await this.orgContract!.callTx.offboardEmployee(nullifierBytes);
    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Prove current employment status.
   * Employee proves membership in tree AND non-revocation.
   */
  async proveEmployment(): Promise<boolean> {
    if (!this.deployment) {
      // Local simulation — always succeeds
      return true;
    }

    await this.orgContract!.callTx.proveEmployment();
    return true;
  }

  /**
   * Get organization ledger state.
   * Reads directly from the on-chain ledger via the indexer.
   */
  async getOrganizationState(): Promise<OrganizationLedgerState & { hrOperatorCount: number; auditorCount: number }> {
    if (!this.deployment) {
      // Local simulation mode
      return {
        orgAdmin: "0".repeat(64),
        orgMetadataCommitment: "0".repeat(64),
        status: this._localOrg.status as any,
        employeeCount: BigInt(this._localOrg.employeeCount),
        round: BigInt(this._localOrg.round),
        hrOperatorCount: this._localOrg.hrOperatorCount,
        auditorCount: this._localOrg.auditorCount,
      };
    }

    const ledger = await this.readOrgLedger();

    // Map on-chain status number to enum string
    const statusMap: Record<number, string> = { 1: "ACTIVE", 2: "SUSPENDED", 3: "DEACTIVATED" };

    return {
      orgAdmin: bytesToHex(ledger.orgAdmin),
      orgMetadataCommitment: bytesToHex(ledger.orgMetadataCommitment),
      status: (statusMap[ledger.status] ?? "ACTIVE") as any,
      employeeCount: ledger.employeeCount,
      round: ledger.round,
      // HR and auditor counts derived from tree state
      hrOperatorCount: Number(ledger.hrOperators.firstFree()),
      auditorCount: Number(ledger.auditors.firstFree()),
    };
  }

  // ----------------------------------------------------------
  // Salary Operations
  // ----------------------------------------------------------

  /**
   * Process a salary payment.
   * Admin/HR creates a commitment from the salary data and stores it on-chain.
   * The actual amount stays private — only the salary band is public.
   */
  async processSalaryPayment(params: {
    employeePublicKey: string;
    amount: bigint;
    period: bigint;
    salaryBand: number;
  }): Promise<string> {
    if (!this.deployment) {
      // Local simulation
      const s = this._localSalary;
      s.totalPaymentsProcessed++;
      s.totalPayrollAmount += Number(params.amount);
      // Increment the appropriate salary band counter (1-indexed)
      const bandIdx = Math.max(0, Math.min(4, params.salaryBand - 1));
      s.bands[bandIdx]++;
      s.round++;
      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    const empCommitmentBytes = hexToBytes(params.employeePublicKey);
    const salaryBand = BigInt(params.salaryBand);

    const result = await this.salaryContract!.callTx.processSalaryPayment(
      empCommitmentBytes,
      salaryBand,
    );
    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Confirm salary receipt (employee side).
   * Employee proves they know the preimage of a payment commitment.
   * Also receives a review token.
   */
  async confirmSalaryReceipt(): Promise<{ txId: string; reviewTokenIssued: boolean }> {
    if (!this.deployment) {
      // Local simulation — always succeeds, always issues review token
      return {
        txId: "local_tx_" + Date.now().toString(16),
        reviewTokenIssued: true,
      };
    }

    const result = await this.salaryContract!.callTx.confirmSalaryReceipt();
    return {
      txId: result.public.txId ?? "tx_" + Date.now().toString(16),
      reviewTokenIssued: true,
    };
  }

  /**
   * Prove salary is within a range.
   * Enables pay transparency without revealing exact figures.
   */
  async proveSalaryRange(lowerBound: bigint, upperBound: bigint): Promise<boolean> {
    if (!this.deployment) {
      // Local simulation — always succeeds
      return true;
    }

    const result = await this.salaryContract!.callTx.proveSalaryRange(lowerBound, upperBound);
    return result.private?.result ?? true;
  }

  /**
   * Advance to a new payment period.
   * Requires admin authentication.
   * Also snapshots current period data into trends.
   */
  async advancePeriod(): Promise<string> {
    if (!this.deployment) {
      // Local simulation — snapshot current period into trends, then advance
      const s = this._localSalary;
      const r = this._localReview;
      const currentPeriodNum = s.currentPeriod;

      // Compute average rating from local counters
      const avgRating = this.computeLocalAvgRating();

      const existingIdx = this._periodTrends.findIndex((t) => t.period === currentPeriodNum);
      const trendEntry: PeriodTrend = {
        period: currentPeriodNum,
        payments: s.totalPaymentsProcessed,
        reviews: r.totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
      };

      if (existingIdx >= 0) {
        this._periodTrends[existingIdx] = trendEntry;
      } else {
        this._periodTrends.push(trendEntry);
      }

      s.currentPeriod++;
      s.round++;
      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    // On-chain: Snapshot current period into trends before advancing
    try {
      const salaryLedger = await this.readSalaryLedger();
      const reviewLedger = await this.readReviewLedger();
      const currentPeriodNum = Number(salaryLedger.currentPeriod);

      // Compute average rating from on-chain aggregates
      const avgRating = this.computeOverallAvgFromLedger(reviewLedger);

      const existingIdx = this._periodTrends.findIndex((t) => t.period === currentPeriodNum);
      const trendEntry: PeriodTrend = {
        period: currentPeriodNum,
        payments: Number(salaryLedger.totalPaymentsProcessed),
        reviews: Number(reviewLedger.totalReviews),
        avgRating: Math.round(avgRating * 10) / 10,
      };

      if (existingIdx >= 0) {
        this._periodTrends[existingIdx] = trendEntry;
      } else {
        this._periodTrends.push(trendEntry);
      }
    } catch (e) {
      console.warn("Failed to snapshot period trend:", e);
    }

    const result = await this.salaryContract!.callTx.advancePeriod();
    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Get salary contract state.
   * Reads directly from on-chain ledger.
   */
  async getSalaryState(): Promise<SalaryLedgerState> {
    if (!this.deployment) {
      // Local simulation mode
      const s = this._localSalary;
      return {
        orgAdmin: "0".repeat(64),
        totalPaymentsProcessed: BigInt(s.totalPaymentsProcessed),
        totalPayrollAmount: BigInt(s.totalPayrollAmount),
        currentPeriod: BigInt(s.currentPeriod),
        activeDisputes: BigInt(s.activeDisputes),
        salaryBands: {
          band1: BigInt(s.bands[0]),
          band2: BigInt(s.bands[1]),
          band3: BigInt(s.bands[2]),
          band4: BigInt(s.bands[3]),
          band5: BigInt(s.bands[4]),
        },
        round: BigInt(s.round),
      };
    }

    const ledger = await this.readSalaryLedger();

    return {
      orgAdmin: bytesToHex(ledger.orgAdmin),
      totalPaymentsProcessed: ledger.totalPaymentsProcessed,
      totalPayrollAmount: ledger.totalPayrollAmount,
      currentPeriod: ledger.currentPeriod,
      activeDisputes: ledger.activeDisputes,
      salaryBands: {
        band1: ledger.salaryBand1Count,
        band2: ledger.salaryBand2Count,
        band3: ledger.salaryBand3Count,
        band4: ledger.salaryBand4Count,
        band5: ledger.salaryBand5Count,
      },
      round: ledger.round,
    };
  }

  // ----------------------------------------------------------
  // Review Operations
  // ----------------------------------------------------------

  /**
   * Submit an anonymous review.
   * Employee proves they have a valid review token (from salary confirmation)
   * without revealing their identity.
   *
   * On-chain: stores content hash + increments rating counters.
   * Off-chain: stores full review text (would be IPFS/Arweave in production).
   */
  async submitReview(params: {
    ratings: ReviewRatings;
    content: string;
    contentHash: string;
  }): Promise<string> {
    if (!this.deployment) {
      // Local simulation — increment rating counters, store review off-chain
      const r = this._localReview;
      const { ratings } = params;

      // Increment each category's counter at the appropriate score index (1-indexed → 0-indexed)
      r.ratingCounters.culture[ratings.culture - 1]++;
      r.ratingCounters.compensation[ratings.compensation - 1]++;
      r.ratingCounters.management[ratings.management - 1]++;
      r.ratingCounters.workLifeBalance[ratings.workLifeBalance - 1]++;
      r.ratingCounters.careerGrowth[ratings.careerGrowth - 1]++;
      r.totalReviews++;
      r.round++;

      // Store review off-chain
      const review: PublishedReview = {
        id: "rev_" + Date.now().toString(16),
        anonId: `Anonymous Employee #${this._nextAnonId++}`,
        date: new Date().toISOString().split("T")[0],
        period: r.currentReviewPeriod,
        ratings: { ...ratings },
        content: params.content,
        verified: true,
      };
      this._publishedReviews.unshift(review);

      this._persistLocal();
      return "local_tx_" + Date.now().toString(16);
    }

    const contentHashBytes = hexToBytes(params.contentHash);

    // Call the review contract circuit with all 6 parameters
    const result = await this.reviewContract!.callTx.submitReview(
      contentHashBytes,
      BigInt(params.ratings.culture),
      BigInt(params.ratings.compensation),
      BigInt(params.ratings.management),
      BigInt(params.ratings.workLifeBalance),
      BigInt(params.ratings.careerGrowth),
    );

    // Store review off-chain for display
    // In production this would go to IPFS/Arweave with the content hash as key
    const review: PublishedReview = {
      id: "rev_" + Date.now().toString(16),
      anonId: `Anonymous Employee #${this._nextAnonId++}`,
      date: new Date().toISOString().split("T")[0],
      period: Number(
        (await this.readReviewLedger()).currentReviewPeriod,
      ),
      ratings: { ...params.ratings },
      content: params.content,
      verified: true,
    };
    this._publishedReviews.unshift(review);

    return result.public.txId ?? "tx_" + Date.now().toString(16);
  }

  /**
   * Get review contract state including rating aggregates.
   * Reads the 25 individual on-chain counters and maps them
   * to the ReviewLedgerState shape the frontend expects.
   */
  async getReviewState(): Promise<ReviewLedgerState> {
    if (!this.deployment) {
      // Local simulation mode
      const r = this._localReview;
      const toRatingDist = (arr: [number, number, number, number, number]) => ({
        rating1: BigInt(arr[0]),
        rating2: BigInt(arr[1]),
        rating3: BigInt(arr[2]),
        rating4: BigInt(arr[3]),
        rating5: BigInt(arr[4]),
      });
      return {
        orgAdmin: "0".repeat(64),
        totalReviews: BigInt(r.totalReviews),
        currentReviewPeriod: BigInt(r.currentReviewPeriod),
        round: BigInt(r.round),
        ratingAggregates: {
          culture: toRatingDist(r.ratingCounters.culture),
          compensation: toRatingDist(r.ratingCounters.compensation),
          management: toRatingDist(r.ratingCounters.management),
          workLifeBalance: toRatingDist(r.ratingCounters.workLifeBalance),
          careerGrowth: toRatingDist(r.ratingCounters.careerGrowth),
        },
      };
    }

    const ledger = await this.readReviewLedger();

    return {
      orgAdmin: bytesToHex(ledger.orgAdmin),
      totalReviews: ledger.totalReviews,
      currentReviewPeriod: ledger.currentReviewPeriod,
      round: ledger.round,
      ratingAggregates: {
        culture: {
          rating1: ledger.cultureRating1,
          rating2: ledger.cultureRating2,
          rating3: ledger.cultureRating3,
          rating4: ledger.cultureRating4,
          rating5: ledger.cultureRating5,
        },
        compensation: {
          rating1: ledger.compRating1,
          rating2: ledger.compRating2,
          rating3: ledger.compRating3,
          rating4: ledger.compRating4,
          rating5: ledger.compRating5,
        },
        management: {
          rating1: ledger.mgmtRating1,
          rating2: ledger.mgmtRating2,
          rating3: ledger.mgmtRating3,
          rating4: ledger.mgmtRating4,
          rating5: ledger.mgmtRating5,
        },
        workLifeBalance: {
          rating1: ledger.wlbRating1,
          rating2: ledger.wlbRating2,
          rating3: ledger.wlbRating3,
          rating4: ledger.wlbRating4,
          rating5: ledger.wlbRating5,
        },
        careerGrowth: {
          rating1: ledger.growthRating1,
          rating2: ledger.growthRating2,
          rating3: ledger.growthRating3,
          rating4: ledger.growthRating4,
          rating5: ledger.growthRating5,
        },
      },
    };
  }

  /**
   * Get published reviews.
   * Returns the local cache of review content.
   * In production, this would query IPFS/Arweave using
   * content hashes from the on-chain reviewHashes tree.
   */
  async getPublishedReviews(): Promise<PublishedReview[]> {
    return [...this._publishedReviews];
  }

  /**
   * Get period trend data for analytics.
   * Derived from snapshots taken at each period advance.
   */
  async getPeriodTrends(): Promise<PeriodTrend[]> {
    return [...this._periodTrends];
  }

  // ----------------------------------------------------------
  // Analytics
  // ----------------------------------------------------------

  /**
   * Get aggregated analytics for the organization.
   * All data is derived from public on-chain state.
   * No individual records are ever exposed.
   */
  async getAnalytics(): Promise<OrgAnalytics> {
    const orgState = await this.getOrganizationState();
    const salaryState = await this.getSalaryState();
    const reviewState = await this.getReviewState();

    return {
      totalEmployees: orgState.employeeCount,
      totalPaymentsProcessed: salaryState.totalPaymentsProcessed,
      totalReviews: reviewState.totalReviews,
      averageRatings: computeAverageRatings(reviewState),
      salaryDistribution: salaryState.salaryBands,
      reviewTrend: [],
    };
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private ensureDeployed(): void {
    if (!this.deployment) {
      throw new Error(
        "No deployment configured. Call deployOrganization() or connectToDeployment() first.",
      );
    }
  }

  /**
   * Compute overall average rating from local simulation counters.
   */
  private computeLocalAvgRating(): number {
    const r = this._localReview.ratingCounters;
    const categories = [r.culture, r.compensation, r.management, r.workLifeBalance, r.careerGrowth];

    let totalAvg = 0;
    let catCount = 0;
    for (const counters of categories) {
      const total = counters.reduce((a, b) => a + b, 0);
      if (total > 0) {
        const weighted = counters.reduce((sum, count, idx) => sum + count * (idx + 1), 0);
        totalAvg += weighted / total;
        catCount++;
      }
    }
    return catCount > 0 ? totalAvg / catCount : 0;
  }

  /**
   * Compute overall average rating from raw on-chain ledger counters.
   */
  private computeOverallAvgFromLedger(ledger: any): number {
    const categories = [
      [ledger.cultureRating1, ledger.cultureRating2, ledger.cultureRating3, ledger.cultureRating4, ledger.cultureRating5],
      [ledger.compRating1, ledger.compRating2, ledger.compRating3, ledger.compRating4, ledger.compRating5],
      [ledger.mgmtRating1, ledger.mgmtRating2, ledger.mgmtRating3, ledger.mgmtRating4, ledger.mgmtRating5],
      [ledger.wlbRating1, ledger.wlbRating2, ledger.wlbRating3, ledger.wlbRating4, ledger.wlbRating5],
      [ledger.growthRating1, ledger.growthRating2, ledger.growthRating3, ledger.growthRating4, ledger.growthRating5],
    ];

    let totalAvg = 0;
    let catCount = 0;
    for (const counters of categories) {
      const total = counters.reduce((a: bigint, b: bigint) => a + b, 0n);
      if (total > 0n) {
        const weighted = counters.reduce(
          (sum: bigint, count: bigint, idx: number) => sum + count * BigInt(idx + 1),
          0n,
        );
        totalAvg += Number(weighted) / Number(total);
        catCount++;
      }
    }
    return catCount > 0 ? totalAvg / catCount : 0;
  }
}

// ============================================================
// Helper Functions
// ============================================================

function computeAverageRatings(state: ReviewLedgerState) {
  const computeAvg = (dist: RatingDistribution) => {
    const total = dist.rating1 + dist.rating2 + dist.rating3 + dist.rating4 + dist.rating5;
    if (total === 0n) return 0;
    const weighted =
      dist.rating1 * 1n +
      dist.rating2 * 2n +
      dist.rating3 * 3n +
      dist.rating4 * 4n +
      dist.rating5 * 5n;
    return Number(weighted) / Number(total);
  };

  const agg = state.ratingAggregates;
  const culture = computeAvg(agg.culture);
  const compensation = computeAvg(agg.compensation);
  const management = computeAvg(agg.management);
  const workLifeBalance = computeAvg(agg.workLifeBalance);
  const careerGrowth = computeAvg(agg.careerGrowth);
  const overall = (culture + compensation + management + workLifeBalance + careerGrowth) / 5;

  return { culture, compensation, management, workLifeBalance, careerGrowth, overall };
}

/**
 * Generate a random 32-byte key for use as a secret key.
 */
export function generateSecretKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

/**
 * Convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert hex string to bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
