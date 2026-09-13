# Sensorfact Backend Integration Assignment

Portfolio implementation of Sensorfact's public **Backend Engineer Technical Assignment**.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## What is implemented

All assignment requests are covered:

1. **Energy consumption per transaction for a Bitcoin block**
2. **Total energy consumption per UTC day for the last `x` days**
3. **Optional: total energy consumption for transactions associated with a wallet address**
4. **Optional: reduce duplicate Blockchain.com calls**

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
- GitHub Actions CI

## Architecture

The implementation intentionally keeps responsibilities small:

- `src/energy.ts` — pure energy calculation and numeric normalization
- `src/bitcoin-service.ts` — block/day/wallet aggregation and input validation
- `src/blockchain-client.ts` — Blockchain.com HTTP access, payload validation, retry policy, pagination, and cache
- `src/schema.ts` — GraphQL types and resolvers
- `src/fn_graphql.ts` — Lambda/API Gateway adapter from the starter project

The service depends on a small `BlockchainClient` interface. Normal tests therefore use deterministic fake data instead of depending on public network state.

## Rate limiting and resilience

Blockchain.com may rate-limit repeated calls. This solution addresses that in several ways:

- successful block, day-list, and wallet-page requests are cached for the lifetime of the warm process;
- HTTP `429` and `5xx` responses are retried up to three attempts with short exponential backoff (`100ms`, then `200ms`);
- permanent `4xx` responses are not retried;
- failed requests are removed from the cache so a later request can recover;
- wallet history follows the API's `n_tx` count using `limit=50` and `offset` pagination instead of silently truncating at the first page.

For a production system with multiple Lambda instances, I would replace the process-local cache with a shared cache such as Redis/DynamoDB and add observability around API latency, retry counts, cache hit rate, and error rates.

## GraphQL API

Start locally:

```bash
nvm use
npm install
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

`days` must be an integer from `1` to `30`. Days are UTC calendar days and the current UTC day is included.

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

The wallet query follows every page reported by Blockchain.com's `n_tx`, so the result is not limited to the API's first 50 transactions.

## Verification

Deterministic verification:

```bash
npm test
npm run compile
npm run audit:prod
```

The main CI workflow runs all three commands for pull requests and `main`. Tests cover:

- the 4.56 kWh/byte formula and invalid sizes;
- per-transaction and per-block aggregation;
- multi-day UTC aggregation;
- day-window validation;
- full wallet pagination and aggregation;
- Blockchain API response parsing;
- cache behavior;
- retry behavior for rate limiting;
- GraphQL contracts for block, daily, and wallet operations.

### Live integration smoke

A separate **Live API Smoke** GitHub Actions workflow exercises the production Blockchain.com integration against:

- the current `latestblock` endpoint and its raw block;
- a documented real Bitcoin address through the wallet pagination path.

It runs on pushes to `main`, can be triggered manually, and runs weekly. Keeping it separate means the deterministic test suite remains reliable while the repository still provides real external-integration evidence.

## Dependency/security policy

CI includes `npm audit --omit=dev --audit-level=high`, so high/critical vulnerabilities in shipped runtime dependencies fail the build. Development-only tooling is kept separate from that production gate.

Unused starter runtime packages were removed, and the TypeScript/esbuild/testing/offline tooling was modernized while Serverless Framework remains on v3 to preserve the starter project's no-login local workflow.

## Scope decisions

The assignment suggests roughly a four-hour timebox and prioritizes the two mandatory requests. The portfolio version intentionally goes beyond the minimum by also implementing both optional improvements, real live-integration verification, production dependency auditing, retry/caching behavior, and CI-backed tests.
