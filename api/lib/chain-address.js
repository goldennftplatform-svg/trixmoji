/* Shared multi-chain address normalization + validation */

const SOL_BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,50}$/;
const EVM_HEX = /^0x[a-fA-F0-9]{40}$/;
const BTC_BECH32 = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

function normalizeAddress(addr) {
  if (addr == null) return '';
  return String(addr)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^solana:/i, '');
}

function isSolanaAddress(addr) {
  addr = normalizeAddress(addr);
  return !!addr && SOL_BASE58.test(addr);
}

function isEvmAddress(addr) {
  addr = normalizeAddress(addr);
  return !!addr && EVM_HEX.test(addr);
}

function isBitcoinAddress(addr) {
  addr = normalizeAddress(addr);
  return !!addr && BTC_BECH32.test(addr);
}

function detectChainId(addr) {
  addr = normalizeAddress(addr);
  if (!addr) return null;
  if (isEvmAddress(addr)) return 'eth';
  if (isBitcoinAddress(addr)) return 'btc';
  if (isSolanaAddress(addr)) return 'sol';
  return null;
}

function validateForChain(chainId, addr) {
  addr = normalizeAddress(addr);
  if (!addr) return false;
  if (chainId === 'sol') return isSolanaAddress(addr);
  if (chainId === 'btc') return isBitcoinAddress(addr);
  if (chainId === 'eth' || chainId === 'base' || chainId === 'polygon' || chainId === 'arb') {
    return isEvmAddress(addr);
  }
  return false;
}

module.exports = {
  normalizeAddress: normalizeAddress,
  isSolanaAddress: isSolanaAddress,
  isEvmAddress: isEvmAddress,
  isBitcoinAddress: isBitcoinAddress,
  detectChainId: detectChainId,
  validateForChain: validateForChain
};