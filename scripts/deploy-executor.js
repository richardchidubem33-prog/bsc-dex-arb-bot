import hre from "hardhat";

const required = ["AAVE_ADDRESSES_PROVIDER", "AAVE_POOL", "PROFIT_RECIPIENT"];
const missing = required.filter((name) => !process.env[name]);
const network = hre.network.name;

if (missing.length) {
  throw new Error(`Missing ${missing.join(", ")}. Copy .env.example and set deployment values first.`);
}
if (network !== "hardhat" && process.env.ALLOW_EXECUTOR_DEPLOYMENT !== "true") {
  throw new Error("Deployment is blocked. Set ALLOW_EXECUTOR_DEPLOYMENT=true only after independent review and fork testing.");
}

const factory = await hre.ethers.getContractFactory("AtomicArbExecutor");
const executor = await factory.deploy(
  process.env.AAVE_ADDRESSES_PROVIDER,
  process.env.AAVE_POOL,
  process.env.PROFIT_RECIPIENT
);
await executor.waitForDeployment();
console.log(JSON.stringify({
  network,
  address: await executor.getAddress(),
  provider: process.env.AAVE_ADDRESSES_PROVIDER,
  pool: process.env.AAVE_POOL,
  profitRecipient: process.env.PROFIT_RECIPIENT,
  next: [
    "Verify constructor addresses against the chain's official deployment registry.",
    "Configure router/token allowlists and risk limits through a multisig or reviewed owner process.",
    "Keep paused=true until fork tests and an independent audit are complete."
  ]
}, null, 2));
