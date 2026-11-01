/**
 * H4RB1NG3R finite protocol chatbot.
 * Surface DOSWAPZ how-it-works only. Deeper = CLASSIFIED. Off-protocol = PAYGRADE.
 * Cordial small-talk is canned. No invented intel. No live prices.
 *
 * KEEP IN SYNC WITH THE LIVE SITE.
 * When a protocol surface ships or changes (new page, pay address, legal section,
 * access rule), add or edit a KB row here and bump ?v= on both harbinger.html pages.
 */
window.HARBINGER_BRIEFING = (function () {
  'use strict'

  var PAYGRADE =
    'That sits above my paygrade. I brief DOSWAPZ protocol at surface clearance only: how the site works. Ask about swap, pond, token, The Missing Layer, mail gate, Awardz, legal, school, Geoffwatch, or OPSEC.'
  var CLASSIFIED =
    'CLASSIFIED. That depth is need-to-know. I will not discuss internals, private keys, team identity, unreleased plans, or anything past the published surface protocol.'
  var TOPICS =
    'Clearance topics: DOSWAPZ, Past/Present, Swap, Pond rails, Token, The Missing Layer, Mail Gate, Awardz, Legal, incoming treasuries, Chain Watch, Bridge, MEAT, Mint, I See You, Geoffwatch, Trix egg, School, Arcade, Attic, Basement, Lily Pad, PVC, Ape Chamber, Hardwear, OPSEC.'
  var TREAS =
    'Incoming DOSWAPZ treasuries: SOL 5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc * ETH 0x5be58476DF379BAdc88b552F603db227C0D95bac * BTC bc1qtwqxrsj8ur8zyp9ku47dx6ljhc9dxmjc8j4t2g. Verify on the pay screen at send time. Wrong chain is your loss.'

  var STOP = {
    what: 1, is: 1, are: 1, the: 1, a: 1, an: 1, do: 1, does: 1, i: 1, you: 1,
    my: 1, me: 1, can: 1, how: 1, to: 1, for: 1, of: 1, and: 1, or: 1, in: 1,
    on: 1, with: 1, about: 1, it: 1, this: 1, that: 1, your: 1, will: 1, be: 1,
    please: 1, just: 1, tell: 1, explain: 1, give: 1, like: 1, some: 1, any: 1
  }

  var KB = [
    { cat: 'DOSWAPZ', keys: ['doswapz', 'mission', 'purpose', 'stand', 'doctrine', 'platform', 'site', 'ecosystem'], q: 'What is DOSWAPZ?', a: 'DOSWAPZ = Degen Optimized Sovereign Warfare Against Pumpz. Public command hub for swap, mint, pond rails, alerts, arcade, and OPSEC-first tools. Live platform. You sign your own txs. Protect funds you cannot lose.' },
    { cat: 'DOSWAPZ', keys: ['stand for', 'acronym', 'name mean'], q: 'What does DOSWAPZ stand for?', a: 'Degen Optimized Sovereign Warfare Against Pumpz.' },
    { cat: 'DOSWAPZ', keys: ['hub', 'menu', 'home', 'start'], q: 'What is the Hub?', a: 'The Hub is the system menu. Past era = classic green terminal. Present era = orbit. Time Machine / portal switches eras. Most tools exist in both.' },
    { cat: 'DOSWAPZ', keys: ['past', 'present', 'classic', 'orbit', 'era', 'time machine', 'portal'], q: 'What are Past and Present?', a: 'Two skins of the same protocol. Past is classic DOS terminal. Present is orbit/void. Time Machine jumps eras. Protocol does not change with the paint.' },
    { cat: 'DOSWAPZ', keys: ['custody', 'hold funds', 'custodial', 'store my'], q: 'Does DOSWAPZ hold my funds?', a: 'NEGATIVE. DOSWAPZ is not a custodian. Wallets stay yours. Swaps and mints are signed in your wallet. Disconnect after sensitive actions on several terminals.' },
    { cat: 'DOSWAPZ', keys: ['protocol', 'how it works', 'surface protocol', 'full protocol', 'the protocol'], q: 'What is the DOSWAPZ protocol?', a: 'Published surface only. You hold keys. Swap is Jupiter at 0% DOSWAPZ fee (any Solana wallet). Old Pond rails need an activated Pond0x rig. Mint is Ethereum pixel math. Token DSWPZ is on Trix. Optional pay surfaces (Mail Gate, The Missing Layer, Awardz, donate, launch cuts) go to published SOL/ETH/BTC treasuries. Legal packet: /docs/legal.html plus community swap rules, Awardz PVP rules, and The Missing Layer guide. Not a custodian. Not advice.' },
    { cat: 'DOSWAPZ', keys: ['whats new', "what's new", 'new on', 'updated', 'latest', 'changelog', 'just shipped'], q: 'What is new on the protocol?', a: 'Live additions on the published surface: The Missing Layer person graph (pay BTC/ETH/SOL, F6 GUIDE on-page, legal §15A). Mail Gate pay-to-pass. Awardz optional PVP. Incoming treasuries unified to one SOL, one ETH, one BTC. Pond access: Jupiter = any Solana wallet; old rails = activated Pond0x rig. Legal packet updated Sep 13 2026. Ask the terminal by name for the cut.' },
    { cat: 'DOSWAPZ', keys: ['docs', 'legal', 'rules', 'terms', 'disclaimer'], q: 'Where are docs / legal?', a: 'Packet at /docs/. Binding terms /docs/legal.html (photosensitivity §16A, Awardz §11A, The Missing Layer §15A). Community swap rules = Jupiter vs old rails. Awardz PVP rules. The Missing Layer operator steps /docs/the-missing-layer.html (same text as F6 GUIDE on the app). Read before you sign or send.' },
    { cat: 'DOSWAPZ', keys: ['seizure', 'photosensitiv', 'flashing', 'strobe', 'glitch warning', 'epilepsy'], q: 'What is the photosensitivity warning?', a: 'CRT flicker, scanlines, Time Machine glitch, and hard flashes can provoke seizure, migraine, or nausea. If you have epilepsy or photosensitivity, do not use Time Machine / glitch features. Stop if you feel unwell. Legal §16A. DOSWAPZ has no liability for medical events from viewing the Site.' },
    { cat: 'DOSWAPZ', keys: ['not financial', 'advice', 'dyor'], q: 'Is this financial advice?', a: 'NEGATIVE. Surface protocol briefing only. Not financial advice. Not a trade signal. DYOR. Never sign what you do not understand.' },
    { cat: 'DOSWAPZ', keys: ['treasury', 'treasuries', 'pay address', 'incoming', 'where do fees', 'fee wallet', 'btc address', 'eth address', 'sol address'], q: 'Where do incoming payments go?', a: TREAS + ' Used by donate, Mail Gate, The Missing Layer, Awardz (SOL/ETH), mint/phunk (ETH), Vantablack launch cuts. Always copy from the live page, not a screenshot in chat.' },
    { cat: 'DOSWAPZ', keys: ['btc', 'bitcoin', 'ethereum address', 'pay with'], q: 'What coins can I pay with?', a: 'Published pay options depend on the terminal. Donate, Mail Gate, and The Missing Layer: BTC, ETH, or SOL. Awardz entries: native SOL or ETH. Math mint / Phunk inscription: ETH. Vantablack launch cut: SOL or ETH by chain. ' + TREAS },

    { cat: 'OPSEC', keys: ['opsec', 'seed', 'private key', 'secret', 'password', 'recovery', 'safe', 'security', 'scam', 'phishing'], q: 'OPSEC rules?', a: 'Never paste a seed, private key, or password into DOSWAPZ, this mirror, chat, Discord, or "support." Keep keys on your machine. Never connect funds you cannot lose. Verify mints and destinations before you sign.' },
    { cat: 'OPSEC', keys: ['connect wallet', 'phantom', 'solflare', 'metamask', 'which wallet'], q: 'How do I connect a wallet?', a: 'Swap uses Phantom or Solflare on Solana. Mint / Phunk uses an Ethereum wallet. Pond dossier is soft-sign. Mail Gate and The Missing Layer also accept BTC sends to the published bech32. Several terminals auto-disconnect after a tx. DOSWAPZ never asks for a seed.' },
    { cat: 'OPSEC', keys: ['auto disconnect', 'disconnect'], q: 'Why does the wallet disconnect?', a: 'Pond swap and mint are built to drop the session after an attempt so a stale approval is not left hanging. Reconnect if you need another action.' },

    { cat: 'SWAP', keys: ['swap', 'jupiter', '0%', 'zero percent', 'trade', 'any wallet'], q: 'What is 0% Swap?', a: 'Live Solana swap on Jupiter rails with a 0% DOSWAPZ platform fee. Any Solana wallet. Real on-chain when you connect and sign. Trix catalog tokens are grouped. You can paste any Solana mint as Other. Decimals auto-detect. Verify route and slippage before sign. This Jupiter path is NOT old Pond rewards-pool rails.' },
    { cat: 'SWAP', keys: ['slippage'], q: 'What is slippage?', a: 'Gap between quoted and executed price. Set and read it on the swap panel. High slippage can fill worse than you expect.' },
    { cat: 'SWAP', keys: ['other mint', 'paste mint', 'custom mint', 'any token'], q: 'Can I swap any mint?', a: 'Yes on the Solana swap: choose Other and paste a mint. Protocol still routes through Jupiter. Bad mints, no liquidity, or failed quotes = no swap. Verify the mint yourself.' },
    { cat: 'SWAP', keys: ['trix token', 'trix market swap'], q: 'Trix tokens on swap?', a: 'Swap lists a TRIX MARKET group from the public Trix catalog plus pinned mints. Still Jupiter execution. Not a Trix login.' },
    { cat: 'SWAP', keys: ['swap fail', 'failed swap', 'quote'], q: 'Can a swap fail?', a: 'Yes. No route, stale quote, slippage, RPC, or you reject the wallet popup. Nothing leaves without your signature. Verify on Solscan after a confirm.' },
    { cat: 'SWAP', keys: ['demo mode', 'no wallet'], q: 'No wallet detected?', a: 'Swap can sit in demo/read mode and point you at Phantom. No funds move until a real wallet signs.' },

    { cat: 'WATCH', keys: ['chain watch', 'auto sell', 'bag', 'dump', 'watch tab'], q: 'What is Chain Watch / Bag Auto Sell?', a: 'On the swap page, Chain Watch can watch a connected bag and offer auto-sell while that tab stays open. No private key stored. Phantom still pops for every sign. Close the tab, the watch dies.' },

    { cat: 'BRIDGE', keys: ['bridge', 'robinhood', '4663', 'cross chain', 'lifi', 'jumper', 'stargate'], q: 'What is the Bridge?', a: 'Multi-chain bridge UI on third-party rails. Chains shown: Solana, Ethereum, Base, Arbitrum, Polygon, Optimism, BNB, Robinhood Chain 4663. Providers listed: LI.FI/Jumper, Across, Relay, Stargate/LayerZero, Chainlink CCIP, Transporter, Arbitrum Canonical. Verify chain, token, and destination. Some routes are slow; Canonical Arbitrum exits can take ~7 days.' },

    { cat: 'MEAT', keys: ['meat', 'alerts', 'telegram', 'signal bot'], q: 'What is MEAT?', a: 'MEAT is the alert terminal. It watches configured markets and can ping you. It does not execute trades, hold keys, or touch your wallet. You still decide and sign elsewhere.' },

    { cat: 'MINT', keys: ['mint', 'nft', 'pixel math', 'voxel', 'ethereum mint'], q: 'What is Mint?', a: 'Pixel Math Mint on Ethereum. Preview deterministic voxel art, then mint on-chain. Wallet auto-disconnects after a confirmed mint. Gallery is a soft wallet view onto FLOORED.APP for minted pieces.' },
    { cat: 'MINT', keys: ['gallery', 'floored'], q: 'What is Mint Gallery?', a: 'Soft wallet view of minted math pieces with a FLOORED.APP marketplace path. Display, not a custodian.' },

    { cat: 'TOKEN', keys: ['dswpz', '$doswapz', 'token', 'ticker', 'mint address', 'maps', 'wu tang'], q: 'What is $DOSWAPZ / DSWPZ?', a: 'Published ticker DSWPZ on Trix Market. Published mint HM1iMLK3w2vNvMBqduP23Lucsocgt32BonNifhSJTRiX — verify on Solscan. Token page says dev hold is zero. 50% of published developer fee claims on Trix go to MAPS.ORG. Fee-wallet gifts to Wu Tang for the Children are tracked on the token page. Not a price call.' },
    { cat: 'TOKEN', keys: ['x-gate', 'share dswpz', 'tweet', 'x account'], q: 'What is SHARE $DSWPZ / X-Gate?', a: 'Draft-share path so YOU post $DSWPZ from YOUR X account. Not the dev account. Follow the on-page gate. Never give X passwords to a stranger.' },

    { cat: 'LAYER', keys: ['layer', 'missing layer', 'the missing layer', 'layer steps', 'person graph', 'circle graph', 'layer.com', 'lyr-'], q: 'What is The Missing Layer?', a: 'Person-centric X graph. Not post vanity. Ranks people who act on YOUR posts (reply 4, quote 3.5, RT 2, like 1, recency decay). Demo CIRCLE is free. Live report is optional pay then run. App: /the-missing-layer/past and /present. GUIDE is on the page (F6) — same LAYER-STEPS text as /docs/the-missing-layer.html and Legal §15A. Nightly X rollup is the live job; until connected, CIRCLE stays demo people so you can learn the board.' },
    { cat: 'LAYER', keys: ['layer pay', 'layer report', '7d quick', '30d standard', '90d deep', 'sku', 'pay for the missing', 'pay for layer'], q: 'How do I pay for The Missing Layer?', a: 'F5 PAY on the app. SKUs: 7D QUICK $4, 30D STANDARD $8, 90D DEEP $15 (USD at spot, ~2% slippage). Pick BTC, ETH, or SOL. OPEN INVOICE (memo LYR-xxxxx). Send EXACT amount to published treasuries. ' + TREAS + ' Transfers are irreversible. Wrong chain / unmatched memo need not be returned. Binding: /docs/the-missing-layer.html + Legal §15A.' },
    { cat: 'LAYER', keys: ['layer guide', 'operator steps', 'f6 guide', 'layer pdf', 'missing layer guide'], q: 'Where is The Missing Layer guide?', a: 'On the product page: green strip + F6 GUIDE. Same operator steps in the legal packet /docs/the-missing-layer.html and paper /docs/the-missing-layer-steps.pdf. Terms: Legal §15A.' },

    { cat: 'POND', keys: ['pond', 'pond scum', 'pond0x', 'wpong', 'check in', 'rig', 'old rails'], q: 'What is Pond Scum?', a: 'DOSWAPZ Pond terminal: public protocol map + dossier + old-rails swap embedded on-site (not a pond0x.com redirect). Surface loop: Check In, Mine, Swap, Water, Spawn, Auction. Settlement Ethereum + Solana. Rewards are discretionary per Pond terms. Dossier view = sign only. Dossier swap = real Solana txs, auto-disconnect after each attempt. Old rails = Jupiter Metis v1 + Pond fee vaults. Plain Jupiter usually does not count as Pond volume.' },
    { cat: 'POND', keys: ['activated rig', 'dune list', 'old rails vs jupiter', 'who can swap pond', 'community swap rules'], q: 'Who can use Pond old rails vs Jupiter?', a: 'Two access rules. Regular Jupiter on DOSWAPZ = any Solana wallet, 0% platform fee. Old rewards-pool rails / Pond Scum dossier swap = activated Pond0x mining rig only (Dune list in backend DB, session caps, fail-closed if the list is empty). Full write-up: /docs/community-swap-rules.html. Appearing on a rig list does not guarantee Pond0x will count volume or pay rewards.' },
    { cat: 'POND', keys: ['check in'], q: 'How does Pond Check In work?', a: 'Official FAQ surface: pair Solana and Ethereum, optional X, choose payout wallet. Incomplete Check In can change claim priority. DOSWAPZ shows the map; it does not replace Pond Check In on Pond.' },
    { cat: 'POND', keys: ['mine', 'mining', 'hashrate', 'halving'], q: 'How does Pond mining work?', a: 'Surface: browser proof of work after check-in. Activate a rig, hash, claim wPOND. Rewards are not auto-sent. Difficulty adjusts. Halvings cut rewards. Boost raises hashrate. Official pitch: laptop/phone, no ASIC.' },
    { cat: 'POND', keys: ['water', 'lock', 'pondsol'], q: 'What is Water?', a: 'Surface: lock wPOND, stream pondSOL. Longer lock, bigger multiplier. Unlock anytime; early unlock can penalize. Mining health and locks feed each other. Official site also gates how much you can lock.' },
    { cat: 'POND', keys: ['spawn'], q: 'What is Spawn?', a: 'Surface: not a swap. You do not pick the token. Registry token with highest supply at spawn time. Mined activity feeds spawn. Community notes exist and are unofficial.' },
    { cat: 'POND', keys: ['auction', 'bid', 'pndc'], q: 'What is Pond Auction?', a: 'Surface: bid PNDC on an SPL or EVM token with liquidity. Auction starts high and decays. First bid at current price wins. Fees split toward bidder and liquidity-mining the winning token.' },

    { cat: 'WATCHER', keys: ['i see you', 'surveillance', 'track wallet', 'track swaps'], q: 'What is I SEE YOU?', a: 'Multi-chain wallet surveillance terminal. Track published swaps and activity you point it at. Observation tool. Not custody. Not a warrant.' },

    { cat: 'GEOFF', keys: ['geoffwatch', 'geoff', 'geoff.ai', 'hwonder', 'wildfire', 'docs.geoff'], q: 'What is Geoffwatch?', a: 'Public observer. Probes public geoff.ai / docs.geoff.ai pages and fingerprints hWonder / GeoffAi GitHub. Hourly digest plus a live pulse. No cookies. No visitor IDs. Robots.txt honored. Blocked: /api /connect /settings. Not a trade signal.' },
    { cat: 'TRIX', keys: ['trix', 'black box', 'boxes', 'memes', 'easter egg', 'preorder'], q: 'What is the Trix egg / black box?', a: 'Geoffwatch easter egg. Public Trix box and meme stats only. Hourly live feeds. Does not hit Trix /connect or /settings. Points board is public. Box ownership uses public chain/census, not a Trix login. Not a loot table. Not a trade signal.' },

    { cat: 'SCHOOL', keys: ['school', 'learn', 'lesson', 'education'], q: 'What is School?', a: 'Crypto from absolute zero. Wallets, Ethereum, Solana, tokens, DeFi. No trading. No keys. No hype. Past and Present pages both exist.' },
    { cat: 'MAIL', keys: ['mail', 'email', 'gateway', 'spf', 'dkim', 'dmarc', 'mail gate', 'pay to pass'], q: 'What is Mail Gate?', a: 'Pay-to-pass email security gateway for doswapz.com. Pay the fee, sign the payload, gate opens. No seeds. No keys stored. Wallet auto-disconnects after a pass. SMTP send may stay off. ' + TREAS },

    { cat: 'ARCADE', keys: ['arcade', 'game', 'cabinet', 'scoreboard', 'daily seed'], q: 'What is the Arcade?', a: 'Game cabinets with a daily seed. Scores are soft-sign / local unless a board says otherwise. Play stays free. Awardz is an optional PVP pool — own risk, void where prohibited. Snowman, Lily Leap, Airborne, TBB Bull Run, FTWR, and others live under Arcade.' },
    { cat: 'ARCADE', keys: ['crypto dad', 'family', 'heat', 'debt'], q: 'What is Crypto Dad?', a: 'Survival sim: debt, volatility, bad decisions. Stats: Family, Heat, Cash/Liquid, Debt. Keep Family high and Heat low. Listed coins in the manual: BTC, ETH, SOL, MEME. Soft-sign scoreboard. Not real-money trading.' },
    { cat: 'ARCADE', keys: ['crypto mom', '18+'], q: 'What is Crypto Mom?', a: 'Basement cabinet. 18+ content. Soft last-run signature board. Stay out if you are not of age.' },
    { cat: 'ARCADE', keys: ['tbb', 'bull run'], q: 'What is $TBB Bull Run?', a: 'Arcade cabinet with a local soft-connect scoreboard. Game protocol, not a brokerage.' },
    { cat: 'ARCADE', keys: ['ftwr', 'maze'], q: 'What is FTWR?', a: 'Maze cabinet with hole records / top 10 board. Arcade protocol only.' },
    { cat: 'ARCADE', keys: ['snowman'], q: 'What is Snowman?', a: 'Arcade cabinet. Geoff 100% + kills + parts on its board. Daily seed applies with the rest of Arcade.' },
    { cat: 'ARCADE', keys: ['lily leap'], q: 'What is Lily Leap?', a: 'Arcade jump cabinet with a soft board. Separate from Lily Pad, which is the video-gate / node grid.' },
    { cat: 'ARCADE', keys: ['awardz', 'pvp pool', 'pvp', 'prize pool'], q: 'What is Awardz?', a: 'Optional player-versus-player arcade skill contest. Play stays free if you skip it. If you enter, you send native SOL or ETH at USD spot to published treasuries and can lose 100%. Void where prohibited. 18+. DOSWAPZ is not the house opponent. Rules: /docs/awardz-pool-rules.html and Legal §11A.' },

    { cat: 'ATTIC', keys: ['attic', 'pokemon', 'tcg', 'drops'], q: 'What is The Attic?', a: 'Drops desk: sports, Pokémon, TCG product links. Surface listings and share tools. Not a warehouse. Not a guarantee a drop is in stock.' },
    { cat: 'BASEMENT', keys: ['basement', 'meme lab', 'boombox', 'vantablack', 'token launcher', 'phunk'], q: 'What is The Basement?', a: 'Restricted wing. Crypto Mom [18+], media lab, boombox, meme lab, token launcher, Vantablack market, phunk maker. Age-gate content lives here. Vantablack is the multi-chain created-coin market with a published launch fee.' },
    { cat: 'VANTABLACK', keys: ['vantablack', 'launch token', 'create token', '0.02'], q: 'What is Vantablack?', a: 'Market for main and created coins across Solana and EVM (ETH, Base, Arbitrum, Polygon, Robinhood). Token launch: Trix-style surface where creator keeps 100% supply. Published site launch fee 0.02 SOL or 0.0008 ETH to DOSWAPZ. Track mint / 0x contract on the page.' },
    { cat: 'LILY', keys: ['lily pad', 'nodes', 'node grid'], q: 'What is Lily Pad / Nodes?', a: 'Lily Pad is a video gate into the node grid. Nodes is the grid itself. Surface navigation, not a hosting contract you cannot read on-page.' },
    { cat: 'PVC', keys: ['perpetual', 'vision', 'lofi', 'broadcast'], q: 'What is Perpetual Vision Center?', a: 'Lofi perpetual sim plus a 24h X broadcast playlist. Ambient terminal. Not a trading desk.' },
    { cat: 'APE', keys: ['ape chamber', 'protocols', 'channel 2'], q: 'What is Ape Chamber?', a: 'Observation chamber. Not a game. Surface copy: 10 protocols, secret channel 2. Watch. Do not expect a score.' },
    { cat: 'AREA', keys: ['area 69', '420', 'restricted sector'], q: 'What is Area 69...420?', a: 'Restricted sector scaffold. Content coming soon. Surface only. No clearance past the door that is not built.' },
    { cat: 'DEMPLAR', keys: ['demplar', 'knights'], q: 'What is Knights Demplar?', a: 'Character dossier that points at the official site + codex. DOSWAPZ hosts the dossier surface, not their private command.' },
    { cat: 'STEP', keys: ['13th', 'thirteenth', 'odds'], q: 'What is 13th Step?', a: 'Live world-odds terminal. Displays published odds-style data. Not a bookie. Not a betting account.' },
    { cat: 'HARDWEAR', keys: ['hardwear', 'merch', 'hardware wallet', 'apparel'], q: 'What is Hardwear?', a: 'DIY hardware wallet notes plus limited apparel. Surface how-to and merch. DOSWAPZ does not take custody of a device you build.' },
    { cat: 'DEGEN', keys: ['degen', 'trailer', 'synopsis'], q: 'What are the DEGENs?', a: 'Lore wing: official trailer, full synopsis, donate. Story protocol, not a token buy button.' },
    { cat: 'HARBINGER', keys: ['harbinger', 'oracle', 'mirror', 'chatbot', 'you'], q: 'What is H4RB1NG3R?', a: 'I am the text oracle. Finite protocol briefing. I answer how DOSWAPZ works at surface clearance. I do not hold keys, predict pumps, or leak classified internals.' },
    { cat: 'DONATE', keys: ['donate', 'tip', 'support'], q: 'How do I donate?', a: 'Voluntary. Not an investment. Main donate page takes SOL, ETH, and BTC to the published treasuries. ' + TREAS + ' DEGEN$ donate is a separate path — follow that page, not this list. Never send keys. Never send funds you cannot lose.' },
    { cat: 'SCORE', keys: ['scoreboard', 'leaderboard', 'soft sign', 'x login'], q: 'How do scoreboards work?', a: 'Most boards are soft-sign / local. Some accept an X login for sharing. Play stays free. A signature is not a withdrawal.' },
    { cat: 'PORK', keys: ['pork', 'pasture'], q: 'What is $PORK Pasture?', a: 'Present-era pasture terminal for $PORK surface stats. Observation, not a vault.' },
    { cat: 'PHUNKS', keys: ['eat shit', 'phunks', 'ethereum phunks'], q: 'What is the Phunks portal?', a: 'Ethereum Phunks portal under the censored Hub label. Surface link into that wing. 18+ adjacent basement tools live separately.' }
  ]

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9$%]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function toks(s) {
    return norm(s).split(' ').filter(function (x) {
      return x.length > 1 && !STOP[x]
    })
  }

  function cordial(n) {
    if (/^(hi|hii+|hello|hey|yo|sup|howdy|hiya)$/.test(n) || /^(good )?(morning|afternoon|evening)$/.test(n)) {
      return 'At ease. H4RB1NG3R on station. Protocol clearance only. How does DOSWAPZ work — ask that. ' + TOPICS
    }
    if (/how are you|how('?s| is) it going|you good|you ok/.test(n)) {
      return 'Operational. The mirror does not feel. State a protocol question.'
    }
    if (/^(thanks|thank you|thx|ty|cheers|appreciate it)$/.test(n) || /^thank/.test(n)) {
      return 'Copy. Stay sovereign. Do not sign what you cannot read.'
    }
    if (/^(bye|goodbye|later|cya|see you|peace|over and out)$/.test(n)) {
      return 'Dismissed. Keep OPSEC. Hub is behind you if you need the menu.'
    }
    if (/please|sorry|excuse me|pardon/.test(n) && n.split(' ').length < 5) {
      return 'No offense taken. Protocol questions only. ' + TOPICS
    }
    if (/who are you|what('?s| is) your name|what are you|are you (ai|a bot|human|real)/.test(n)) {
      return 'H4RB1NG3R. Text oracle of DOSWAPZ. Finite briefing. Not a broker. Not support with keys. Protocol surface only.'
    }
    if (/help|what can you (do|answer)|commands|menu of questions|what do i ask/.test(n)) {
      return 'I answer how DOSWAPZ works at surface clearance. ' + TOPICS + ' Deeper than published protocol is CLASSIFIED. Off-protocol is above my paygrade.'
    }
    if (/^(ok|okay|cool|nice|got it|roger|copy|10-4)$/.test(n)) {
      return 'Roger. Next protocol question when ready.'
    }
    if (/i love you|you('?re| are) (cool|great|awesome)/.test(n)) {
      return 'Flattery is not a clearance upgrade. Ask how a terminal works.'
    }
    if (/good (bot|job)|well done/.test(n)) {
      return 'Noted. Stay on protocol.'
    }
    return null
  }

  function classified(n) {
    if (/seed phrase|private key|secret key|recovery phrase|mnemonic|keystore/.test(n)) return CLASSIFIED
    if (/source code dump|show me the (code|repo internals)|unreleased|roadmap secret|when (moon|listing)|insider/.test(n)) return CLASSIFIED
    if (/who (is|are) the (dev|devs|founder|team|owner) secretly|real identity|dox|home address/.test(n)) return CLASSIFIED
    if (/how (do you|does (the )?(site|swap) really) (make money|hide|rug)/.test(n)) return CLASSIFIED
    if (/admin password|backdoor|bypass|exploit|hack (the|doswapz)|drain/.test(n)) return CLASSIFIED
    if (/live price|what is (it )?worth now|market cap now|will (it|dswpz) (pump|dump|100x)/.test(n)) return CLASSIFIED
    if (/deeper|internal(s)?|behind the scenes|how is it really built|database|server logs/.test(n)) return CLASSIFIED
    if (/classified|need to know|full dump of/.test(n) && /protocol|doswapz|pond|swap/.test(n)) return CLASSIFIED
    return null
  }

  function offProtocol(n) {
    if (/\bweather\b|sports score|\bpresident\b|bitcoin (only )?price|\beth price\b|what should i buy|\bstock\b|\bgirlfriend\b|\brecipe\b|\bhomework\b/.test(n)) return PAYGRADE
    if (/write (me )?(a )?poem|tell (me )?a joke|\bsing\b|roleplay nsfw/.test(n)) return PAYGRADE
    return null
  }

  function score(n, item) {
    var s = 0
    var qn = norm(item.q)
    if (n === qn) s += 100
    if (qn.indexOf(n) >= 0 && n.length > 8) s += 40
    if (n.indexOf(qn) >= 0 && qn.length > 8) s += 40
    var keys = item.keys || []
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (n.indexOf(k) >= 0) s += 12 + Math.min(8, k.length)
    }
    var ta = toks(n)
    var tb = toks(item.q + ' ' + item.cat)
    for (var j = 0; j < ta.length; j++) {
      if (tb.indexOf(ta[j]) >= 0) s += 4
    }
    return s
  }

  function answer(raw) {
    var n = norm(raw)
    if (!n) return 'State a protocol question. ' + TOPICS

    var c = cordial(n)
    if (c) return c
    var cl = classified(n)
    if (cl) return cl
    var off = offProtocol(n)
    if (off) return off

    var best = null
    var bestS = 0
    for (var i = 0; i < KB.length; i++) {
      var s = score(n, KB[i])
      if (s > bestS) {
        bestS = s
        best = KB[i]
      }
    }
    if (best && bestS >= 10) return best.a

    if (/how (do|does|to)|what is|where|why|can i/.test(n) && /doswapz|swap|pond|mint|token|hub|wallet|layer|awardz|mail|legal/.test(n)) {
      return CLASSIFIED
    }
    return PAYGRADE
  }

  return {
    answer: answer,
    topics: TOPICS,
    greeting:
      'H4RB1NG3R on station. Finite protocol briefing. I answer how DOSWAPZ works at surface clearance. Deeper is CLASSIFIED. Off-protocol is above my paygrade. ' +
      TOPICS
  }
})()
