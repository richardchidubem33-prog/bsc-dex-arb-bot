# BSC DEX Arbitrage Bot

A developer-oriented, read-only and paper-trading reference for scanning two-leg V2-style DEX routes on BSC-compatible networks. The project includes a normalized quote scanner, a small paper service, a guarded Solidity executor reference, fork-probe tests, and step-by-step setup documentation.

> **Important:** live trading is not implemented. The scanner never loads a private key or submits a transaction. The executor is paused by default and must not be funded or unpaused without independent review, fork testing, and an audit.

## Quickstart

```bash
cp .env.example .env
npm install
npm run check
npm run compile
npm test
python3 arb_box.py --once --show-all
```

For the complete workflow, see [`docs/SETUP.md`](docs/SETUP.md). The design and scanner-to-contract boundary are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and the contract workflow is in [`contracts/README.md`](contracts/README.md).

## Repository layout

```text
scanner/quote-scanner.mjs       read-only multi-route RPC scanner
adapter.mjs                     CLI entry point; emits normalized JSON
arb_box.py                      deterministic mock scanner and paper fills
server.py                       mock or read-only scanner HTTP service
contracts/AtomicArbExecutor.sol paused-by-default callback reference
scripts/deploy-executor.js      guarded local/deployment helper
scripts/check-config.mjs        safe configuration check
config/routes.example.json      route schema example
test/                           unit and fork-probe tests
docs/                           setup, architecture, and contract guides
```

## What is implemented

- Mock quote generation and paper fills for local development.
- Live read-only `getAmountsOut` scanning across one or more configured routes.
- Integer-safe gross profit and return reporting.
- HTTP health and opportunity endpoints for a simple service deployment.
- A guarded Aave-style flash-loan callback reference with router/token allowlists, caps, deadlines, pause control, slippage minima, repayment, and minimum-profit checks.
- Hardhat compilation, unit tests, and optional fork quote probes.

## What is intentionally not claimed

A quote is not a guaranteed arbitrage. This repository does not provide a production flash-loan integration, a private-key signer, MEV protection, nonce management, transaction simulation against every target router, monitoring, or an audited deployment. Do not interpret paper results as expected live returns.

## License

MIT. See [`LICENSE`](LICENSE).
