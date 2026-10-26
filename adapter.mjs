import { JsonRpcProvider, Contract, parseUnits, formatUnits } from "ethers";

const routerAbi = [
  "function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts)",
  "function WETH() external view returns (address)"
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; add it only as a Render secret/config value.`);
  return value;
}

const rpc = required(process.env.RPC_ENV_NAME || "BSC_RPC_URL");
const routerA = required("ROUTER_A_ADDRESS");
const routerB = required("ROUTER_B_ADDRESS");
const tokenIn = required("TOKEN_IN_ADDRESS");
const tokenMid = required("TOKEN_MID_ADDRESS");
const decimalsIn = Number(process.env.TOKEN_IN_DECIMALS || "18");
const decimalsMid = Number(process.env.TOKEN_MID_DECIMALS || "18");
const amountIn = parseUnits(process.env.AMOUNT_IN || "1", decimalsIn);

const provider = new JsonRpcProvider(rpc);
const a = new Contract(routerA, routerAbi, provider);
const b = new Contract(routerB, routerAbi, provider);

async function quote(router, path) {
  const amounts = await router.getAmountsOut(amountIn, path);
  return amounts.at(-1);
}

const [outA, outB] = await Promise.all([
  quote(a, [tokenIn, tokenMid]),
  quote(b, [tokenMid, tokenIn])
]);

const grossReturn = outB;
const grossProfit = grossReturn - amountIn;
console.log(JSON.stringify({
  chainRpc: process.env.RPC_ENV_NAME || "BSC_RPC_URL",
  routerA,
  routerB,
  amountIn: formatUnits(amountIn, decimalsIn),
  tokenMidOut: formatUnits(outA, decimalsMid),
  grossReturn: formatUnits(grossReturn, decimalsIn),
  grossProfit: formatUnits(grossProfit, decimalsIn),
  execution: "read-only quote; no transaction signed or submitted"
}, null, 2));
