function heliusKey() {
  const direct = String(process.env.HELIUS_API_KEY || '').trim()
  if (direct) return direct
  const url = String(process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || '')
  const m = url.match(/api-key=([^&]+)/i)
  return m ? m[1].trim() : ''
}

function heliusRpcUrl() {
  const explicit = String(process.env.HELIUS_RPC_URL || '').trim()
  if (explicit) return explicit
  const key = heliusKey()
  if (!key) return ''
  return 'https://mainnet.helius-rpc.com/?api-key=' + key
}

function solRpcUrls() {
  const list = []
  const seen = new Set()
  function add(url) {
    const u = String(url || '').trim()
    if (!u || seen.has(u)) return
    seen.add(u)
    list.push(u)
  }
  add(process.env.SOLANA_RPC_URL)
  add(heliusRpcUrl())
  const key = heliusKey()
  if (key) add('https://mainnet.helius-rpc.com/?api-key=' + key)
  add('https://solana-rpc.publicnode.com')
  add('https://api.mainnet-beta.solana.com')
  add('https://api.mainnet.solana.com')
  return list
}

module.exports = { heliusKey, heliusRpcUrl, solRpcUrls }
