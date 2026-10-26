#!/usr/bin/env python3
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from arb_box import MockQuoteSource, find_opportunities, paper_execute, settings

cfg = settings()
state = {"scans": 0, "last_candidates": 0, "last_eligible": 0, "mode": cfg["execution"]}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/", "/health"):
            self.send_response(404); self.end_headers(); return
        body = json.dumps({"ok": True, "service": "bsc-dex-arb-bot", **state}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def log_message(self, *_):
        pass

def scan_loop():
    source = MockQuoteSource()
    while True:
        opportunities = find_opportunities(source.get_quotes(), cfg)
        eligible = [o for o in opportunities if o.net_profit_usd >= cfg["min_profit"]]
        state.update(scans=state["scans"] + 1, last_candidates=len(opportunities), last_eligible=len(eligible))
        for opp in eligible:
            paper_execute(opp, cfg)
        time.sleep(float(os.getenv("SCAN_INTERVAL_SECONDS", "5")))

if __name__ == "__main__":
    threading.Thread(target=scan_loop, daemon=True).start()
    port = int(os.getenv("PORT", "10000"))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
