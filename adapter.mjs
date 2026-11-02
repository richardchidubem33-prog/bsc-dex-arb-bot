#!/usr/bin/env node
/**
 * Read-only DEX route scanner.
 * This entry point never loads a private key and never submits a transaction.
 */
import { main } from "./scanner/quote-scanner.mjs";

const report = await main();
console.log(JSON.stringify(report, null, 2));
