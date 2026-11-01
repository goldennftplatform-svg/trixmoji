/**
 * Verify Awardz native SOL / ETH transfers to published DOSWAPZ wallets.
 */
const { SOL_TREASURY, ETH_TREASURY } = require('./doswapz-treasury');

const { solRpcUrls } = require('./helius-rpc');

function solRpcs() {
  return solRpcUrls();
}

function ethRpcs() {
  const list = [];
  if (process.env.ETH_RPC_URL) list.push(process.env.ETH_RPC_URL);
  list.push('https://ethereum.publicnode.com', 'https://cloudflare-eth.com');
  return list;
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params || [] })
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

async function firstRpc(urls, method, params) {
  let last = 'no rpc';
  for (let i = 0; i < urls.length; i++) {
    try {
      return await rpc(urls[i], method, params);
    } catch (e) {
      last = String(e && e.message ? e.message : e);
    }
  }
  throw new Error(last);
}

function eqAddr(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

async function verifySol(txid, expectFrom, lamports) {
  const tx = await firstRpc(solRpcs(), 'getTransaction', [
    txid,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
  ]);
  if (!tx) throw new Error('SOL tx not found yet');
  if (tx.meta && tx.meta.err) throw new Error('SOL tx failed on-chain');
  const keys = (((tx.transaction || {}).message || {}).accountKeys) || [];
  const msg = (tx.transaction || {}).message || {};
  const ixs = msg.instructions || [];
  let found = false;
  for (let i = 0; i < ixs.length; i++) {
    const ix = ixs[i];
    const parsed = ix.parsed || {};
    if (parsed.type === 'transfer' && parsed.info) {
      const info = parsed.info;
      if (
        eqAddr(info.destination, SOL_TREASURY) &&
        eqAddr(info.source, expectFrom) &&
        String(info.lamports) === String(lamports)
      ) {
        found = true;
        break;
      }
    }
  }
  if (!found) {
    const pre = (tx.meta && tx.meta.preBalances) || [];
    const post = (tx.meta && tx.meta.postBalances) || [];
    let destIdx = -1;
    let srcIdx = -1;
    for (let k = 0; k < keys.length; k++) {
      const pk = typeof keys[k] === 'string' ? keys[k] : keys[k].pubkey;
      if (eqAddr(pk, SOL_TREASURY)) destIdx = k;
      if (eqAddr(pk, expectFrom)) srcIdx = k;
    }
    if (destIdx >= 0 && srcIdx >= 0) {
      const delta = Number(post[destIdx] || 0) - Number(pre[destIdx] || 0);
      if (String(delta) === String(lamports)) found = true;
    }
  }
  if (!found) throw new Error('SOL tx does not match Awardz intent (to/from/amount)');
  return { chain: 'sol', txid: txid, from: expectFrom, amount: String(lamports) };
}

function hexToDec(hex) {
  if (!hex) return '0';
  return BigInt(hex).toString(10);
}

async function verifyEth(txid, expectFrom, wei) {
  const tx = await firstRpc(ethRpcs(), 'eth_getTransactionByHash', [txid]);
  if (!tx) throw new Error('ETH tx not found yet');
  if (!eqAddr(tx.to, ETH_TREASURY)) throw new Error('ETH tx not sent to DOSWAPZ address');
  if (!eqAddr(tx.from, expectFrom)) throw new Error('ETH tx from-address mismatch');
  if (hexToDec(tx.value) !== String(wei)) throw new Error('ETH amount mismatch');
  const receipt = await firstRpc(ethRpcs(), 'eth_getTransactionReceipt', [txid]);
  if (!receipt || receipt.status !== '0x1') throw new Error('ETH tx not confirmed');
  return { chain: 'eth', txid: txid, from: expectFrom, amount: String(wei) };
}

async function verifyDeposit(chain, txid, expectFrom, amountNative) {
  if (chain === 'sol') return verifySol(txid, expectFrom, amountNative);
  if (chain === 'eth') return verifyEth(txid, expectFrom, amountNative);
  throw new Error('Unknown chain');
}

module.exports = {
  SOL_TREASURY,
  ETH_TREASURY,
  verifyDeposit,
  solRpcs,
  ethRpcs,
  firstRpc
};
