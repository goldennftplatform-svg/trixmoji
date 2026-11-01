/**
 * DOSWAPZ I SEE YOU — wallet PnL helpers
 * FIFO cost basis in SOL + USDC (stable = $1), USD display via current prices.
 */

const WSOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const QUOTE_MINTS = new Set([WSOL, USDC, USDT, 'SOL']);
const STABLE_MINTS = new Set([USDC, USDT]);

const KNOWN_SYMBOLS = {
  SOL: 'SOL',
  [WSOL]: 'SOL',
  [USDC]: 'USDC',
  [USDT]: 'USDT'
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(n, d) {
  if (!Number.isFinite(n)) return null;
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function isQuoteMint(mint) {
  return QUOTE_MINTS.has(mint);
}

function isStable(mint) {
  return STABLE_MINTS.has(mint);
}

function symbolFor(mint, fallback) {
  if (KNOWN_SYMBOLS[mint]) return KNOWN_SYMBOLS[mint];
  if (fallback) return String(fallback).slice(0, 12);
  if (!mint || mint === 'SOL') return 'SOL';
  return String(mint).slice(0, 4) + '…' + String(mint).slice(-4);
}

/**
 * Build signed token/SOL deltas for a wallet from a jsonParsed Solana tx.
 * @returns {{ legs: Array, solChange: number, feeSol: number }}
 */
function extractSolanaRpcLegs(tx, address) {
  if (!tx || !tx.meta) {
    return { legs: [], solChange: 0, feeSol: 0 };
  }

  const meta = tx.meta;
  const message = (tx.transaction && tx.transaction.message) || {};
  const keys = (message.accountKeys || []).map((k) =>
    typeof k === 'string' ? k : k.pubkey || k
  );
  const feeLamports = num(meta.fee);
  const feeSol = feeLamports / 1e9;

  let solChange = 0;
  const idx = keys.indexOf(address);
  if (idx >= 0 && Array.isArray(meta.preBalances) && Array.isArray(meta.postBalances)) {
    solChange = (num(meta.postBalances[idx]) - num(meta.preBalances[idx])) / 1e9;
  }

  const preMap = new Map();
  const postMap = new Map();
  const metaByMint = new Map();

  function uiAmt(entry) {
    if (!entry || !entry.uiTokenAmount) return 0;
    const u = entry.uiTokenAmount;
    if (u.uiAmount != null && Number.isFinite(Number(u.uiAmount))) return Number(u.uiAmount);
    const dec = num(u.decimals);
    return num(u.amount) / Math.pow(10, dec || 0);
  }

  (meta.preTokenBalances || []).forEach((b) => {
    if (b.owner !== address || !b.mint) return;
    preMap.set(b.mint, (preMap.get(b.mint) || 0) + uiAmt(b));
    metaByMint.set(b.mint, {
      decimals: b.uiTokenAmount ? num(b.uiTokenAmount.decimals) : 0,
      symbol: null
    });
  });
  (meta.postTokenBalances || []).forEach((b) => {
    if (b.owner !== address || !b.mint) return;
    postMap.set(b.mint, (postMap.get(b.mint) || 0) + uiAmt(b));
    const prev = metaByMint.get(b.mint) || {};
    metaByMint.set(b.mint, {
      decimals: b.uiTokenAmount ? num(b.uiTokenAmount.decimals) : prev.decimals || 0,
      symbol: prev.symbol || null
    });
  });

  const mints = new Set([...preMap.keys(), ...postMap.keys()]);
  const legs = [];

  mints.forEach((mint) => {
    // Collapse WSOL into SOL concept for PnL quotes; still expose as SOL
    const delta = (postMap.get(mint) || 0) - (preMap.get(mint) || 0);
    if (Math.abs(delta) < 1e-12) return;
    const info = metaByMint.get(mint) || {};
    const mintKey = mint === WSOL ? 'SOL' : mint;
    legs.push({
      mint: mintKey,
      rawMint: mint,
      symbol: symbolFor(mintKey, info.symbol),
      amount: Math.abs(delta),
      decimals: info.decimals || 0,
      side: delta > 0 ? 'in' : 'out'
    });
  });

  if (Math.abs(solChange) > 1e-12) {
    // Net SOL movement already includes fee + WSOL unwraps; if WSOL leg exists, keep both
    // but prefer showing native SOL delta when no WSOL token leg
    const hasWsol = legs.some((l) => l.rawMint === WSOL);
    if (!hasWsol) {
      legs.push({
        mint: 'SOL',
        rawMint: 'SOL',
        symbol: 'SOL',
        amount: Math.abs(solChange),
        decimals: 9,
        side: solChange > 0 ? 'in' : 'out'
      });
    }
  }

  return { legs, solChange, feeSol };
}

/**
 * Parse Helius enhanced transaction into legs.
 */
function extractHeliusLegs(row, address) {
  const legs = [];
  let solChange = 0;
  let feeSol = 0;

  if (row.fee != null) feeSol = num(row.fee) / 1e9;

  const swap = row.events && row.events.swap;
  if (swap) {
    if (swap.nativeInput && num(swap.nativeInput.amount)) {
      const amt = num(swap.nativeInput.amount) / 1e9;
      solChange -= amt;
      legs.push({
        mint: 'SOL',
        rawMint: 'SOL',
        symbol: 'SOL',
        amount: amt,
        decimals: 9,
        side: 'out'
      });
    }
    if (swap.nativeOutput && num(swap.nativeOutput.amount)) {
      const amt = num(swap.nativeOutput.amount) / 1e9;
      solChange += amt;
      legs.push({
        mint: 'SOL',
        rawMint: 'SOL',
        symbol: 'SOL',
        amount: amt,
        decimals: 9,
        side: 'in'
      });
    }

    const pushTok = (list, side) => {
      (list || []).forEach((t) => {
        const mint = t.mint;
        if (!mint) return;
        const raw = t.rawTokenAmount || {};
        const dec = num(raw.decimals);
        const amt =
          raw.tokenAmount != null
            ? num(raw.tokenAmount) / Math.pow(10, dec || 0)
            : num(t.tokenAmount);
        if (Math.abs(amt) < 1e-18) return;
        const mintKey = mint === WSOL ? 'SOL' : mint;
        legs.push({
          mint: mintKey,
          rawMint: mint,
          symbol: symbolFor(mintKey),
          amount: Math.abs(amt),
          decimals: dec,
          side
        });
      });
    };
    pushTok(swap.tokenInputs, 'out');
    pushTok(swap.tokenOutputs, 'in');
  }

  // Fallback / supplement: tokenTransfers + nativeTransfers for this user
  if (!legs.length) {
    (row.tokenTransfers || []).forEach((t) => {
      const mint = t.mint;
      if (!mint) return;
      let side = null;
      if (t.toUserAccount === address) side = 'in';
      else if (t.fromUserAccount === address) side = 'out';
      if (!side) return;
      const amt = num(t.tokenAmount);
      if (Math.abs(amt) < 1e-18) return;
      const mintKey = mint === WSOL ? 'SOL' : mint;
      legs.push({
        mint: mintKey,
        rawMint: mint,
        symbol: symbolFor(mintKey),
        amount: Math.abs(amt),
        decimals: 0,
        side
      });
    });
    (row.nativeTransfers || []).forEach((t) => {
      let side = null;
      if (t.toUserAccount === address) side = 'in';
      else if (t.fromUserAccount === address) side = 'out';
      if (!side) return;
      const amt = num(t.amount) / 1e9;
      if (Math.abs(amt) < 1e-12) return;
      solChange += side === 'in' ? amt : -amt;
      legs.push({
        mint: 'SOL',
        rawMint: 'SOL',
        symbol: 'SOL',
        amount: amt,
        decimals: 9,
        side
      });
    });
  }

  // Merge duplicate mint+side
  const merged = new Map();
  legs.forEach((l) => {
    const key = l.mint + '|' + l.side;
    const prev = merged.get(key);
    if (prev) {
      prev.amount += l.amount;
    } else {
      merged.set(key, { ...l });
    }
  });

  return { legs: Array.from(merged.values()), solChange, feeSol };
}

function formatLegsDetail(legs) {
  if (!legs || !legs.length) return null;
  const outs = legs.filter((l) => l.side === 'out');
  const ins = legs.filter((l) => l.side === 'in');
  const fmt = (l) => {
    const a = l.amount >= 1000 ? round(l.amount, 2) : round(l.amount, 6);
    return (a != null ? a : l.amount) + ' ' + (l.symbol || '?');
  };
  if (outs.length && ins.length) {
    return outs.map(fmt).join(' + ') + ' → ' + ins.map(fmt).join(' + ');
  }
  if (ins.length) return 'IN ' + ins.map(fmt).join(' + ');
  if (outs.length) return 'OUT ' + outs.map(fmt).join(' + ');
  return null;
}

/**
 * Quote value of legs in SOL + USDC units (for FIFO).
 */
function quoteFromLegs(legs) {
  let sol = 0;
  let usdc = 0;
  (legs || []).forEach((l) => {
    const signed = l.side === 'in' ? 1 : -1;
    if (l.mint === 'SOL' || l.mint === WSOL) sol += signed * num(l.amount);
    else if (isStable(l.mint) || isStable(l.rawMint)) usdc += signed * num(l.amount);
  });
  return { sol, usdc };
}

function consumeLots(lotList, amount) {
  let remain = num(amount);
  let costSol = 0;
  let costUsdc = 0;
  while (remain > 1e-18 && lotList.length) {
    const lot = lotList[0];
    const take = Math.min(remain, lot.amount);
    const ratio = lot.amount > 0 ? take / lot.amount : 0;
    costSol += lot.costSol * ratio;
    costUsdc += lot.costUsdc * ratio;
    lot.amount -= take;
    lot.costSol *= 1 - ratio;
    lot.costUsdc *= 1 - ratio;
    remain -= take;
    if (lot.amount <= 1e-18) lotList.shift();
  }
  return { costSol, costUsdc, uncovered: remain };
}

/**
 * FIFO PnL over chronological trades (oldest first).
 * Cost basis in SOL + USDC. USD conversion uses current prices map.
 */
function computeFifoPnl(trades, prices) {
  const priceOf = (mint) => {
    if (mint === 'SOL' || mint === WSOL) return num(prices.SOL || prices[WSOL]);
    if (isStable(mint)) return 1;
    return num(prices[mint]);
  };

  const solUsd = priceOf('SOL') || 0;
  const lots = new Map();
  const tokenStats = new Map();
  const perTx = {};

  function ensureToken(mint, symbol) {
    if (!tokenStats.has(mint)) {
      tokenStats.set(mint, {
        mint,
        symbol: symbol || symbolFor(mint),
        bought: 0,
        sold: 0,
        transferredIn: 0,
        transferredOut: 0,
        realizedSol: 0,
        realizedUsdc: 0
      });
    } else if (symbol && /…|\.\.\./.test(tokenStats.get(mint).symbol)) {
      tokenStats.get(mint).symbol = symbol;
    }
    return tokenStats.get(mint);
  }

  function getLots(mint) {
    if (!lots.has(mint)) lots.set(mint, []);
    return lots.get(mint);
  }

  function addBuy(mint, symbol, amount, costSol, costUsdc) {
    const amt = num(amount);
    if (amt <= 0) return;
    const st = ensureToken(mint, symbol);
    st.bought += amt;
    getLots(mint).push({
      amount: amt,
      costSol: num(costSol),
      costUsdc: num(costUsdc)
    });
  }

  function sellForQuote(mint, symbol, amount, proceedsSol, proceedsUsdc) {
    const st = ensureToken(mint, symbol);
    const amt = num(amount);
    st.sold += amt;
    const { costSol, costUsdc } = consumeLots(getLots(mint), amt);
    const rSol = num(proceedsSol) - costSol;
    const rUsdc = num(proceedsUsdc) - costUsdc;
    st.realizedSol += rSol;
    st.realizedUsdc += rUsdc;
    return { rSol, rUsdc };
  }

  function transferOut(mint, symbol, amount) {
    const st = ensureToken(mint, symbol);
    const amt = num(amount);
    st.transferredOut += amt;
    consumeLots(getLots(mint), amt);
  }

  function transferIn(mint, symbol, amount) {
    const st = ensureToken(mint, symbol);
    const amt = num(amount);
    st.transferredIn += amt;
    st.bought += amt;
    getLots(mint).push({ amount: amt, costSol: 0, costUsdc: 0 });
  }

  const chrono = (trades || [])
    .slice()
    .filter((t) => t && Array.isArray(t.legs) && t.legs.length)
    .sort((a, b) => {
      const ta = a.time || 0;
      const tb = b.time || 0;
      if (ta !== tb) return ta - tb;
      return String(a.hash || '').localeCompare(String(b.hash || ''));
    });

  chrono.forEach((trade) => {
    const legs = trade.legs || [];
    const ins = legs.filter((l) => l.side === 'in' && !isQuoteMint(l.mint));
    const outs = legs.filter((l) => l.side === 'out' && !isQuoteMint(l.mint));
    const quote = quoteFromLegs(legs);
    const spentSol = quote.sol < 0 ? -quote.sol : 0;
    const spentUsdc = quote.usdc < 0 ? -quote.usdc : 0;
    const gotSol = quote.sol > 0 ? quote.sol : 0;
    const gotUsdc = quote.usdc > 0 ? quote.usdc : 0;

    let txRealizedSol = 0;
    let txRealizedUsdc = 0;

    // 1) Token → token: move cost basis from outs to ins (no SOL/USDC realized)
    if (ins.length && outs.length && spentSol < 1e-12 && spentUsdc < 1e-12 && gotSol < 1e-12 && gotUsdc < 1e-12) {
      let costSolPool = 0;
      let costUsdcPool = 0;
      outs.forEach((o) => {
        const st = ensureToken(o.mint, o.symbol);
        st.sold += num(o.amount);
        const c = consumeLots(getLots(o.mint), o.amount);
        costSolPool += c.costSol;
        costUsdcPool += c.costUsdc;
      });
      const totalIn = ins.reduce((s, l) => s + num(l.amount), 0) || 1;
      ins.forEach((i) => {
        const share = num(i.amount) / totalIn;
        addBuy(i.mint, i.symbol, i.amount, costSolPool * share, costUsdcPool * share);
      });
    } else {
      // 2) Sells for quote
      if (outs.length && (gotSol > 0 || gotUsdc > 0)) {
        const totalOut = outs.reduce((s, l) => s + num(l.amount), 0) || 1;
        outs.forEach((o) => {
          const share = num(o.amount) / totalOut;
          const r = sellForQuote(o.mint, o.symbol, o.amount, gotSol * share, gotUsdc * share);
          txRealizedSol += r.rSol;
          txRealizedUsdc += r.rUsdc;
        });
      } else if (outs.length && !ins.length) {
        // transfer out
        outs.forEach((o) => transferOut(o.mint, o.symbol, o.amount));
      }

      // 3) Buys with quote
      if (ins.length && (spentSol > 0 || spentUsdc > 0)) {
        const totalIn = ins.reduce((s, l) => s + num(l.amount), 0) || 1;
        ins.forEach((i) => {
          const share = num(i.amount) / totalIn;
          addBuy(i.mint, i.symbol, i.amount, spentSol * share, spentUsdc * share);
        });
      } else if (ins.length && !outs.length && spentSol < 1e-12 && spentUsdc < 1e-12) {
        // airdrop / transfer in
        ins.forEach((i) => transferIn(i.mint, i.symbol, i.amount));
      }
    }

    if (trade.hash) {
      perTx[trade.hash] = {
        realizedSol: round(txRealizedSol, 9),
        realizedUsdc: round(txRealizedUsdc, 6),
        realizedUsd: round(txRealizedSol * solUsd + txRealizedUsdc, 4)
      };
    }
  });

  let totalRealizedUsd = 0;
  let totalUnrealizedUsd = 0;
  let totalRealizedSol = 0;
  let totalCostUsd = 0;
  let totalMktUsd = 0;
  const tokens = [];

  tokenStats.forEach((st, mint) => {
    const lotList = getLots(mint);
    let remaining = 0;
    let costSol = 0;
    let costUsdc = 0;
    lotList.forEach((lot) => {
      remaining += lot.amount;
      costSol += lot.costSol;
      costUsdc += lot.costUsdc;
    });
    remaining = Math.max(0, remaining);
    const px = priceOf(mint);
    const costUsd = costSol * solUsd + costUsdc;
    const mktUsd = px > 0 ? remaining * px : null;
    const unrealizedUsd = mktUsd != null ? mktUsd - costUsd : null;
    const realizedUsd = st.realizedSol * solUsd + st.realizedUsdc;

    totalRealizedUsd += realizedUsd;
    totalRealizedSol += st.realizedSol;
    if (unrealizedUsd != null) totalUnrealizedUsd += unrealizedUsd;
    totalCostUsd += costUsd;
    if (mktUsd != null) totalMktUsd += mktUsd;

    tokens.push({
      mint,
      symbol: st.symbol,
      bought: round(st.bought, 8),
      sold: round(st.sold, 8),
      transferredIn: round(st.transferredIn, 8),
      transferredOut: round(st.transferredOut, 8),
      remaining: round(remaining, 8),
      costBasisSol: round(costSol, 9),
      costBasisUsdc: round(costUsdc, 6),
      costBasisUsd: round(costUsd, 4),
      avgCostUsd: remaining > 0 ? round(costUsd / remaining, 8) : null,
      currentPriceUsd: px > 0 ? round(px, 10) : null,
      marketValueUsd: mktUsd != null ? round(mktUsd, 4) : null,
      realizedUsd: round(realizedUsd, 4),
      realizedSol: round(st.realizedSol, 9),
      unrealizedUsd: unrealizedUsd != null ? round(unrealizedUsd, 4) : null,
      totalPnlUsd:
        unrealizedUsd != null ? round(realizedUsd + unrealizedUsd, 4) : round(realizedUsd, 4)
    });
  });

  tokens.sort((a, b) => {
    const ap = Math.abs(b.totalPnlUsd || 0) - Math.abs(a.totalPnlUsd || 0);
    if (ap !== 0) return ap;
    return (b.marketValueUsd || 0) - (a.marketValueUsd || 0);
  });

  return {
    method: 'FIFO',
    quote: 'USD',
    costBasis: 'SOL+USDC at trade time; USD via current SOL/token prices',
    solPriceUsd: solUsd > 0 ? round(solUsd, 4) : null,
    realizedUsd: round(totalRealizedUsd, 4),
    unrealizedUsd: round(totalUnrealizedUsd, 4),
    totalPnlUsd: round(totalRealizedUsd + totalUnrealizedUsd, 4),
    realizedSol: round(totalRealizedSol, 9),
    openCostUsd: round(totalCostUsd, 4),
    openValueUsd: round(totalMktUsd, 4),
    tokenCount: tokens.length,
    tokens,
    perTx
  };
}

/**
 * Fetch USD prices for Solana mints (Jupiter v2, DexScreener fallback).
 */
async function fetchSolanaPrices(mints) {
  const prices = { [USDC]: 1, [USDT]: 1, USDC: 1, USDT: 1 };
  const unique = Array.from(
    new Set(
      (mints || [])
        .map((m) => (m === 'SOL' ? WSOL : m))
        .filter((m) => m && m !== 'SOL')
    )
  );

  // Always want SOL
  if (!unique.includes(WSOL)) unique.unshift(WSOL);

  // Jupiter price API (batched)
  try {
    const ids = unique.slice(0, 100).join(',');
    const res = await fetch('https://api.jup.ag/price/v2?ids=' + encodeURIComponent(ids), {
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const json = await res.json();
      const data = json.data || json;
      Object.keys(data || {}).forEach((mint) => {
        const row = data[mint];
        const p = num(row && (row.price != null ? row.price : row));
        if (p > 0) {
          prices[mint] = p;
          if (mint === WSOL) prices.SOL = p;
        }
      });
    }
  } catch (e) {
    /* fall through */
  }

  // DexScreener for missing (limit concurrency)
  const missing = unique.filter((m) => !prices[m] || prices[m] <= 0).slice(0, 12);
  await Promise.all(
    missing.map(async (mint) => {
      try {
        const res = await fetch(
          'https://api.dexscreener.com/latest/dex/tokens/' + encodeURIComponent(mint),
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const pairs = data.pairs || [];
        if (!pairs.length) return;
        pairs.sort(
          (a, b) =>
            num(b.liquidity && b.liquidity.usd) - num(a.liquidity && a.liquidity.usd)
        );
        const p = num(pairs[0].priceUsd);
        if (p > 0) {
          prices[mint] = p;
          if (mint === WSOL) prices.SOL = p;
          const sym = pairs[0].baseToken && pairs[0].baseToken.symbol;
          if (sym) prices['__sym_' + mint] = String(sym).slice(0, 12);
        }
      } catch (e) {
        /* ignore */
      }
    })
  );

  if (!prices.SOL && prices[WSOL]) prices.SOL = prices[WSOL];
  return prices;
}

/**
 * Apply symbols from price metadata onto legs/tokens.
 */
function applySymbolsFromPrices(trades, prices) {
  (trades || []).forEach((t) => {
    (t.legs || []).forEach((l) => {
      if (l.mint === 'SOL') {
        l.symbol = 'SOL';
        return;
      }
      const sym = prices['__sym_' + (l.rawMint || l.mint)] || prices['__sym_' + l.mint];
      if (sym) l.symbol = sym;
      else if (!l.symbol || l.symbol.indexOf('…') !== -1) {
        l.symbol = symbolFor(l.mint);
      }
    });
    const richer = formatLegsDetail(t.legs);
    if (richer) t.detail = richer;
  });
}

module.exports = {
  WSOL,
  USDC,
  USDT,
  extractSolanaRpcLegs,
  extractHeliusLegs,
  formatLegsDetail,
  computeFifoPnl,
  fetchSolanaPrices,
  applySymbolsFromPrices,
  symbolFor,
  isQuoteMint
};
