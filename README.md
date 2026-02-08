# Echo

**Anonymous Salary & Workplace Transparency on Midnight Blockchain**

Echo is a privacy-first platform that enables employees to share compensation data, submit workplace reviews, and access aggregate analytics -- all without revealing their identity. Built on [Midnight](https://midnight.network/)'s zero-knowledge proof infrastructure.

---

<img width="1461" height="820" alt="Screenshot 2026-02-08 at 6 06 18 PM" src="https://github.com/user-attachments/assets/ee9115ef-62db-4784-aa17-4c7f771001eb" />


---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Privacy Model](#privacy-model)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Wallet Integration](#wallet-integration)
- [Contract Details](#contract-details)
- [Limitations & Caveats](#limitations--caveats)

---

## Overview

Current salary transparency platforms (Glassdoor, Blind, Levels.fyi) rely on trust -- users self-report data, and the platform sees everything. Echo inverts this model:

- **Employees prove facts without revealing data.** A ZK proof confirms you earn within a salary band without disclosing the exact figure.
- **Reviews are cryptographically anonymous.** A review token (earned by confirming a salary receipt) proves you're a verified employee. A nullifier prevents double-reviewing. No one -- not even the platform -- can link a review to a person.
- **Analytics are on-chain aggregates.** Public counters (total employees, salary band counts, rating distributions) are updated by ZK-proven transactions. Individual records never exist on-chain.

Echo consists of three Compact smart contracts, a TypeScript DApp layer, and a Next.js frontend that connects to the **Lace Midnight Preview** wallet.

---

## Deployment details (contract)

Organization: a6bbbe6b29c809686f31512bfdec579672727d84909a1e40a423827c043c0063
Salary:d9f77776ebfdb541ad65fb84193632ed34955df89bd5661195e25d8fe773ec37
Review:c4443230ef95961056c3daa2870ecf3d66eb0b8182798435c8724b962fe84666

---

## Architecture

```
+------------------+     +-------------------+     +-------------------+
|   Organization   |     |      Salary       |     |      Review       |
|    Contract      |     |     Contract      |     |     Contract      |
|                  |     |                   |     |                   |
| - Employee tree  |     | - Payment commits |     | - Review tokens   |
| - HR tree        |     | - Band counters   |     | - Rating counters |
| - Auditor tree   |     | - Receipt nulls   |     | - Review nulls    |
| - Revocation set |     | - Review tokens   |     | - Period mgmt     |
+------------------+     +-------------------+     +-------------------+
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                    +---------------------------+
                    |   TypeScript DApp Layer   |
                    |                           |
                    |  - EchoAPI (api.ts)       |
                    |  - Providers (providers.ts)|
                    |  - Config (config.ts)     |
                    |  - Witnesses (witnesses.ts)|
                    +---------------------------+
                                  |
                    +---------------------------+
                    |   Next.js 15 Frontend     |
                    |                           |
                    |  - Dashboard              |
                    |  - Organization mgmt      |
                    |  - Salary operations      |
                    |  - Anonymous reviews       |
                    |  - Analytics dashboard    |
                    +---------------------------+
                                  |
                    +---------------------------+
                    |   Lace Wallet (DApp       |
                    |   Connector API v3.0.0)   |
                    +---------------------------+
```

---

## Privacy Model

Echo uses Midnight's commitment/nullifier pattern throughout:

### Commitments
A commitment is a cryptographic hash of private data plus randomness. It goes on-chain as an opaque value -- anyone can see that *a* commitment exists, but no one can determine what data produced it.

### Nullifiers
A nullifier is a deterministic value derived from the same private data. When revealed, it proves "this commitment was consumed" without revealing which commitment. This prevents double-spending (salary receipts) and double-reviewing.

### Merkle Trees
Employee, HR, and auditor identities are stored in on-chain Merkle trees as commitments. To prove membership (e.g., "I am an employee"), a user provides a Merkle path and proves in zero knowledge that they know the preimage of a leaf in the tree.

### Domain Separation
All key derivations use unique domain strings (`echo:org:admin:pk`, `echo:salary:review`, etc.) to prevent cross-context attacks.

### What's Public (on-chain)
- Organization status and employee count
- Salary band counters (how many people in each range)
- Rating distribution counters (how many 1s, 2s, 3s, 4s, 5s per category)
- Total payments processed, total reviews submitted

### What's Private (never on-chain)
- Individual salaries
- Who submitted which review
- Employee-to-commitment mappings
- Review content (stored off-chain on IPFS/Arweave, only hash on-chain)

---

## Smart Contracts

All three contracts are written in [Compact](https://docs.midnight.network/develop/tutorial/compact-language) (`pragma language_version 0.17`).

### `contracts/organization.compact` (238 lines)
- `HistoricMerkleTree<16>` for employees (supports ~65K)
- `HistoricMerkleTree<10>` for HR operators
- `HistoricMerkleTree<8>` for auditors
- `Set<Bytes<32>>` for revoked employee nullifiers
- Role-based admin, HR, and auditor circuits
- Key circuits: `onboardEmployee`, `offboardEmployee`, `proveEmployment`, `addHrOperator`, `rotateAdminKey`

### `contracts/salary.compact` (268 lines)
- `HistoricMerkleTree<20>` for payment commitments (~1M records)
- 5 salary band counters (`band1` through `band5`)
- `confirmSalaryReceipt` -- the bridge circuit that verifies payment AND issues a review token
- Key circuits: `processSalaryPayment`, `confirmSalaryReceipt`, `proveSalaryRange`, `advancePeriod`

### `contracts/review.compact` (258 lines)
- 25 individual rating counters (5 categories x 5 scores)
- Categories: culture, compensation, management, work-life balance, career growth
- Review nullifier prevents double-reviewing per period
- Cross-contract token domain: `pad(32, "echo:salary:review")`
- Key circuits: `submitReview`, `syncReviewToken`, `advanceReviewPeriod`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Midnight (testnet) |
| Smart Contracts | Compact language v0.17 |
| Contract Runtime | `@midnight-ntwrk/compact-runtime` |
| DApp Connector | `@midnight-ntwrk/dapp-connector-api@3.0.0` |
| Providers | `midnight-js-*` SDK packages v2.0.2 |
| Frontend | Next.js 15, React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 3 |
| State | Zustand 5 |
| Icons | Lucide React |
| Wallet | Lace Midnight Preview (Chrome extension) |

---

## Project Structure

```
echo/
├── contracts/
│   ├── organization.compact     # Employee/HR/auditor registry
│   ├── salary.compact           # Payment commitments & band counters
│   └── review.compact           # Anonymous reviews & rating aggregates
├── src/
│   ├── contract/
│   │   ├── types.ts             # Shared TypeScript types & enums
│   │   ├── witnesses.ts         # Witness functions for all 3 contracts
│   │   └── index.ts             # Re-exports
│   └── dapp/
│       ├── api.ts               # EchoAPI class -- high-level contract operations
│       ├── config.ts            # Network endpoint configurations
│       ├── deploy.ts            # CLI deployment script
│       └── providers.ts         # Midnight SDK provider factory
├── app/
│   ├── globals.css              # Tailwind + custom component styles
│   ├── layout.tsx               # Root layout (metadata, fonts)
│   ├── ClientLayout.tsx         # Client wrapper (sidebar + header)
│   ├── page.tsx                 # Dashboard
│   ├── store/
│   │   └── index.ts             # Zustand store (wallet, org, analytics, UI)
│   ├── components/
│   │   ├── Header.tsx           # Top bar (role switcher, notifications, wallet)
│   │   ├── Sidebar.tsx          # Collapsible navigation
│   │   ├── WalletConnect.tsx    # Lace wallet integration
│   │   ├── NotificationToast.tsx # Toast notification overlay
│   │   └── ui/
│   │       ├── Card.tsx         # Card + StatCard
│   │       ├── Button.tsx       # 5 variants, 3 sizes, loading state
│   │       └── Badge.tsx        # 6 color variants
│   ├── organization/page.tsx    # Employee & HR management
│   ├── salary/page.tsx          # Payments, receipts, range proofs
│   ├── reviews/page.tsx         # Anonymous review submission
│   └── analytics/page.tsx       # Aggregate analytics dashboard
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Lace Midnight Preview** Chrome extension ([install](https://chromewebstore.google.com/detail/lace-midnight-preview/hgeekaiplokcnmakghbdfbgnlfheichg))
- **Compact compiler** (for contract compilation only -- `compact-compiler` v0.2.0+)
- **Midnight proof server** running locally on port 6300 (for ZK proof generation)

### Installation

```bash
git clone <repo-url> echo
cd echo
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is needed because some `@midnight-ntwrk` packages have peer dependency conflicts in the current pre-release SDK.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs without a live blockchain connection -- contract operations are currently stubbed with mock responses in `EchoAPI`.

### Build for Production

```bash
npm run build:next
```

### Compile Contracts (requires Compact compiler)

```bash
npm run build:contracts
```

This runs `compact compile` for each `.compact` file and outputs to `contracts/managed/`.

---

## Development

### Key Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build:next` | Production build |
| `npm run build:contracts` | Compile Compact contracts |
| `npm run build` | Compile contracts + build Next.js |
| `npm run start` | Serve production build |
| `npm run deploy` | Run interactive deployment script |

### EchoAPI

The `EchoAPI` class in `src/dapp/api.ts` provides the high-level interface for all contract operations:

```typescript
import { EchoAPI } from "@/src/dapp/api";
import { getConfig } from "@/src/dapp/config";

const api = new EchoAPI(getConfig("testnet"));

// Deploy contracts for a new org
const deployment = await api.deployOrganization({ ... });

// Or connect to existing deployment
await api.connectToDeployment(existingDeployment);

// Organization operations
await api.onboardEmployee(commitmentHash);
await api.proveEmployment();

// Salary operations
await api.processSalaryPayment({ employeePublicKey, amount, period, salaryBand });
await api.confirmSalaryReceipt();
await api.proveSalaryRange(50000n, 100000n);

// Review operations
await api.submitReview({ ratings, content, contentHash });

// Analytics (reads public on-chain state)
const analytics = await api.getAnalytics();
```

Currently, `EchoAPI` methods return mock data with console logs documenting what the production SDK calls would look like. When Midnight's testnet is stable and the Compact compiler outputs are available, these will be replaced with actual contract calls via the `configureProviders` factory in `providers.ts`.

### Zustand Store

All app state lives in a single Zustand store (`app/store/index.ts`):

- `wallet` -- Connection state from Lace DApp Connector
- `walletApi` -- Live `DAppConnectorWalletAPI` instance
- `role` -- Current user role (Admin/HR/Employee/Auditor)
- `deployment` -- Connected contract addresses
- `analytics` / `reviewState` -- Cached on-chain state
- `notifications` -- Toast notification queue

### Styling

The app uses a dark theme with custom Tailwind tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `echo-bg` | `#0a0b14` | Page background |
| `echo-surface` | `#12131f` | Cards, panels |
| `echo-border` | `#1e2035` | Borders |
| `echo-accent` | `#6366f1` | Primary accent (indigo) |
| `echo-muted` | `#64748b` | Secondary text |
| `echo-success` | `#22c55e` | Success states |
| `echo-warning` | `#f59e0b` | Warning states |
| `echo-danger` | `#ef4444` | Error/danger states |

Custom component classes: `glass-panel`, `input-field`, `label-text`, `section-heading`, `page-heading`, `rating-bar`.

---

## Wallet Integration

Echo connects to the **Lace Midnight Preview** Chrome extension using the [DApp Connector API v3.0.0](https://docs.midnight.network/api-reference/dapp-connector).

### Connection Flow

1. Extension injects `window.midnight.mnLace` (type: `DAppConnectorAPI`)
2. App calls `window.midnight.mnLace.enable()` which triggers the Lace authorization modal
3. User clicks "Authorize" in Lace
4. Returns `DAppConnectorWalletAPI` with methods:
   - `state()` -- bech32m address, coinPublicKey, encryptionPublicKey
   - `balanceAndProveTransaction()` -- balance and prove a contract transaction
   - `submitTransaction()` -- submit a proved transaction to the network
5. App also reads `serviceUriConfig()` to get the wallet's configured network endpoints (indexer, node, proof server)
6. Auto-reconnects on page load via `isEnabled()` check

### Using Wallet State

```typescript
import { useAppStore } from "@/app/store";

const { wallet, walletApi } = useAppStore();

// Check connection
if (wallet.isConnected) {
  console.log(wallet.address);          // bech32m address
  console.log(wallet.coinPublicKey);    // for transaction balancing
  console.log(wallet.serviceUriConfig); // network endpoints
}

// Use wallet API for transactions
if (walletApi) {
  const proved = await walletApi.balanceAndProveTransaction(tx, newCoins);
  await walletApi.submitTransaction(proved);
}
```

---

## Contract Details

### Cross-Contract Token Flow

Midnight does not currently support native cross-contract calls. Echo bridges the salary and review contracts using an admin-synced token pattern:

```
Salary Contract                    Review Contract
     |                                  |
     | confirmSalaryReceipt()           |
     | --> issues review token          |
     |     commitment to salary         |
     |     contract's token tree        |
     |                                  |
     |     Admin calls                  |
     |     syncReviewToken() ---------> |
     |                                  | adds token to review
     |                                  | contract's token tree
     |                                  |
     |                        submitReview()
     |                        --> proves token ownership
     |                        --> generates review nullifier
     |                        --> increments rating counters
```

### Salary Band Definitions

| Band | Range | Contract Field |
|------|-------|---------------|
| Band 1 | 0 - 5 LPA | `salaryBandCount1` |
| Band 2 | 5 - 15 LPA | `salaryBandCount2` |
| Band 3 | 15 - 30 LPA | `salaryBandCount3` |
| Band 4 | 30 - 50 LPA | `salaryBandCount4` |
| Band 5 | 50+ LPA | `salaryBandCount5` |

### Rating Categories

Each category has 5 counters (rating1 through rating5) stored on-chain:

- Work Culture
- Compensation
- Management
- Work-Life Balance
- Career Growth

The average for each category is computed client-side from the counter values:

```
avg = (1*count1 + 2*count2 + 3*count3 + 4*count4 + 5*count5) / total
```

---

## Limitations & Caveats

1. **Midnight is pre-production.** The SDK is v0.0.0-level. APIs will change. The Compact compiler is pre-release. Do not use this for real salary data.

2. **Mock contract calls.** `EchoAPI` currently returns mock data. Real contract interaction requires a running Midnight testnet node, proof server, and compiled contract artifacts from the Compact compiler.

3. **Cold start problem.** The platform needs a critical mass of employees submitting data before aggregates become meaningful. With few participants, salary bands could be deanonymizing.

4. **Cross-contract sync is admin-mediated.** The `syncReviewToken` call requires an admin to relay tokens from the salary contract to the review contract. This is a trust assumption until Midnight supports native cross-contract calls.

5. **Review content storage.** Review text is intended for IPFS/Arweave with only the hash on-chain. The off-chain storage layer is not yet implemented.

6. **No persistent wallet state.** The Lace DApp Connector API does not persist authorization across browser sessions by default. Users may need to re-authorize.

7. **Peer dependency conflicts.** The `@midnight-ntwrk` npm packages have unresolved peer dependency conflicts requiring `--legacy-peer-deps` during installation.

---

## License

This project is for educational and demonstration purposes.
