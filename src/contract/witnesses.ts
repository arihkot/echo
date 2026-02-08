/**
 * Echo Platform - Witness Implementations
 *
 * Witnesses are functions that run locally on the user's machine,
 * providing private data to Compact circuits without exposing it
 * to the network. Each witness returns [privateState, value] tuples
 * as required by the Compact runtime.
 *
 * These implementations correspond to the `witness` declarations
 * in the Compact contracts and match the compiled contract type
 * signatures from contracts/managed/{org,salary,review}/contract/index.d.ts.
 */

import type {
  OrganizationPrivateState,
  SalaryPrivateState,
  ReviewPrivateState,
} from "./types";

// The compiled contracts use __compactRuntime.WitnessContext<Ledger, PS>
// which is { readonly ledger: L; readonly privateState: PS; readonly contractAddress: string }
// Witnesses must return [PS, value] tuples.

// ============================================================
// Organization Contract Witnesses
// ============================================================

/**
 * Organization contract witness implementations.
 * Matches the Witnesses<PS> type from contracts/managed/organization/contract/index.d.ts:
 *
 *   adminSecretKey(context): [PS, Uint8Array]
 *   hrSecretKey(context): [PS, Uint8Array]
 *   employeeSecretKey(context): [PS, Uint8Array]
 *   findEmployeePath(context, pk: Uint8Array): [PS, MerkleTreePath]
 *   findHrPath(context, pk: Uint8Array): [PS, MerkleTreePath]
 */
