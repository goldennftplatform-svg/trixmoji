/**
 * DOSWAPZ - multi-chain wallet trade / activity proxy + Solana PnL
 * GET /api/wallet-trades?chain=sol|eth|base|polygon|arb|btc&address=...&limit=40
 */

const chainAddr = require('./lib/chain-address');
const {
  extractSolanaRpcLegs,
  extractHeliusLegs,
  formatLegsDetail,
  computeFifoPnl,
  fetchSolanaPrices,
  applySymbolsFromPrices
} = require('./lib/wallet-pnl');

const CHAINS = {
  sol: {
    label: 'Solana',
    explorer: 'https://solscan.io/tx/',
    validate: (a) => chainAddr.validateForChain('sol', a)
  },
  eth: {
    label: 'Ethereum',
    explorer: 'https://etherscan.io/tx/',
    blockscout: 'https://eth.blockscout.com',
    validate: (a) => chainAddr.validateForChain('eth', a)
  },
  base: {
    label: 'Base',
    explorer: 'https://basescan.org/tx/',
    blockscout: 'https://base.blockscout.com',
    validate: (a) => chainAddr.validateForChain('base', a)
  },
  polygon: {
    label: 'Polygon',
    explorer: 'https://polygonscan.com/tx/',
    blockscout: 'https://polygon.blockscout.com',
    validate: (a) => chainAddr.validateForChain('polygon', a)
  },
  arb: {
    label: 'Arbitrum',
    explorer: 'https://arbiscan.io/tx/',
    blockscout: 'https://arbitrum.blockscout.com',
    validate: (a) => chainAddr.validateForChain('arb', a)
  },
  btc: {
    label: 'Bitcoin',
    explorer: 'https://mempool.space/tx/',
    validate: (a) => chainAddr.validateForChain('btc', a)
  }
};

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet.solana.com';
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

const EVM_SWAP_HINTS = /swap|exchange|trade|router|uniswap|sushiswap|1inch|curve|balancer|odos|paraswap|jupiter/i;
const SOL_SWAP_PROGRAMS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // pump.fun
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA' // pumpswap
]);

const { rateLimitOrReject } = require('./lib/rate-limit');

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 60;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=45');
}

function parseLimit(q) {
  const n = Number(q && q.limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(5, Math.min(MAX_LIMIT, Math.floor(n)));
}

async function rpcSolana(method, params) {
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Solana RPC error');
  return json.result;
}

function formatTime(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}

function classifySolanaTx(tx, address, legs) {
  if (!tx) return { type: 'UNKNOWN', detail: 'Failed to parse' };
  const meta = tx.meta || {};
  if (meta.err) return { type: 'FAILED', detail: 'Transaction failed on-chain' };

  const message = tx.transaction && tx.transaction.message;
  const keys = (message && message.accountKeys) || [];
  const programs = keys.map((k) => (typeof k === 'string' ? k : k.pubkey)).filter(Boolean);
  const isSwapProg = programs.some((p) => SOL_SWAP_PROGRAMS.has(p));

  const detailFromLegs = formatLegsDetail(legs);
  if (isSwapProg || (legs && legs.length >= 2)) {
    return { type: 'SWAP', detail: detailFromLegs || 'DEX / aggregator interaction' };
  }
  if (legs && legs.length === 1) {
    return {
      type: legs[0].mint === 'SOL' ? 'TRANSFER' : 'TOKEN',
      detail: detailFromLegs || 'Token movement'
    };
  }
  if (meta.preTokenBalances && meta.preTokenBalances.length) {
    return { type: 'TOKEN', detail: detailFromLegs || 'SPL token movement' };
  }
  return { type: 'TRANSFER', detail: detailFromLegs || 'SOL or account update' };
}

function attachPnlToTrades(trades, pnl) {
  const map = (pnl && pnl.perTx) || {};
  return (trades || []).map((t) => {
    const p = map[t.hash];
    if (!p) return t;
    return {
      ...t,
      pnl: {
        realizedUsd: p.realizedUsd,
        realizedSol: p.realizedSol,
        realizedUsdc: p.realizedUsdc
      }
    };
  });
}

async function fetchSolanaHelius(address, limit) {
  const url =
    'https://api.helius.xyz/v0/addresses/' +
    encodeURIComponent(address) +
    '/transactions?api-key=' +
    encodeURIComponent(HELIUS_KEY) +
    '&limit=' +
    limit;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Helius unavailable');
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const extracted = extractHeliusLegs(row, address);
    const legs = extracted.legs;
    const swap = row.type === 'SWAP' || (row.events && row.events.swap);
    const ts = formatTime(row.timestamp);
    let type = swap ? 'SWAP' : String(row.type || 'TX').toUpperCase();
    if (row.transactionError) type = 'FAILED';
    let detail = formatLegsDetail(legs) || row.description || row.type || 'Activity';
    return {
      hash: row.signature,
      time: ts,
      type,
      detail: String(detail).slice(0, 160),
      explorerUrl: CHAINS.sol.explorer + row.signature,
      legs,
      solChange: extracted.solChange,
      feeSol: extracted.feeSol
    };
  });
}

