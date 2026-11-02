# Developer setup

## 1. Requirements

- Node.js 20 or newer
- Python 3.10 or newer
- An RPC endpoint for read-only BSC or another EVM network when using live quotes
- No wallet or private key is required for scanner or paper mode

## 2. Install and validate

```bash
git clone https://github.com/<owner>/bsc-dex-arb-bot.git
cd bsc-dex-arb-bot
cp .env.example .env
npm install
npm run check
npm run compile
npm test
```

`npm run check` must report `liveSigning: disabled`. Never commit `.env`.

## 3. Run mock paper mode

```bash
python3 arb_box.py --once --show-all
python3 server.py
curl http://localhost:10000/health
```

Mock mode writes paper fills to ignored `data/paper_trades.jsonl`.

## 4. Configure read-only route scanning

Copy `config/routes.example.json` into your own private configuration or set `ROUTES_JSON` as a server-side environment variable. Replace every example address with verified addresses from the target chain and DEX documentation. Then set:

```bash
MODE=mainnet
EXECUTION=read-only
BSC_RPC_URL=https://your-rpc-endpoint
ROUTES_JSON='[{"name":"verified route","tokenIn":"0x...","tokenMid":"0x...","decimalsIn":18,"decimalsMid":18,"amountIn":"0.1","buyRouter":"0x...","sellRouter":"0x..."}]'
```

Run:

```bash
npm run scan
MODE=mainnet python3 server.py
curl http://localhost:10000/opportunities
```

The scanner calls only `getAmountsOut`. It does not estimate a guaranteed fill, account for all gas/MEV effects, or submit a transaction.

## 5. Fork simulation

Set `BSC_RPC_URL` or the prefixed variables required by `test/fork-simulation.test.js`, then run:

```bash
npm run fork:sim
```

The current harness is a read-only quote probe. A production candidate still needs tests that execute the exact deployed pool/router combination on a pinned fork block and assert repayment, slippage, and profit behavior.

## 6. Local contract deployment

The contract is paused by default. For an in-memory Hardhat deployment:

```bash
AAVE_ADDRESSES_PROVIDER=0x0000000000000000000000000000000000000001 \
AAVE_POOL=0x0000000000000000000000000000000000000002 \
PROFIT_RECIPIENT=0x0000000000000000000000000000000000000003 \
npm run deploy:local
```

These placeholder addresses are only constructor inputs for local deployment; they are not usable protocol addresses. Never use them on a live network.

For any non-local deployment, set `ALLOW_EXECUTOR_DEPLOYMENT=true` only after address verification, fork testing, owner-key controls, monitoring, and independent security review. Configure allowlists and risk limits before considering an unpause. The repository intentionally has no live transaction signer.

## 7. Forking and extending

- Add routes without changing scanner logic through `ROUTES_JSON`.
- Add a new quote source behind the same normalized result shape in `scanner/`.
- Keep secrets in environment variables or a secret manager.
- Add tests under `test/` for every new route type and contract behavior.
- Keep execution separate from quoting until the complete transaction path has been reviewed.
