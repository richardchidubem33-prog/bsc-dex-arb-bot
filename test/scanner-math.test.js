import assert from "node:assert/strict";
import { grossProfitBps, routeFromEnv } from "../scanner/quote-scanner.mjs";

describe("read-only scanner helpers", () => {
  it("calculates gross profit in basis points using integer amounts", () => {
    assert.equal(grossProfitBps(1000n, 1015n), 150);
    assert.equal(grossProfitBps(1000n, 990n), -100);
  });

  it("supports a JSON route list without requiring secrets", () => {
    const routes = routeFromEnv({ ROUTES_JSON: '[{"name":"demo","tokenIn":"0x1","tokenMid":"0x2","buyRouter":"0x3","sellRouter":"0x4"}]' });
    assert.equal(routes[0].name, "demo");
  });
});
