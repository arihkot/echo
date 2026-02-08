/**
 * Echo Platform - Contract Type Definitions
 *
 * Common types shared across the Echo DApp, derived from
 * the Compact compiler output and Midnight SDK patterns.
 */

// ============================================================
// Organization Contract Types
// ============================================================

export enum Role {
  ADMIN = "ADMIN",
  HR = "HR",
  EMPLOYEE = "EMPLOYEE",
  AUDITOR = "AUDITOR",
}

export enum OrgStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  DEACTIVATED = "DEACTIVATED",
}

export interface OrganizationLedgerState {
  orgAdmin: string;
  orgMetadataCommitment: string;
  status: OrgStatus;
  employeeCount: bigint;
  round: bigint;
}

export interface OrganizationPrivateState {
  adminSecretKey?: Uint8Array;
  hrSecretKey?: Uint8Array;
  employeeSecretKey?: Uint8Array;
  orgMetadata?: {
    name: string;
    industry: string;
    size: string;
    country: string;
  };
  metadataRandomness?: Uint8Array;
}

// ============================================================
// Salary Contract Types
// ============================================================

export interface SalaryPayment {
  employeePk: string;
  amount: bigint;
  period: bigint;
  randomness: Uint8Array;
  commitment: string;
}

export interface SalaryLedgerState {
  orgAdmin: string;
  totalPaymentsProcessed: bigint;
  totalPayrollAmount: bigint;
  currentPeriod: bigint;
  activeDisputes: bigint;
  salaryBands: {
    band1: bigint; // 0-5 LPA
    band2: bigint; // 5-15 LPA
    band3: bigint; // 15-30 LPA
    band4: bigint; // 30-50 LPA
    band5: bigint; // 50+ LPA
  };
  round: bigint;
}

export interface SalaryPrivateState {
  adminSecretKey?: Uint8Array;
  employeeSecretKey?: Uint8Array;
  payments: Map<string, SalaryPayment>; // commitment -> payment data
  reviewTokens: Map<string, ReviewToken>; // token commitment -> token data
}

export interface ReviewToken {
  employeeSk: Uint8Array;
  period: bigint;
  randomness: Uint8Array;
  commitment: string;
}

export interface SalaryRangeProof {
  lowerBound: bigint;
  upperBound: bigint;
  isValid: boolean;
}

// ============================================================
// Review Contract Types
// ============================================================

export enum ReviewCategory {
  WORK_CULTURE = "WORK_CULTURE",
  COMPENSATION = "COMPENSATION",
  MANAGEMENT = "MANAGEMENT",
  WORK_LIFE_BALANCE = "WORK_LIFE_BALANCE",
  CAREER_GROWTH = "CAREER_GROWTH",
  DIVERSITY_INCLUSION = "DIVERSITY_INCLUSION",
  GENERAL = "GENERAL",
}

export interface ReviewRatings {
  culture: number; // 1-5
  compensation: number; // 1-5
  management: number; // 1-5
  workLifeBalance: number; // 1-5
  careerGrowth: number; // 1-5
}

export interface ReviewSubmission {
  ratings: ReviewRatings;
  content: string;
  contentHash: string; // IPFS/Arweave CID
  period: bigint;
  timestamp: number;
}

export interface ReviewLedgerState {
  orgAdmin: string;
  totalReviews: bigint;
  currentReviewPeriod: bigint;
  round: bigint;
  ratingAggregates: {
    culture: RatingDistribution;
    compensation: RatingDistribution;
    management: RatingDistribution;
    workLifeBalance: RatingDistribution;
    careerGrowth: RatingDistribution;
  };
}

export interface RatingDistribution {
  rating1: bigint;
  rating2: bigint;
  rating3: bigint;
  rating4: bigint;
  rating5: bigint;
}

export interface ReviewPrivateState {
  adminSecretKey?: Uint8Array;
  employeeSecretKey?: Uint8Array;
  reviewTokens: Map<string, ReviewToken>;
  submittedReviews: ReviewSubmission[];
}

// ============================================================
// Deployment Types
// ============================================================

export interface EchoDeployment {
  organizationContractAddress: string;
  salaryContractAddress: string;
  reviewContractAddress: string;
  deployedAt: string;
  network: "testnet" | "mainnet" | "local";
  orgName: string;
}

// ============================================================
// Network Configuration
// ============================================================

export interface NetworkConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

export const TESTNET_CONFIG: NetworkConfig = {
  indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
  node: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300",
};

// ============================================================
// Wallet Types
// ============================================================

/**
 * Midnight Lace DApp Connector v4.0.0 wallet API shape.
 *
 * Defined locally because the installed @midnight-ntwrk/dapp-connector-api
 * types are v3.0.0 and don't match the actual Lace extension runtime (v4.0.0).
 *
 * IMPORTANT: The getter methods return **wrapper objects**, not raw values.
 * e.g. getUnshieldedAddress() -> { unshieldedAddress: string }
 *
 * Connector: window.midnight.mnLace.connect(networkId) -> Promise<MidnightWalletAPI>
 * Supported networks: "mainnet", "preprod", "preview", "qanet", "undeployed"
 */
export interface MidnightWalletAPI {
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getShieldedAddresses(): Promise<{ shieldedAddresses: string[] }>;
  getDustAddress(): Promise<{ dustAddress: string }>;
  getUnshieldedBalances(): Promise<unknown>;
  getShieldedBalances(): Promise<unknown>;
  getDustBalance(): Promise<unknown>;
  getConfiguration(): Promise<{
    networkId: string;
    indexerUri: string;
    indexerWsUri: string;
    proverServerUri: string;
    substrateNodeUri: string;
  }>;
  getConnectionStatus(): Promise<unknown>;
  submitTransaction(tx: unknown): Promise<unknown>;
  balanceUnsealedTransaction(tx: unknown): Promise<unknown>;
  balanceSealedTransaction(tx: unknown): Promise<unknown>;
  makeTransfer(params: unknown): Promise<unknown>;
  makeIntent(params: unknown): Promise<unknown>;
  signData(data: unknown): Promise<unknown>;
  getTxHistory(): Promise<unknown>;
}

/**
 * Echo wallet state derived from the Midnight DApp Connector API.
 *
 * Uses `window.midnight.mnLace` to interact with the Lace Midnight Preview
 * Chrome extension. See:
 * https://docs.midnight.network/api-reference/dapp-connector
 */
export interface EchoWalletState {
  /** Whether the DApp connector has been enabled (user authorized) */
  isConnected: boolean;
  /** Whether the Lace extension was detected in window.midnight */
  isLaceInstalled: boolean;
  /** Connection in progress */
  isConnecting: boolean;
  /** Wallet address from getUnshieldedAddress() */
  address: string;
  /** Last connection error message, if any */
  error: string | null;
  /**
   * Service URIs from the wallet's getConfiguration().
   * May be null if the wallet doesn't expose them.
   */
  serviceUriConfig: {
    indexerUri: string;
    indexerWsUri: string;
    proverServerUri: string;
    substrateNodeUri: string;
  } | null;
}

// ============================================================
// Analytics Types
// ============================================================

export interface OrgAnalytics {
  totalEmployees: bigint;
  totalPaymentsProcessed: bigint;
  totalReviews: bigint;
  averageRatings: {
    culture: number;
    compensation: number;
    management: number;
    workLifeBalance: number;
    careerGrowth: number;
    overall: number;
  };
  salaryDistribution: {
    band1: bigint;
    band2: bigint;
    band3: bigint;
    band4: bigint;
    band5: bigint;
  };
  reviewTrend: {
    period: bigint;
    count: bigint;
    averageRating: number;
  }[];
}
