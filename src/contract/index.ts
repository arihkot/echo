/**
 * Echo Platform - Contract Exports
 *
 * Re-exports all contract-related types, witnesses, and utilities.
 * The compiled contract modules are loaded dynamically by the DApp
 * layer from the contracts/managed directory.
 */

export * from "./types";
export {
  createOrganizationWitnesses,
  createSalaryWitnesses,
  createReviewWitnesses,
} from "./witnesses";
