/* Demo graph. Replace with nightly X rollup. */
window.LAYER_PEOPLE = [
  { handle: "cryptodad", name: "Crypto Dad", likes: 41, replies: 18, quotes: 4, rts: 7, youToThem: 22, lastDays: 0, follow: "active_mutual", posts: ["meme", "market", "market", "meme", "game"] },
  { handle: "pond0x_intern", name: "pond intern", likes: 33, replies: 9, quotes: 2, rts: 11, youToThem: 6, lastDays: 1, follow: "active_mutual", posts: ["market", "market", "meme"] },
  { handle: "trixdotmarket", name: "trix.market", likes: 12, replies: 14, quotes: 6, rts: 3, youToThem: 19, lastDays: 0, follow: "active_mutual", posts: ["market", "site", "market"] },
  { handle: "kada_cards", name: "Kada", likes: 9, replies: 7, quotes: 1, rts: 2, youToThem: 15, lastDays: 2, follow: "active_mutual", posts: ["cards", "cards", "meme"] },
  { handle: "geoff_ai", name: "GEOFF", likes: 28, replies: 3, quotes: 8, rts: 1, youToThem: 4, lastDays: 3, follow: "lurking_mutual", posts: ["meme", "meme", "news"] },
  { handle: "degenfilm", name: "The Degens", likes: 6, replies: 11, quotes: 2, rts: 0, youToThem: 14, lastDays: 1, follow: "active_mutual", posts: ["film", "meme"] },
  { handle: "pork_watcher", name: "$PORK", likes: 22, replies: 2, quotes: 0, rts: 5, youToThem: 1, lastDays: 4, follow: "one_way_lurker", posts: ["market"] },
  { handle: "vhs_archive", name: "VHS dump", likes: 17, replies: 1, quotes: 3, rts: 2, youToThem: 8, lastDays: 6, follow: "lurking_mutual", posts: ["art", "art", "meme"] },
  { handle: "replyguy_88", name: "replyguy", likes: 4, replies: 16, quotes: 0, rts: 0, youToThem: 0, lastDays: 0, follow: "drive_by", posts: ["market", "market", "news"] },
  { handle: "cardshow_phx", name: "PHX shows", likes: 8, replies: 4, quotes: 0, rts: 1, youToThem: 9, lastDays: 8, follow: "active_mutual", posts: ["cards"] },
  { handle: "staticrain", name: "static rain", likes: 14, replies: 0, quotes: 2, rts: 0, youToThem: 2, lastDays: 11, follow: "lurking_mutual", posts: ["art"] },
  { handle: "liquidity_bot", name: "liq notices", likes: 19, replies: 0, quotes: 0, rts: 4, youToThem: 0, lastDays: 2, follow: "drive_by", posts: ["market", "market"] },
  { handle: "moms_basement", name: "Crypto Mom", likes: 7, replies: 5, quotes: 1, rts: 1, youToThem: 11, lastDays: 5, follow: "active_mutual", posts: ["game", "meme"] },
  { handle: "roofing_lead", name: "same-day roof", likes: 2, replies: 1, quotes: 0, rts: 0, youToThem: 0, lastDays: 21, follow: "dead", posts: ["news"] },
  { handle: "bigacc_driveby", name: "quoted once", likes: 1, replies: 0, quotes: 1, rts: 1, youToThem: 0, lastDays: 16, follow: "drive_by", posts: ["news"] },
  { handle: "silent_1", name: "ghost 1", likes: 6, replies: 0, quotes: 0, rts: 0, youToThem: 3, lastDays: 28, follow: "one_way_lurker", posts: ["meme"] },
  { handle: "silent_2", name: "ghost 2", likes: 5, replies: 0, quotes: 0, rts: 0, youToThem: 0, lastDays: 40, follow: "dead", posts: ["meme"] },
  { handle: "collab_n", name: "collab n", likes: 3, replies: 6, quotes: 2, rts: 1, youToThem: 7, lastDays: 3, follow: "active_mutual", posts: ["site", "art"] },
  { handle: "news_pnn", name: "PNN clip", likes: 11, replies: 2, quotes: 3, rts: 2, youToThem: 5, lastDays: 2, follow: "lurking_mutual", posts: ["news", "meme"] },
  { handle: "extract_acc", name: "ratio farmer", likes: 0, replies: 8, quotes: 0, rts: 0, youToThem: 12, lastDays: 1, follow: "one_way_lurker", posts: ["market"] }
];

window.LAYER_WEIGHTS = { reply: 4, quote: 3.5, rt: 2, like: 1 };
window.LAYER_DECAY = (days) => Math.max(0.35, Math.exp(-days / 28));
