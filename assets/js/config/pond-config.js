/* DOSWAPZ - Pond0x dossier + OLD REWARDS-POOL RAILS swap config
 *
 * Pond protocol swap counting (manifest / boost / rewards pool stats) expects:
 *   1) Jupiter Metis Swap API v1 — legacy rails (NOT Ultra / v2-only / generic 0% Jupiter)
 *   2) platformFeeBps on quote (Pond-style ~1%) so a fee is taken into the rewards path
 *   3) feeAccount = Pond0x-created Jupiter Partner Referral Fee Vault (iwwl-funded vaults)
 *      — fees feed Pond rewards pool indexing, NOT a random integrator vault
 *
 * On Solscan: look for "Jupiter Partner Referral Fee Vault" -> Pond vault address.
 * Manifest lag 3-5 min. Pond still applies min-size / pair filters.
 */
window.POND_CONFIG = {
  name: 'Pond0x',
  railMode: 'old_rewards_pool',

  /* Legacy Metis endpoints only (old rewards-pool rails). Never Ultra here. */
  jupiterBases: [
    'https://lite-api.jup.ag/swap/v1',
    'https://api.jup.ag/swap/v1'
  ],

  defaultRpc: 'https://api.mainnet-beta.solana.com',

  /* ~1% platform fee into Pond Partner Referral vaults (rewards pool path) */
  platformFeeBps: 100,
  slippageBps: 100,

  /*
   * Pond0x Jupiter Partner Referral Fee Vaults (rewards-pool fee sinks).
   * Community-mapped from on-chain Pond swaps (Solscan "Partner Referral Fee Vault").
   * ONLY these addresses may be used as feeAccount on this panel.
   */
  pondFeeVaults: {
    So11111111111111111111111111111111111111112:
      '9hCLuXrQrHCU9i7y648Nh7uuWKHUsKDiZ5zyBHdZPWtG', /* SOL */
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:
      '6NqvoPpSYCPEtLEukQaSNs7mS3yK6k285saH9o3vgC96', /* USDC */
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:
      '5LmFGjbae5iWejFVT8UiRLggh1me22nTetmere8SjwKy', /* USDT */
    '3JgFwoYV74f6LwWjQWnr3YDPFnmBdwQfNyubv99jqUoq':
      'GKHmDYWPE8Bf74xDntnpx4hi4H7pRp3HK5QYvPyXGEiU', /* wPOND */
    he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A:
      '4jkVjzXtrCuxQus3neMtLfNL4wZhsPmm9fKGXoLMXqsG', /* hSOL */
    B5WTLaRwaUQpKk7ir1wniNB6m5o8GgMrimhKMYan2R6B:
      '3qGSU2RySrjvQ2iGMts2HZ4ssGVSrBUSGL4jN7LHGhgo' /* PepeOnSOL */
  },

  /* Tokens offered in dossier swap UI (must have vault above for fee path) */
  dossierTokens: [
    {
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9
    },
    {
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6
    },
    {
      symbol: 'USDT',
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6
    },
    {
      symbol: 'wPOND',
      mint: '3JgFwoYV74f6LwWjQWnr3YDPFnmBdwQfNyubv99jqUoq',
      decimals: 3
    },
    {
      symbol: 'hSOL',
      mint: 'he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A',
      decimals: 9
    },
    {
      symbol: 'PepeOnSOL',
      mint: 'B5WTLaRwaUQpKk7ir1wniNB6m5o8GgMrimhKMYan2R6B',
      decimals: 6
    }
  ],

  pondStatsApi: 'https://www.pond0x.com/api/solana',
  /* Status via DOSWAPZ only (no Cary0x, no private Pond session scrape) */
  dossierApi: '',
  dossierProxy: '/api/pond-dossier',
  miningApi: '',
  miningProxy: '/api/pond-mining',
  statsProxy: '/api/pond-stats',
  /* OLD RAILS: activated-rig list only (that list IS the allowlist) */
  communityProxy: '/api/pond-community',
  communityGate: true,
  /* Safety: no continuous farm loops; hard cap per auto session */
  oldRailsAllowContinuous: false,
  oldRailsAutoMax: 5,
  oldRailsAutoMinWaitSec: 12,
  jupiterSwapPath: '/classic/pages/doswapz/swap.html',
  docsDossier: '/docs/community-swap-rules.html',
  docsCommunityRules: '/docs/community-swap-rules.html',
  pondMiningUrl: 'https://www.pond0x.com/mining',

  /* Optional friends/ref credit if Pond still honors utm/ref elsewhere */
  referralWallet: '',

  /* Kept for legacy callers - native old-rails UI replaces iframe plugin */
  jupiterPlugin: '',

  dossierLagNote:
    'DOSWAPZ status uses our activated-rig list + public Pond luck only. Private Pro/swap passport fields are not scraped.',
  solRailNote:
    'OLD REWARDS-POOL RAILS: Metis v1 + Pond0x Partner Referral Fee Vaults. Unlocked only for activated Pond0x rigs (list = allowlist). Ultra & 0% Jupiter usually do not count.'
};

(function mergePondReferralFromFtwr() {
  var ftwr = window.FTWR_CONFIG;
  if (!ftwr || window.POND_CONFIG.referralWallet) return;
  if (ftwr.devWallet) window.POND_CONFIG.referralWallet = ftwr.devWallet;
})();
