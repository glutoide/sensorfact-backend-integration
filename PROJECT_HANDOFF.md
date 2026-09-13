# PROJECT_HANDOFF

Updated: 2026-09-13

## Project
`glutoide/sensorfact-backend-integration`

Public portfolio implementation of Sensorfact's Backend Engineer Technical Assignment.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## Final status
Completed and portfolio-ready.

PR #2 (`Raise Sensorfact assignment to portfolio-complete quality`) was squash-merged normally into `main` as:

`91e0211216f817837057f42aab615a2f817834e7`

That integrated code was verified on `main` by both deterministic CI and a real Blockchain.com live integration smoke test.

## Implemented
- GraphQL query for energy consumption per transaction for a specific Bitcoin block.
- GraphQL query for total energy consumption per UTC day for the last `x` days.
- GraphQL query for total energy consumption associated with a wallet address.
- Wallet history pagination using Blockchain.com's `n_tx` plus `limit=50` / `offset`, so results are not silently truncated to the first page.
- Assignment formula: `transaction size (bytes) × 4.56 kWh`.
- Blockchain.com HTTP client with external payload validation.
- Retry policy for HTTP 429 and 5xx responses with short exponential backoff.
- In-memory promise cache for block/day/wallet-page requests.
- Input validation for block hashes, wallet addresses, and `days` (1–30).
- Floating-point normalization for public energy values.
- Deterministic Jest tests with fake external data.
- GraphQL contract tests for block, daily, and wallet operations.
- Opt-in live integration tests using the real Blockchain.com latest-block and wallet endpoints.
- Separate `Live API Smoke` GitHub Actions workflow on pushes to `main`, manual dispatch, and weekly schedule.
- TypeScript compilation check.
- Production dependency security gate: `npm audit --omit=dev --audit-level=high`.
- Node.js 20 runtime.
- Modernized TypeScript/Jest/esbuild tooling while retaining Serverless Framework v3 and compatible `serverless-offline` 13.9.0.
- Removed unused starter runtime dependencies.
- Portfolio README documenting architecture, API examples, resilience, verification, and production trade-offs.

## Verification
TDD evidence:
- wallet tests were added before implementation and observed failing in GitHub Actions;
- wallet service/client/schema implementation was then added and corrected until the complete deterministic suite passed.

Final integrated `main` verification for commit `91e0211216f817837057f42aab615a2f817834e7`:

### CI — run #53 / id 34749597101
- dependency install: success
- Jest tests: success
- TypeScript compile: success
- production dependency audit: success
- overall conclusion: success

### Live API Smoke — run #1 / id 34749597100
- dependency install: success
- real Blockchain.com latest-block/raw-block integration: success
- real wallet pagination integration: success
- overall conclusion: success

The live smoke proves the production client/service path works against Blockchain.com rather than only mocked data.

## Git / PR history
- Initial implementation branch: `feature/implementation`.
- PR #1 was superseded by a squash-equivalent `main` commit after GitHub's draft-to-ready/merge API repeatedly failed.
- Quality branch: `quality/ten-out-of-ten`.
- PR #2 was a normal non-draft PR and was successfully squash-merged through GitHub.

An accidental temporary root file named `placeholder` was created during branch setup and immediately removed from `main`; it is not part of the project.

## Design decisions
- Normal CI uses deterministic fake external data to avoid flaky builds.
- Real external integration is covered by a separate live-smoke workflow so network/API availability cannot make ordinary unit verification nondeterministic.
- Process-local caching is appropriate for the assignment; a production multi-instance deployment should use shared caching such as Redis or DynamoDB.
- Serverless Framework v3 is retained to preserve the starter project's simple no-login local workflow; `serverless-offline` is pinned to a compatible v3-era release.
- Production dependency vulnerabilities at high/critical severity fail CI; development-only tooling is evaluated separately rather than forcing unsafe breaking upgrades.

## Continuation point
No implementation work is required.

If the project is revisited, first inspect the current `main` Actions runs and any new dependency/security advisories. Otherwise this repository should be treated as a completed portfolio case.
