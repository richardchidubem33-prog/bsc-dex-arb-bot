import assert from "node:assert/strict";
import hre from "hardhat";
import { Contract, parseUnits, formatUnits } from "ethers";

const routerAbi = ["function getAmountsOut(uint256,address[]) view returns (uint256[])"];

async function simulate(label, prefix) {
  const rpc = process.env[`${prefix}_RPC_URL`];
  const routerA = process.env[`${prefix}_ROUTER_A`];
  const routerB = process.env[`${prefix}_ROUTER_B`];
  const tokenIn = process.env[`${prefix}_TOKEN_IN`];
  const tokenMid = process.env[`${prefix}_TOKEN_MID`];
  if (![rpc, routerA, routerB, tokenIn, tokenMid].every(Boolean)) {
    console.log(`${label}: skipped; set ${prefix}_RPC_URL, ${prefix}_ROUTER_A, ${prefix}_ROUTER_B, ${prefix}_TOKEN_IN, ${prefix}_TOKEN_MID`);
    return;
  }
  await hre.network.provider.send("hardhat_reset", [{ forking: { jsonRpcUrl: rpc } }]);
  const provider = hre.ethers.provider;
  const block = await provider.getBlockNumber();
  const amount = parseUnits(process.env[`${prefix}_AMOUNT_IN`] || "1", Number(process.env[`${prefix}_TOKEN_IN_DECIMALS`] || "18"));
  const a = new Contract(routerA, routerAbi, provider);
  const b = new Contract(routerB, routerAbi, provider);
  const first = (await a.getAmountsOut(amount, [tokenIn, tokenMid])).at(-1);
  const returned = (await b.getAmountsOut(first, [tokenMid, tokenIn])).at(-1);
  const returnedFloat = Number(formatUnits(returned, Number(process.env[`${prefix}_TOKEN_IN_DECIMALS`] || "18")));
  const inputFloat = Number(formatUnits(amount, Number(process.env[`${prefix}_TOKEN_IN_DECIMALS`] || "18")));
  const gross = returnedFloat - inputFloat;
  const flashFee = inputFloat * Number(process.env.FLASH_FEE_BPS || "9") / 10000;
  const gasUsd = Number(process.env.MAX_GAS_USD || "2");
  const minProfit = Number(process.env.MIN_PROFIT_USD || "3");
  console.log(JSON.stringify({ label, block, input: inputFloat, return: returnedFloat, gross, estimatedFlashFee: flashFee, gasUsd, estimatedNet: gross - flashFee - gasUsd, minProfit }, null, 2));
  assert(Number.isFinite(gross), `${label}: non-finite quote`);
}

describe("mainnet fork profitability probes", function () {
  this.timeout(120000);
  it("probes Arbitrum and BSC read-only routes", async function () {
    await simulate("Arbitrum", "ARBITRUM");
    await simulate("BSC", "BSC");
  });
});