export function createOrganizationWitnesses() {
  return {
    adminSecretKey(context: {
      readonly privateState: OrganizationPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [OrganizationPrivateState, Uint8Array] {
      if (!context.privateState.adminSecretKey) {
        throw new Error("Admin secret key not set in private state");
      }
      return [context.privateState, context.privateState.adminSecretKey];
    },

    hrSecretKey(context: {
      readonly privateState: OrganizationPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [OrganizationPrivateState, Uint8Array] {
      if (!context.privateState.hrSecretKey) {
        throw new Error("HR secret key not set in private state");
      }
      return [context.privateState, context.privateState.hrSecretKey];
    },

    employeeSecretKey(context: {
      readonly privateState: OrganizationPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [OrganizationPrivateState, Uint8Array] {
      if (!context.privateState.employeeSecretKey) {
        throw new Error("Employee secret key not set in private state");
      }
      return [context.privateState, context.privateState.employeeSecretKey];
    },

    findEmployeePath(
      context: {
        readonly privateState: OrganizationPrivateState;
        readonly ledger: any;
        readonly contractAddress: string;
      },
      pk: Uint8Array,
    ): [
      OrganizationPrivateState,
      {
        leaf: Uint8Array;
        path: { sibling: { field: bigint }; goes_left: boolean }[];
      },
    ] {
      const path = context.ledger.employees.findPathForLeaf(pk);
      if (!path) {
        throw new Error("Employee not found in tree");
      }
      return [context.privateState, path];
    },

    findHrPath(
      context: {
        readonly privateState: OrganizationPrivateState;
        readonly ledger: any;
        readonly contractAddress: string;
      },
      pk: Uint8Array,
    ): [
      OrganizationPrivateState,
      {
        leaf: Uint8Array;
        path: { sibling: { field: bigint }; goes_left: boolean }[];
      },
    ] {
      const path = context.ledger.hrOperators.findPathForLeaf(pk);
      if (!path) {
        throw new Error("HR operator not found in tree");
      }
      return [context.privateState, path];
    },
  };
}

// ============================================================
// Salary Contract Witnesses
// ============================================================

/**
 * Salary contract witness implementations.
 * Matches the Witnesses<PS> type from contracts/managed/salary/contract/index.d.ts:
 *
 *   adminSecretKey(context): [PS, Uint8Array]
 *   employeeSecretKey(context): [PS, Uint8Array]
 *   salaryAmount(context): [PS, bigint]
 *   paymentPeriod(context): [PS, bigint]
 *   paymentRandomness(context): [PS, Uint8Array]
 *   reviewTokenRandomness(context): [PS, Uint8Array]
 *   findPaymentPath(context, commitment: Uint8Array): [PS, MerkleTreePath]
 */
export function createSalaryWitnesses() {
  return {
    adminSecretKey(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, Uint8Array] {
      if (!context.privateState.adminSecretKey) {
        throw new Error("Admin secret key not set");
      }
      return [context.privateState, context.privateState.adminSecretKey];
    },

    employeeSecretKey(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, Uint8Array] {
      if (!context.privateState.employeeSecretKey) {
        throw new Error("Employee secret key not set");
      }
      return [context.privateState, context.privateState.employeeSecretKey];
    },

    salaryAmount(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, bigint] {
      const payments = Array.from(context.privateState.payments.values());
      if (payments.length === 0) {
        throw new Error("No payment data in private state");
      }
      return [context.privateState, payments[payments.length - 1].amount];
    },

    paymentPeriod(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, bigint] {
      const payments = Array.from(context.privateState.payments.values());
      if (payments.length === 0) {
        throw new Error("No payment data in private state");
      }
      return [context.privateState, payments[payments.length - 1].period];
    },

    paymentRandomness(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, Uint8Array] {
      const payments = Array.from(context.privateState.payments.values());
      if (payments.length === 0) {
        throw new Error("No payment data in private state");
      }
      return [context.privateState, payments[payments.length - 1].randomness];
    },

    reviewTokenRandomness(context: {
      readonly privateState: SalaryPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [SalaryPrivateState, Uint8Array] {
      // Generate fresh randomness each time to prevent linking reviews to payments
      const randomness = new Uint8Array(32);
      crypto.getRandomValues(randomness);
      return [context.privateState, randomness];
    },

    findPaymentPath(
      context: {
        readonly privateState: SalaryPrivateState;
        readonly ledger: any;
        readonly contractAddress: string;
      },
      commitment: Uint8Array,
    ): [
      SalaryPrivateState,
      {
        leaf: Uint8Array;
        path: { sibling: { field: bigint }; goes_left: boolean }[];
      },
    ] {
      const path = context.ledger.paymentCommitments.findPathForLeaf(commitment);
      if (!path) {
        throw new Error("Payment commitment not found in tree");
      }
      return [context.privateState, path];
    },
  };
}

// ============================================================
// Review Contract Witnesses
// ============================================================

/**
 * Review contract witness implementations.
 * Matches the Witnesses<PS> type from contracts/managed/review/contract/index.d.ts:
 *
 *   adminSecretKey(context): [PS, Uint8Array]
 *   employeeSecretKey(context): [PS, Uint8Array]
 *   reviewPeriod(context): [PS, bigint]
 *   reviewTokenRandomness(context): [PS, Uint8Array]
 *   findReviewTokenPath(context, token: Uint8Array): [PS, MerkleTreePath]
 */
export function createReviewWitnesses() {
  return {
    adminSecretKey(context: {
      readonly privateState: ReviewPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [ReviewPrivateState, Uint8Array] {
      if (!context.privateState.adminSecretKey) {
        throw new Error("Admin secret key not set");
      }
      return [context.privateState, context.privateState.adminSecretKey];
    },

    employeeSecretKey(context: {
      readonly privateState: ReviewPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [ReviewPrivateState, Uint8Array] {
      if (!context.privateState.employeeSecretKey) {
        throw new Error("Employee secret key not set");
      }
      return [context.privateState, context.privateState.employeeSecretKey];
    },

    reviewPeriod(context: {
      readonly privateState: ReviewPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [ReviewPrivateState, bigint] {
      const tokens = Array.from(context.privateState.reviewTokens.values());
      if (tokens.length === 0) {
        throw new Error("No review tokens in private state");
      }
      return [context.privateState, tokens[tokens.length - 1].period];
    },

    reviewTokenRandomness(context: {
      readonly privateState: ReviewPrivateState;
      readonly ledger: any;
      readonly contractAddress: string;
    }): [ReviewPrivateState, Uint8Array] {
      const tokens = Array.from(context.privateState.reviewTokens.values());
      if (tokens.length === 0) {
        throw new Error("No review tokens in private state");
      }
      return [context.privateState, tokens[tokens.length - 1].randomness];
    },

    findReviewTokenPath(
      context: {
        readonly privateState: ReviewPrivateState;
        readonly ledger: any;
        readonly contractAddress: string;
      },
      token: Uint8Array,
    ): [
      ReviewPrivateState,
      {
        leaf: Uint8Array;
        path: { sibling: { field: bigint }; goes_left: boolean }[];
      },
    ] {
      const path = context.ledger.verifiedEmployeeTokens.findPathForLeaf(token);
      if (!path) {
        throw new Error("Review token not found in verified employee tree");
      }
      return [context.privateState, path];
    },
  };
}