async function fetchSolanaRpc(address, limit) {
  const sigs = await rpcSolana('getSignaturesForAddress', [address, { limit }]);
  if (!sigs || !sigs.length) return [];

  // Parallel batch getTransaction (chunks of 8)
  const trades = [];
  const chunkSize = 8;
  for (let i = 0; i < sigs.length; i += chunkSize) {
    const chunk = sigs.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (s) => {
        try {
          const tx = await rpcSolana('getTransaction', [
            s.signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
          ]);
          return { sig: s, tx };
        } catch (e) {
          return { sig: s, tx: null };
        }
      })
    );
    results.forEach(({ sig, tx }) => {
      const blockTime =
        tx && tx.blockTime
          ? tx.blockTime * 1000
          : sig.blockTime
            ? sig.blockTime * 1000
            : null;
      const extracted = extractSolanaRpcLegs(tx, address);
      const cls = classifySolanaTx(tx, address, extracted.legs);
      trades.push({
        hash: sig.signature,
        time: blockTime,
        type: cls.type,
        detail: String(cls.detail).slice(0, 160),
        explorerUrl: CHAINS.sol.explorer + sig.signature,
        legs: extracted.legs,
        solChange: extracted.solChange,
        feeSol: extracted.feeSol
      });
    });
  }
  return trades;
}

async function fetchSolana(address, limit) {
  if (HELIUS_KEY) {
    try {
      return { trades: await fetchSolanaHelius(address, limit), source: 'helius' };
    } catch (e) {
      /* fall through */
    }
  }
  return { trades: await fetchSolanaRpc(address, limit), source: 'solana-rpc' };
}

async function buildSolanaPnl(trades) {
  const mints = new Set(['SOL']);
  (trades || []).forEach((t) => {
    (t.legs || []).forEach((l) => {
      if (l.rawMint) mints.add(l.rawMint);
      if (l.mint && l.mint !== 'SOL') mints.add(l.mint);
    });
  });

  let prices = {};
  try {
    prices = await fetchSolanaPrices(Array.from(mints));
  } catch (e) {
    prices = {};
  }

  applySymbolsFromPrices(trades, prices);
  const pnl = computeFifoPnl(trades, prices);
  pnl.windowTrades = (trades || []).length;
  pnl.incomplete = true;
  pnl.note =
    'PnL from last ' +
    (trades || []).length +
    ' txs only (FIFO). Cost basis in SOL/USDC at trade time; USD uses current prices. Not tax advice.';
  return { trades: attachPnlToTrades(trades, pnl), pnl, prices };
}

async function fetchEvmEtherscan(address) {
  const key = process.env.ETHERSCAN_API_KEY || '';
  const url =
    'https://api.etherscan.io/api?module=account&action=txlist&address=' +
    encodeURIComponent(address) +
    '&startblock=0&endblock=99999999&page=1&offset=25&sort=desc' +
    (key ? '&apikey=' + encodeURIComponent(key) : '');
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Etherscan ' + res.status);
  const json = await res.json();
  if (json.status !== '1' || !Array.isArray(json.result)) {
    throw new Error(json.message || 'Etherscan unavailable');
  }
  return json.result.map((item) => {
    const method = item.functionName || '';
    const isSwap = EVM_SWAP_HINTS.test(method) || EVM_SWAP_HINTS.test(item.to || '');
    const valueEth = item.value ? Number(item.value) / 1e18 : 0;
    const from = String(item.from || '').toLowerCase();
    const to = String(item.to || '').toLowerCase();
    const addr = address.toLowerCase();
    let solChange = 0; // eth change
    if (from === addr) solChange -= valueEth;
    if (to === addr) solChange += valueEth;
    let detail = method || 'ETH transaction';
    if (!method && valueEth) {
      detail = (solChange >= 0 ? '+' : '') + valueEth.toFixed(6) + ' ETH';
    }
    const legs = [];
    if (Math.abs(valueEth) > 0) {
      legs.push({
        mint: 'ETH',
        symbol: 'ETH',
        amount: Math.abs(valueEth),
        decimals: 18,
        side: solChange >= 0 ? 'in' : 'out'
      });
    }
    return {
      hash: item.hash,
      time: item.timeStamp ? Number(item.timeStamp) * 1000 : null,
      type: isSwap ? 'SWAP' : 'TX',
      detail: String(detail).slice(0, 120),
      explorerUrl: CHAINS.eth.explorer + item.hash,
      legs
    };
  });
}

