#!/usr/bin/env python3
"""Small paper-scanning HTTP service.

The service can use deterministic mock quotes or invoke the Node read-only route
scanner. It never receives a private key and never submits a transaction.
"""
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from arb_box import MockQuoteSource, RpcProbe, find_opportunities, paper_execute, settings

cfg = settings()
state = {
    "scans": 0,
    "last_candidates": 0,
    "last_eligible": 0,
    "mode": cfg["mode"],
    "execution": cfg["execution"],
    "live_signing": "disabled",
    "source": "mock",
    "rpc": {"connected": False},
    "opportunities": [],
    "last_error": None,
}


def live_scan():
    """Run the JS scanner as a read-only subprocess and parse its JSON report."""
    completed = subprocess.run(
        ["node", "adapter.mjs"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
        env=os.environ.copy(),
    )
    return json.loads(completed.stdout)


def scan_loop():
    source = MockQuoteSource()
    use_live = cfg["mode"] in ("mainnet", "live", "rpc") and bool(os.getenv("BSC_RPC_URL"))
    state["source"] = "read-only-rpc" if use_live else "mock-paper"
    rpc_url = os.getenv("BSC_RPC_URL", "")
    while True:
        try:
            if use_live:
                report = live_scan()
                opportunities = report["results"]
                state["rpc"] = {"connected": True, "chain_id": report["chainId"]}
                eligible = [o for o in opportunities if o.get("grossProfitBps", 0) >= 0]
                state["opportunities"] = opportunities
            else:
                if rpc_url:
                    state["rpc"] = RpcProbe(rpc_url).status()
                found = find_opportunities(source.get_quotes(), cfg)
                eligible = [o for o in found if o.net_profit_usd >= float(cfg["min_profit"])]
                state["opportunities"] = [o.__dict__ for o in found]
                for opp in eligible:
                    paper_execute(opp, cfg)
            state.update(
                scans=state["scans"] + 1,
                last_candidates=len(state["opportunities"]),
                last_eligible=len(eligible),
                last_error=None,
            )
        except Exception as exc:
            state["rpc"] = {"connected": False, "error": type(exc).__name__}
            state["last_error"] = str(exc)
        time.sleep(float(os.getenv("SCAN_INTERVAL_SECONDS", "15")))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/", "/health", "/opportunities"):
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps({"ok": True, "service": "bsc-dex-arb-bot", **state}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    threading.Thread(target=scan_loop, daemon=True).start()
    ThreadingServer = ThreadingHTTPServer
    ThreadingServer(("0.0.0.0", int(os.getenv("PORT", "10000"))), Handler).serve_forever()
