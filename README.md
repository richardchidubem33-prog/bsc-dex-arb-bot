# BSC DEX Arbitrage Bot

This repository contains a safe staged arbitrage system:

- `arb_box.py` and `server.py`: live RPC connectivity probe plus paper scanner.
- `adapter.mjs`: ethers.js read-only V2-router quote adapter. It only builds/prints quote data and never signs or submits.
- `contracts/AtomicArbExecutor.sol`: guarded two-leg executor with owner control, router/token allowlists, pause switch, trade cap, deadline, slippage minima, and minimum-profit enforcement.
- `hardhat.config.js`: optimizer/via-IR compilation configuration.

## Current safety state

The Render service is configured for `MODE=mainnet`, `EXECUTION=paper`, and `LIVE_TRADING_ENABLED=false`. The current scanner uses mock prices for paper fills. The Solidity executor is **not deployed** and does not include a flash-loan/pair callback adapter. Do not fund or enable live signing based on this repository alone.

## Read-only adapter configuration

Set these only as server-side configuration values, never in frontend code:

```text
RPC_ENV_NAME=BSC_RPC_URL
ROUTER_A_ADDRESS=0x...
ROUTER_B_ADDRESS=0x...
TOKEN_IN_ADDRESS=0x...
TOKEN_MID_ADDRESS=0x...
TOKEN_IN_DECIMALS=18
TOKEN_MID_DECIMALS=18
AMOUNT_IN=1
```

Run:

```bash
npm install
npm run compile
npm run scan
```

`npm run scan` performs read-only `getAmountsOut` calls and exits if the required configuration is missing. It does not use `EXECUTOR_PRIVATE_KEY` and cannot submit a transaction.

## Required before any real execution

A separate, reviewed flash-loan/flash-swap callback module, fork simulation, deployed-and-verified contract, transaction tracing, router/token address verification, nonce handling, gas controls, emergency pause testing, and independent security review are still required. Mainnet signing remains intentionally disabled.
