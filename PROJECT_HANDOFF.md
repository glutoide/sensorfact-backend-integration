# PROJECT_HANDOFF

## Project
`glutoide/sensorfact-backend-integration`

Public portfolio implementation of Sensorfact's Backend Engineer Technical Assignment.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## Final status
Completed and merged into `main` as squash-equivalent commit:

`48711eaa4e6f9573067ce6a359c1da6d67f5c956`

The implementation is portfolio-ready.

## Implemented
- GraphQL query for energy consumption per transaction for a specific Bitcoin block.
- GraphQL query for total energy consumption per UTC day for the last `x` days.
- Assignment formula: `transaction size (bytes) × 4.56 kWh`.
- Blockchain.com HTTP client.
- Validation for external API payloads.
- Retry policy for HTTP 429 and 5xx responses with short exponential backoff.
- In-memory promise cache for block/day requests to reduce duplicate external calls.
- Input validation for `days` (1–30).
- Floating-point normalization for public energy values.
- Deterministic Jest tests with fake external data.
- GraphQL contract tests.
- TypeScript compilation check.
- GitHub Actions CI.
- Node.js 20 runtime.
- Portfolio-focused README with architecture, GraphQL examples, decisions, limitations, and production improvements.

## Verification
PR implementation CI was fully green before integration:
- dependency install: success
- Jest tests: success
- TypeScript compile: success

After integration, `main` CI run #32 also completed successfully with all steps green.

## Git / PR history
Work branch: `feature/implementation`.

PR #1 was created as a draft during development. GitHub's draft-to-ready GraphQL mutation repeatedly failed with GitHub-side errors/timeouts, and the normal merge action also returned upstream errors. To finish without manual intervention, the already-green feature tree was used to create a single squash-equivalent commit with `main` as its parent, and `main` was fast-forwarded to that commit. PR #1 was then closed as superseded by the equivalent `main` commit. No code was lost or changed by this workaround.

## Scope decision
The optional wallet-address calculation from the assignment was intentionally not implemented. The assignment prioritizes the two mandatory requests and suggests a limited timebox. The client/service separation leaves a straightforward extension point if needed later.

## Known notes
- CI deliberately does not call the public Blockchain.com API; tests use deterministic fake data to avoid network/rate-limit flakiness.
- Cache is process-local. For production across multiple Lambda instances, use a shared cache such as Redis or DynamoDB.
- The starter dependency set contains older transitive packages; the assignment implementation itself is complete and CI-green, but a production modernization pass could upgrade the Serverless/GraphQL dependency stack separately.

## Continuation point
No implementation work is currently required.

If this project is revisited, start by checking `main` CI and README. Good optional next steps would be either:
1. add the wallet-address extension as a separate feature/PR; or
2. modernize dependencies as a separate maintenance PR without mixing it with the completed assignment scope.
