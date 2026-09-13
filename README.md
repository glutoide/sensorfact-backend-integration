# Sensorfact Backend Integration Assignment

Portfolio implementation of Sensorfact's public Backend Engineer Technical Assignment.

Original assignment: https://github.com/Sensorfactdev/backend-integration-assignment

## Assignment scope

- Mandatory: provide energy consumption per transaction for a specific Bitcoin block.
- Mandatory: provide total energy consumption per day for the last `x` days.
- Optional: reduce duplicate calls to the Blockchain API.
- Optional: calculate total energy consumption for a wallet address.

The implementation keeps the original TypeScript + GraphQL + Serverless direction and adds automated verification and CI.

> Energy model from the assignment: `4.56 kWh` per transaction byte.
