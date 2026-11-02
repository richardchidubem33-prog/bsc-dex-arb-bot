import assert from "node:assert/strict";
import hre from "hardhat";

const ZERO_ONE = "0x0000000000000000000000000000000000000001";
const ZERO_TWO = "0x0000000000000000000000000000000000000002";


describe("AtomicArbExecutor safety invariants", function () {
  it("deploys paused and allows the owner to configure risk caps", async function () {
    const [owner] = await hre.ethers.getSigners();
    const Factory = await hre.ethers.getContractFactory("AtomicArbExecutor");
    const executor = await Factory.deploy(ZERO_ONE, ZERO_TWO, owner.address);
    await executor.waitForDeployment();

    assert.equal(await executor.paused(), true);
    await (await executor.configureRisk(1000n, 10n)).wait();
    assert.equal(await executor.maxTradeAmount(), 1000n);
    assert.equal(await executor.minProfit(), 10n);

    await assert.rejects(
      executor.requestFlashLoan(ZERO_ONE, 1n, "0x"),
      /paused/i
    );
  });
});
