# Executor contract

`AtomicArbExecutor.sol` is a guarded reference executor for a two-leg, V2-router-style swap funded by an Aave-style `flashLoanSimple` callback.

The read-only scanner emits the fields needed to construct the callback payload:

| Scanner field | Callback parameter |
| --- | --- |
| `tokenIn` | `asset` / starting loan asset |
| `tokenMid` | `tokenMid` |
| `buyRouter` | `buyRouter` |
| `sellRouter` | `sellRouter` |
| route-specific slippage calculation | `minMidOut`, `minFinalOut` |
| short-lived execution window | `deadline` |

The repository does **not** connect these fields to a signer or automatically call `requestFlashLoan`. That separation is intentional. Before any execution is considered, developers must add independently reviewed transaction construction, fork tests that exercise the exact deployed routers and pool, gas/nonce handling, monitoring, an emergency procedure, and a security review.

## Local deployment shape

The deployment helper expects:

- `AAVE_ADDRESSES_PROVIDER`
- `AAVE_POOL`
- `PROFIT_RECIPIENT`

It is safe to deploy to the in-memory Hardhat network with `npm run deploy:local`. Non-local deployment is blocked unless `ALLOW_EXECUTOR_DEPLOYMENT=true` is explicitly set.

After deployment, the owner must configure:

1. router allowlists with `setRouter`
2. token allowlists with `setToken`
3. caps and minimum profit with `configureRisk`
4. paused state, which should remain `true` until review is complete

Never send funds to an unreviewed deployment. `rescue` is an owner-only recovery function, not a substitute for custody controls or an audit.