async function fetchEvmBlockscout(chainKey, address) {
  const chain = CHAINS[chainKey];
  const base = chain.blockscout + '/api/v2/addresses/' + encodeURIComponent(address) + '/transactions';
  const res = await fetch(base, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Blockscout ' + res.status + ': ' + text.slice(0, 120));
  }
  const json = await res.json();
  const items = (json.items || []).slice(0, 25);
  return items.map((item) => {
    const method = item.method || (item.decoded_input && item.decoded_input.method_call) || '';
    const to = item.to && item.to.hash ? item.to.hash : '';
    const valueWei = item.value || '0';
    const valueEth = Number(valueWei) / 1e18;
    const isSwap = EVM_SWAP_HINTS.test(method) || EVM_SWAP_HINTS.test(to);
    const type = isSwap
      ? 'SWAP'
      : item.tx_types && item.tx_types.length
        ? String(item.tx_types[0]).toUpperCase()
        : 'TX';
    let detail = method || 'Contract interaction';
    if (!method && valueEth) detail = valueEth.toFixed(6) + ' native';
    const from = item.from && item.from.hash ? item.from.hash.toLowerCase() : '';
    const toAddr = to ? to.toLowerCase() : '';
    const addr = address.toLowerCase();
    let side = null;
    if (toAddr === addr && valueEth > 0) side = 'in';
    if (from === addr && valueEth > 0) side = 'out';
    const legs = [];
    if (side) {
      legs.push({
        mint: chainKey === 'eth' ? 'ETH' : chainKey.toUpperCase(),
        symbol: chainKey === 'eth' ? 'ETH' : chainKey.toUpperCase(),
        amount: Math.abs(valueEth),
        decimals: 18,
        side
      });
    }
    return {
      hash: item.hash,
      time: formatTime(item.timestamp),
      type: isSwap ? 'SWAP' : type,
      detail: String(detail).slice(0, 120),
      explorerUrl: chain.explorer + item.hash,
      legs
    };
  });
}

async function fetchEvm(chainKey, address) {
  try {
    return await fetchEvmBlockscout(chainKey, address);
  } catch (err) {
    if (chainKey === 'eth') {
      return await fetchEvmEtherscan(address);
    }
    throw err;
  }
}

async function fetchBitcoin(address) {
  const url = 'https://blockstream.info/api/address/' + encodeURIComponent(address) + '/txs';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Bitcoin upstream ' + res.status);
  const txs = await res.json();
  if (!Array.isArray(txs)) return [];
  return txs.slice(0, 25).map((tx) => {
    const satsIn = (tx.vin || []).reduce((sum, vin) => {
      if (vin.prevout && vin.prevout.value) return sum + vin.prevout.value;
      return sum;
    }, 0);
    const satsOut = (tx.vout || []).reduce((sum, v) => sum + (v.value || 0), 0);
    const btc = Math.max(satsIn, satsOut) / 1e8;
    return {
      hash: tx.txid,
      time: tx.status && tx.status.block_time ? tx.status.block_time * 1000 : null,
      type: 'TRANSFER',
      detail: '~' + btc.toFixed(8) + ' BTC flow',
      explorerUrl: CHAINS.btc.explorer + tx.txid,
      legs: [
        {
          mint: 'BTC',
          symbol: 'BTC',
          amount: btc,
          decimals: 8,
          side: 'out'
        }
      ]
    };
  });
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (rateLimitOrReject(req, res, { prefix: 'wallet-trades', perMinute: 20, perDay: 400 })) {
    return;
  }

  const chainKey = String((req.query && req.query.chain) || 'sol').toLowerCase();
  const address = chainAddr.normalizeAddress((req.query && req.query.address) || '');
  const limit = parseLimit(req.query);

  const chain = CHAINS[chainKey];
  if (!chain) {
    return res.status(400).json({ error: 'Unsupported chain', supported: Object.keys(CHAINS) });
  }
  if (!address || !chain.validate(address)) {
    return res.status(400).json({ error: 'Invalid ' + chain.label + ' address' });
  }

  try {
    let trades = [];
    let source = 'unknown';
    let pnl = null;

    if (chainKey === 'sol') {
      const sol = await fetchSolana(address, limit);
      trades = sol.trades;
      source = sol.source;
      const built = await buildSolanaPnl(trades);
      trades = built.trades;
      pnl = built.pnl;
    } else if (chainKey === 'btc') {
      trades = await fetchBitcoin(address);
      source = 'blockstream';
      pnl = {
        available: false,
        note: 'BTC flow tracking only — multi-token FIFO PnL is Solana-first for now.'
      };
    } else {
      trades = await fetchEvm(chainKey, address);
      source =
        chainKey === 'eth' ? 'blockscout+etherscan' : 'blockscout';
      pnl = {
        available: false,
        note: 'EVM activity listed; full token PnL is Solana-first. Native value legs shown when present.'
      };
    }

    const swaps = trades.filter((t) => t.type === 'SWAP').length;
    return res.status(200).json({
      chain: chainKey,
      chainLabel: chain.label,
      address,
      trades,
      pnl,
      stats: {
        total: trades.length,
        swaps,
        source,
        limit,
        pnlAvailable: !!(pnl && pnl.tokens)
      }
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Wallet tracker upstream unavailable',
      detail: String(err.message || err)
    });
  }
};
