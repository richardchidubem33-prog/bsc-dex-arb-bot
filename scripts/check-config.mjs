const bool = (value) => String(value || "").toLowerCase() === "true";
const execution = process.env.EXECUTION || "paper";
const live = bool(process.env.LIVE_TRADING_ENABLED);
if (!['paper', 'read-only'].includes(execution)) throw new Error('EXECUTION must be paper or read-only');
if (live) throw new Error('LIVE_TRADING_ENABLED must remain false; live signing is not implemented');
if (process.env.MODE === 'mainnet' && execution !== 'read-only' && execution !== 'paper') throw new Error('Unsafe MODE/EXECUTION combination');
console.log(JSON.stringify({ ok: true, mode: process.env.MODE || 'mock', execution, liveSigning: 'disabled' }, null, 2));
