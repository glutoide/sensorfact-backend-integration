# Sensorfact Backend Integration Assignment

Portfolio implementation of Sensorfact's public **Backend Engineer Technical Assignment**.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## What is implemented

Both mandatory requirements are covered:

1. **Energy consumption per transaction for a Bitcoin block**
2. **Total energy consumption per UTC day for the last `x` days**

The optional API-call optimization is also implemented with an in-memory promise cache so repeated block/day lookups in the same warm process reuse the existing request.

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

- `src/energy.ts` — pure energy calculation
- `src/bitcoin-service.ts` — block/day aggregation and input validation
- `src/blockchain-client.ts` — Blockchain.com HTTP access, payload validation, retry policy, and cache
- `src/schema.ts` — GraphQL types and resolvers
- `src/fn_graphql.ts` — Lambda/API Gateway adapter from the starter project

The service depends on a small `BlockchainClient` interface. Tests can therefore use deterministic fake data instead of depending on the public API or network state.

## Rate limiting and resilience

Blockchain.com may rate-limit repeated calls. This solution addresses that in two ways:

- successful block and daily-list requests are cached for the lifetime of the warm process;
- HTTP `429` and `5xx` responses are retried up to three attempts with short exponential backoff (`100ms`, then `200ms`).

Permanent `4xx` responses are not retried. Failed requests are removed from the cache so a later request can recover.

For a production system with multiple Lambda instances, I would replace the process-local cache with a shared cache such as Redis/DynamoDB and add observability around API latency, retry counts, and error rates.

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

## Verification

```bash
npm test
npm run compile
```

GitHub Actions runs both commands for pushes and pull requests. Unit tests cover:

- the 4.56 kWh/byte formula and invalid sizes;
- per-transaction and per-block aggregation;
- multi-day UTC aggregation;
- day-window validation;
- Blockchain API response parsing;
- cache behavior;
- retry behavior for rate limiting;
- GraphQL contract for both mandatory operations.

External API calls are deliberately not part of CI, which keeps verification deterministic and avoids making builds depend on Blockchain.com availability or rate limits.

## Scope decisions

The assignment suggests roughly a four-hour timebox and prioritizes the two mandatory requests. I therefore implemented those fully plus the cache/retry optimization, but did **not** add the optional wallet-address calculation. That keeps the solution focused while leaving a straightforward extension point in the client/service layers.
