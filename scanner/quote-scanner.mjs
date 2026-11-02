import { Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";

export const routerAbi = [
  "function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts)"
];

export function grossProfitBps(input, returned) {
  if (input <= 0n) throw new Error("input must be positive");
  return Number(((returned - input) * 10000n) / input);
}

export function routeFromEnv(env = process.env) {
  if (env.ROUTES_JSON) {
    const routes = JSON.parse(env.ROUTES_JSON);
    if (!Array.isArray(routes) || routes.length === 0) throw new Error("ROUTES_JSON must be a non-empty JSON array");
    return routes;
  }
  const required = ["ROUTER_A_ADDRESS", "ROUTER_B_ADDRESS", "TOKEN_IN_ADDRESS", "TOKEN_MID_ADDRESS"];
  for (const name of required) if (!env[name]) throw new Error(`Missing ${name}; provide ROUTES_JSON or the legacy ${name} value`);
  return [{
    name: env.ROUTE_NAME || "TOKEN_IN/TOKEN_MID",
    tokenIn: env.TOKEN_IN_ADDRESS,
    tokenMid: env.TOKEN_MID_ADDRESS,
    decimalsIn: Number(env.TOKEN_IN_DECIMALS || "18"),
    decimalsMid: Number(env.TOKEN_MID_DECIMALS || "18"),
    amountIn: env.AMOUNT_IN || "1",
    buyRouter: env.ROUTER_A_ADDRESS,
    sellRouter: env.ROUTER_B_ADDRESS
  }];
}

function validateAddress(name, value) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value || "")) throw new Error(`${name} is not a valid EVM address`);
}

export async function scanRoutes({ rpcUrl, routes, provider = new JsonRpcProvider(rpcUrl) }) {
  if (!rpcUrl && !provider) throw new Error("BSC_RPC_URL is required for live read-only scanning");
  const results = [];
  for (const route of routes) {
    for (const key of ["tokenIn", "tokenMid", "buyRouter", "sellRouter"]) validateAddress(key, route[key]);
    const decimalsIn = Number(route.decimalsIn ?? 18);
    const decimalsMid = Number(route.decimalsMid ?? 18);
    const amountIn = parseUnits(String(route.amountIn ?? "1"), decimalsIn);
    const buy = new Contract(route.buyRouter, routerAbi, provider);
    const sell = new Contract(route.sellRouter, routerAbi, provider);
    const first = (await buy.getAmountsOut(amountIn, [route.tokenIn, route.tokenMid])).at(-1);
    const returned = (await sell.getAmountsOut(first, [route.tokenMid, route.tokenIn])).at(-1);
    const profit = returned - amountIn;
    results.push({
      name: route.name || `${route.tokenIn}/${route.tokenMid}`,
      tokenIn: route.tokenIn,
      tokenMid: route.tokenMid,
      buyRouter: route.buyRouter,
      sellRouter: route.sellRouter,
      amountIn: formatUnits(amountIn, decimalsIn),
      intermediateAmount: formatUnits(first, decimalsMid),
      returnedAmount: formatUnits(returned, decimalsIn),
      grossProfit: formatUnits(profit, decimalsIn),
      grossProfitBps: grossProfitBps(amountIn, returned),
      execution: "read-only quote; no transaction signed or submitted"
    });
  }
  return results;
}

export async function main(env = process.env) {
  const rpcName = env.RPC_ENV_NAME || "BSC_RPC_URL";
  const rpcUrl = env[rpcName] || env.BSC_RPC_URL;
  if (!rpcUrl) throw new Error(`Missing ${rpcName}; add it only as a server-side secret/config value`);
  const provider = new JsonRpcProvider(rpcUrl);
  const chainId = Number((await provider.getNetwork()).chainId);
  const results = await scanRoutes({ rpcUrl, routes: routeFromEnv(env), provider });
  return { chainId, routeCount: results.length, results, execution: "read-only" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify(await main(), null, 2)); }
  catch (error) { console.error(`Scanner error: ${error.message}`); process.exitCode = 1; }
}
