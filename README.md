# Minimal DEX Arbitrage Box

A deliberately safe starter for a DEX arbitrage scanner and paper-trading executor.

## Safety defaults

- `MODE=mock`: uses deterministic sample quotes; no wallet or RPC is needed.
- `EXECUTION=paper`: records simulated trades only.
- Live trading is not implemented/enabled in this starter.
- No private keys are accepted by the program.

Atomic arbitrage can prevent a failed on-chain trade from leaving a flash-loan principal unpaid, but it cannot guarantee profit. This project is for learning and simulation only.

## Run

```bash
cd /home/ubuntu/dex-arb-box
python3 arb_box.py --once
python3 arb_box.py --once --show-all
python3 arb_box.py --cycles 5 --interval 2
```

Paper fills are appended to `data/paper_trades.jsonl`.

## Configuration

Environment variables:

- `MIN_PROFIT_USD` (default `5`)
- `GAS_USD` (default `0.35`)
- `FLASH_FEE_BPS` (default `9`)
- `SLIPPAGE_BPS` (default `20`)
- `TRADE_SIZE_USD` (default `10000`)
- `MODE` must remain `mock` in this starter
- `EXECUTION` must remain `paper` in this starter

## What to add later, safely

1. Replace `MockQuoteSource` with a read-only quote source.
2. Add fork/testnet simulation and transaction tracing.
3. Add an audited executor contract with minimum-profit and deadline checks.
4. Only after independent testing should any live signing path be considered—and it should use a dedicated wallet with strict limits, not a personal wallet.
