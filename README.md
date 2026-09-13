# Sensorfact Backend Integration Assignment

Implementation of Sensorfact's public **Backend Engineer Technical Assignment**.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## Implemented requirements

1. **Energy consumption per transaction for a Bitcoin block**
2. **Total energy consumption per UTC day for the last `x` days**
3. **Optional:** total energy consumption for transactions associated with a wallet address
4. **Optional:** reduce duplicate Blockchain.com calls

The assignment's simplified energy model is used exactly as specified:

```text
energy (kWh) = transaction size (bytes) × 4.56
```

## Stack

- TypeScript
- Node.js 20
- GraphQL
- Serverless Framework / AWS Lambda style handler
- Blockchain.com Data API
- Jest + ts-jest
- GitHub Actions

## Architecture

- `src/energy.ts` — pure energy calculation and numeric normalization
- `src/bitcoin-service.ts` — block/day/wallet aggregation, input validation, and bounded daily concurrency
- `src/blockchain-client.ts` — Blockchain.com HTTP access, payload validation, retries, pagination, and bounded warm-process caches
- `src/schema.ts` — GraphQL types and resolvers
- `src/fn_graphql.ts` — Lambda/API Gateway adapter

The service depends on a small `BlockchainClient` interface, so deterministic tests can exercise business behavior without public-network dependencies.

## Rate limiting and resilience

The daily calculation requires a day block list followed by raw-block data because the day-list endpoint does not contain transaction sizes. To limit pressure on Blockchain.com:

- raw block requests use at most **3 concurrent workers**;
- scheduling stops after the first worker failure instead of continuing to issue unnecessary requests;
- HTTP `429` and `5xx` failures are retried up to **5 attempts** with exponential delays of `500ms`, `1s`, `2s`, and `4s`;
- permanent non-retryable `4xx` responses are returned immediately;
- failed requests are removed from cache so later calls may recover;
- block/day/wallet-page caches are bounded, and external payloads are normalized to the fields used by the application before being retained;
- wallet history follows `n_tx` using `limit=50` / `offset` pagination rather than silently truncating at the first page.

A cold multi-block day query can still be rate-limited by the anonymous Blockchain.com API. For this take-home, the implementation demonstrates bounded concurrency, retry/backoff, request de-duplication and explicit failure propagation rather than hiding the upstream constraint.

For a production system, I would not fan out hundreds of public API calls on every GraphQL request. I would ingest/precompute completed UTC-day aggregates asynchronously into durable storage (for example DynamoDB/PostgreSQL), serve `dailyEnergy` from that materialized data, and refresh the current incomplete day separately. This keeps frontend latency independent of Blockchain.com rate limits and makes multi-instance scaling predictable.

## Run locally

```bash
nvm use
npm ci
npm start
```

GraphQL endpoint:

```text
http://localhost:4000/graphql
```

### Block energy

```graphql
query {
  blockEnergy(blockHash: "000000000000000000...") {
    hash
    totalEnergyKwh
    transactions {
      hash
      sizeBytes
      energyKwh
    }
  }
}
```

### Daily energy

```graphql
query {
  dailyEnergy(days: 2) {
    date
    totalEnergyKwh
    blockCount
    transactionCount
  }
}
```

`days` must be a positive integer. Days are UTC calendar days and the current UTC day is included. Because the current day is still in progress, its value is a partial aggregate at query time. The assignment does not define a maximum `x`, so the GraphQL contract does not impose an arbitrary cap; larger windows naturally require more external data and are more exposed to upstream rate limits.

### Wallet energy

```graphql
query {
  walletEnergy(address: "1AJbsFZ64EpEfS5UAjAfcUG8pH8Jn3rn1F") {
    address
    transactionCount
    totalEnergyKwh
  }
}
```

The wallet calculation includes transactions returned by Blockchain.com's `rawaddr` endpoint for the address. The assignment wording does not define incoming/outgoing direction semantics, so this implementation treats those as transactions associated with the address.

## Verification

Clean install and deterministic checks:

```bash
npm ci
npm test
npm run compile
npm run audit:prod
```

The CI workflow runs those checks for pull requests and `main`. Tests cover:

- the 4.56 kWh/byte formula and invalid sizes;
- per-transaction and per-block aggregation;
- multi-day UTC aggregation and positive-integer `x` validation;
- bounded daily concurrency and failure behavior;
- full wallet pagination and aggregation;
- malformed Blockchain API payload rejection;
- bounded cache behavior;
- retry/backoff behavior for `429`/`5xx`;
- GraphQL contracts for block, daily, and wallet operations.

### Live integration smoke

A separate **Live API Smoke** workflow calls the real Blockchain.com API for:

- the current `latestblock` endpoint and its raw block;
- a real Bitcoin address through the wallet pagination path.

It runs on pushes to `main`, can be triggered manually, and runs weekly. Full cold-day aggregation is intentionally not used as a required CI smoke because anonymous Blockchain.com rate limiting makes that external scenario nondeterministic; deterministic service tests cover the full aggregation path while the live smoke verifies the real HTTP client against Blockchain.com.

## Dependency and security policy

`package-lock.json` is committed and CI uses `npm ci` for reproducible installs.

CI also runs:

```bash
npm audit --omit=dev --audit-level=high
```

so high/critical vulnerabilities in shipped runtime dependencies fail verification. The Serverless v3 development toolchain has older transitive packages; upgrading that toolchain independently may require a Serverless major-version migration and is not mixed into the assignment's runtime logic.

## Trade-offs to discuss in the interview

- The take-home keeps caching process-local to stay small and dependency-light. A real multi-instance deployment needs shared durable aggregates/cache.
- The current UTC day is intentionally included and therefore partial. If the product requires only completed days, the query boundary should start at the previous UTC day.
- The Blockchain.com anonymous API is an external availability/rate-limit dependency; production ingestion should isolate the user-facing API from it.
