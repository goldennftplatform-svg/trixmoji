/** Vantablack Market - DOSWAPZ basement-native token catalog */
window.VANTABLACK_CONFIG = {
 name: 'Vantablack Market',
 tagline: 'Downstairs. On-chain.',
 homePath: '/classic/pages/basement/vantablack/market.html',
 swapPath: '/classic/pages/doswapz/swap.html?toMint=',
 launcherPath: '/classic/pages/basement/token-launcher.html',
 catalogUrl: '/assets/data/vantablack-coins.json',
 apiUrl: '/api/vantablack-coins',
 rpcUrl: '/api/solana-rpc',
 statsApiUrl: '/api/vantablack-token-stats',
 graduationMcap: 69000,
 localCacheKey: 'vantablack_coins_v1',

 /* Trix-style create: creator keeps 100% supply; site takes a small launch cut. */
 siteFeeSol: '5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc',
 siteFeeEth: '',
 launchFeeSol: 0.02,
 launchFeeEth: 0.0008,
 creatorSupplyBps: 10000,
 siteLaunchShareBps: 0
};