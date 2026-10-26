#!/usr/bin/env python3
"""Minimal, safe DEX arbitrage scanner: mock quotes + paper execution only."""
from __future__ import annotations

import argparse
import json
import os
import random
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class Quote:
    dex: str
    pair: str
    buy_price: float
    sell_price: float
    liquidity_usd: float


@dataclass
class Opportunity:
    pair: str
    buy_dex: str
    sell_dex: str
    size_usd: float
    gross_profit_usd: float
    flash_fee_usd: float
    gas_usd: float
    slippage_usd: float
    net_profit_usd: float


class MockQuoteSource:
    """Deterministic-ish quotes for local testing; never contacts a chain."""

    def __init__(self) -> None:
        self.rng = random.Random(7)
        self.base = {"WBNB/USDT": 600.0, "CAKE/USDT": 2.5}

    def get_quotes(self) -> list[Quote]:
        quotes: list[Quote] = []
        for pair, base in self.base.items():
            drift = self.rng.uniform(-0.002, 0.002)
            # A small spread makes the scanner demonstrate both positive and negative cases.
            p1 = base * (1 + drift)
            p2 = base * (1 + drift + self.rng.uniform(-0.006, 0.010))
            quotes.extend([
                Quote("PancakeMock", pair, p1, p1, 250_000),
                Quote("UniMock", pair, p2, p2, 250_000),
            ])
        return quotes


def settings() -> dict[str, float | str]:
    mode = os.getenv("MODE", "mock").lower()
    execution = os.getenv("EXECUTION", "paper").lower()
    if mode != "mock" or execution != "paper":
        raise SystemExit("Safety stop: this starter only permits MODE=mock and EXECUTION=paper.")
    return {
        "mode": mode,
        "execution": execution,
        "min_profit": float(os.getenv("MIN_PROFIT_USD", "5")),
        "gas": float(os.getenv("GAS_USD", "0.35")),
        "fee_bps": float(os.getenv("FLASH_FEE_BPS", "9")),
        "slippage_bps": float(os.getenv("SLIPPAGE_BPS", "20")),
        "size": float(os.getenv("TRADE_SIZE_USD", "10000")),
    }


def find_opportunities(quotes: list[Quote], cfg: dict) -> list[Opportunity]:
    grouped: dict[str, list[Quote]] = {}
    for q in quotes:
        grouped.setdefault(q.pair, []).append(q)
    found: list[Opportunity] = []
    for pair, items in grouped.items():
        if len(items) < 2:
            continue
        low = min(items, key=lambda q: q.buy_price)
        high = max(items, key=lambda q: q.sell_price)
        if low.dex == high.dex or high.sell_price <= low.buy_price:
            continue
        size = min(cfg["size"], low.liquidity_usd * 0.01, high.liquidity_usd * 0.01)
        gross = size * (high.sell_price / low.buy_price - 1)
        flash_fee = size * cfg["fee_bps"] / 10_000
        slippage = size * cfg["slippage_bps"] / 10_000
        net = gross - flash_fee - cfg["gas"] - slippage
        found.append(Opportunity(pair, low.dex, high.dex, size, gross, flash_fee, cfg["gas"], slippage, net))
    return found


def paper_execute(opp: Opportunity, cfg: dict) -> bool:
    if opp.net_profit_usd < cfg["min_profit"]:
        return False
    Path("data").mkdir(exist_ok=True)
    record = {"timestamp": datetime.now(timezone.utc).isoformat(), "status": "PAPER_FILLED", **asdict(opp)}
    with open("data/paper_trades.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="run one scan")
    ap.add_argument("--cycles", type=int, default=1)
    ap.add_argument("--interval", type=float, default=3)
    ap.add_argument("--show-all", action="store_true")
    args = ap.parse_args()
    cfg = settings()
    source = MockQuoteSource()
    cycles = 1 if args.once else max(1, args.cycles)
    print("SAFE DEX ARB BOX | mock quotes | paper execution only")
    for cycle in range(cycles):
        opportunities = find_opportunities(source.get_quotes(), cfg)
        print(f"\nScan {cycle + 1}: {len(opportunities)} candidate(s)")
        for opp in opportunities:
            eligible = opp.net_profit_usd >= cfg["min_profit"]
            if args.show_all or eligible:
                print(f"  {opp.pair}: {opp.buy_dex} -> {opp.sell_dex} | net ${opp.net_profit_usd:.2f} | {'ELIGIBLE' if eligible else 'skip'}")
            if eligible:
                print("    PAPER FILL recorded; no wallet, RPC, or blockchain transaction used")
                paper_execute(opp, cfg)
        if cycle + 1 < cycles:
            time.sleep(max(0, args.interval))


if __name__ == "__main__":
    main()
