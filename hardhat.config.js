export default {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  networks: {
    hardhat: { chainId: 31337 }
  },
  paths: { sources: "./contracts", artifacts: "./artifacts", tests: "./test" }
};
