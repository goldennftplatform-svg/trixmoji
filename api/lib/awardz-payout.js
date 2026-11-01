/**
 * Optional auto-payout. Runs only when AWARDZ_AUTO_PAY=1 and keys exist.
 * Without keys, settle still records exact sends as awaiting_payout.
 */
const { firstRpc, solRpcs, ethRpcs, SOL_TREASURY, ETH_TREASURY } = require('./awardz-chain');

function autoPayOn() {
  return String(process.env.AWARDZ_AUTO_PAY || '').trim() === '1';
}

async function sendSol(to, lamports) {
  const secret = String(process.env.AWARDZ_SOL_KEY || '').trim();
  if (!secret) return { skipped: true, reason: 'no AWARDZ_SOL_KEY' };
  let web3;
  try {
    web3 = require('@solana/web3.js');
  } catch (e) {
    return { skipped: true, reason: 'no @solana/web3.js' };
  }
  const bs58mod = (function () {
    try {
      return require('bs58');
    } catch (e) {
      return null;
    }
  })();
  let raw;
  if (secret.startsWith('[')) {
    raw = Uint8Array.from(JSON.parse(secret));
  } else if (bs58mod) {
    raw = bs58mod.decode(secret);
  } else {
    return { skipped: true, reason: 'SOL key format needs bs58 or JSON array' };
  }
  const kp = web3.Keypair.fromSecretKey(raw);
  const rpc = solRpcs()[0];
  const conn = new web3.Connection(rpc, 'confirmed');
  const from = kp.publicKey;
  const dest = new web3.PublicKey(to);
  const n = Number(lamports);
  if (!(n > 0)) return { skipped: true, reason: 'zero sol' };
  const tx = new web3.Transaction().add(
    web3.SystemProgram.transfer({ fromPubkey: from, toPubkey: dest, lamports: n })
  );
  const sig = await web3.sendAndConfirmTransaction(conn, tx, [kp]);
  return { ok: true, txid: sig, from: from.toBase58() };
}

async function sendEth(to, wei) {
  const key = String(process.env.AWARDZ_ETH_KEY || '').trim();
  if (!key) return { skipped: true, reason: 'no AWARDZ_ETH_KEY' };
  let ethers;
  try {
    ethers = require('ethers');
  } catch (e) {
    return { skipped: true, reason: 'no ethers' };
  }
  const rpc = ethRpcs()[0];
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);
  const n = ethers.BigNumber.from(String(wei));
  if (n.lte(0)) return { skipped: true, reason: 'zero eth' };
  const tx = await wallet.sendTransaction({ to: to, value: n });
  const rec = await tx.wait(1);
  return { ok: true, txid: rec.transactionHash, from: wallet.address };
}

async function payOne(payout) {
  const n = Number(payout.amount);
  if (!(n > 0)) return { skipped: true, reason: 'zero' };
  if (payout.chain === 'sol') return sendSol(payout.to, payout.amount);
  if (payout.chain === 'eth') return sendEth(payout.to, payout.amount);
  return { skipped: true, reason: 'chain' };
}

async function payAll(payouts) {
  const results = [];
  if (!autoPayOn()) {
    return payouts.map(function (p) {
      return Object.assign({}, p, { result: { skipped: true, reason: 'AWARDZ_AUTO_PAY not 1' } });
    });
  }
  for (let i = 0; i < payouts.length; i++) {
    const p = payouts[i];
    try {
      const result = await payOne(p);
      results.push(Object.assign({}, p, { result: result }));
    } catch (e) {
      results.push(
        Object.assign({}, p, { result: { ok: false, error: String(e && e.message ? e.message : e) } })
      );
    }
  }
  return results;
}

module.exports = {
  autoPayOn,
  payAll,
  SOL_TREASURY,
  ETH_TREASURY
};
