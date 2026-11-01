window.DOSWAPZ_I_SEE_YOU_CONFIG = {
  apiUrl: '/api/wallet-trades',
  defaultChain: 'sol',
  chains: [
    { id: 'sol', label: 'Solana (SOL)' },
    { id: 'eth', label: 'Ethereum (ETH)' },
    { id: 'base', label: 'Base' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'arb', label: 'Arbitrum' },
    { id: 'hood', label: 'Robinhood Chain' },
    { id: 'btc', label: 'Bitcoin (BTC)' }
  ],
  maxTrades: 40,
  storageKey: 'doswapz_iseeyou_last',
  classicPath: '/classic/pages/i-see-you.html',
  orbitPath: '/orbit/pages/i-see-you.html'
};