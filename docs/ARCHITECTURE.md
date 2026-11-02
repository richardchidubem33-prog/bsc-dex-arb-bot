# Architecture and data flow

```text
RPC endpoint
    |
    v
scanner/quote-scanner.mjs  -- read-only getAmountsOut calls
    |
    +--> normalized JSON opportunities
    |
    +--> server.py paper service --> /health and /opportunities

AtomicArbExecutor.sol
    ^
    |
reviewed transaction builder (not included; no private key in scanner)
```

## Components

- `scanner/quote-scanner.mjs` validates route addresses, quotes the first swap on the buy router, quotes the return swap on the sell router, and emits integer-safe amounts plus gross profit basis points.
- `adapter.mjs` is the CLI entry point for one or more routes. It never imports a wallet or private key.
- `arb_box.py` is the deterministic mock scanner and paper-fill recorder used for local development.
- `server.py` exposes the current scan state as a small HTTP service. `MODE=mock` uses mock quotes; `MODE=mainnet` plus `BSC_RPC_URL` invokes the Node read-only scanner.
- `contracts/AtomicArbExecutor.sol` is an allowlisted, paused-by-default flash-loan callback reference. It is not automatically called by the scanner.

## Why the connection is deliberately one-way

A quote is not an executable trade. Between a quote and a transaction there must be checks for stale block data, reserves, slippage, gas, flash-loan fee, token behavior, router authenticity, nonce conflicts, and final on-chain profit. Keeping the scanner read-only prevents a bad quote, leaked endpoint, or accidental environment variable from becoming a funded transaction.
