const state = { range: 30, mutuals: false, view: "circle", selected: null, paid: false, sku: "std30", coin: "SOL", invoiceId: null };

const PRICES_USD = { BTC: 77250, ETH: 2503, SOL: 101 };
const WALLETS = {
  BTC: "bc1qtwqxrsj8ur8zyp9ku47dx6ljhc9dxmjc8j4t2g",
  ETH: "0x5be58476DF379BAdc88b552F603db227C0D95bac",
  SOL: "5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc"
};
const SKUS = {
  q7:  { id: "q7", name: "7D QUICK", usd: 4, cost: 2, days: 7, posts: 40 },
  std30:{ id: "std30", name: "30D STANDARD", usd: 8, cost: 4, days: 30, posts: 120 },
  deep90:{ id: "deep90", name: "90D DEEP", usd: 15, cost: 9, days: 90, posts: 300 }
};

const FOLLOW_LABEL = {
  active_mutual: ["MUTUAL-ON", "mutual"],
  lurking_mutual: ["MUTUAL-OFF", "lurk"],
  one_way_lurker: ["1WAY", "oneway"],
  drive_by: ["DRIVEBY", "drive"],
  dead: ["DEAD", "dead"]
};

function hashBar(pct, width) {
  const n = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return "[" + "#".repeat(n) + "-".repeat(width - n) + "]";
}

function inRange(p) {
  return p.lastDays <= state.range;
}

function score(p) {
  const w = LAYER_WEIGHTS;
  const raw = p.replies * w.reply + p.quotes * w.quote + p.rts * w.rt + p.likes * w.like;
  return raw * LAYER_DECAY(p.lastDays);
}

function scaleToRange(people) {
  return people.filter(inRange).map((p) => {
    const f = state.range === 7 ? 0.35 : state.range === 90 ? 1.15 : 1;
    return {
      ...p,
      likes: Math.max(0, Math.round(p.likes * f)),
      replies: Math.max(0, Math.round(p.replies * f)),
      quotes: Math.max(0, Math.round(p.quotes * f)),
      rts: Math.max(0, Math.round(p.rts * f)),
      youToThem: Math.max(0, Math.round(p.youToThem * f))
    };
  });
}

function ranked() {
  let rows = scaleToRange(LAYER_PEOPLE);
  if (state.mutuals) rows = rows.filter((p) => p.follow.includes("mutual"));
  const totals = rows.reduce(
    (a, p) => {
      a.likes += p.likes;
      a.replies += p.replies;
      a.quotes += p.quotes;
      a.rts += p.rts;
      a.them = (a.them || 0) + p.likes + p.replies + p.quotes + p.rts;
      a.you += p.youToThem;
      return a;
    },
    { likes: 0, replies: 0, quotes: 0, rts: 0, you: 0, them: 0 }
  );
  const scored = rows
    .map((p) => {
      const s = score(p);
      const themActs = p.likes + p.replies + p.quotes + p.rts;
      return {
        ...p,
        s,
        likePct: totals.likes ? (p.likes / totals.likes) * 100 : 0,
        replyPct: totals.replies ? (p.replies / totals.replies) * 100 : 0,
        share: totals.them ? (themActs / totals.them) * 100 : 0,
        themActs
      };
    })
    .sort((a, b) => b.s - a.s);
  return { rows: scored, totals };
}

function lastTouch(d) {
  if (d === 0) return "TODAY";
  if (d === 1) return "YDAY";
  return d + "D";
}

function renderKpis(model) {
  const { rows, totals } = model;
  const top15 = rows.slice(0, 15).reduce((s, p) => s + p.themActs, 0);
  const top15pct = totals.them ? Math.round((top15 / totals.them) * 100) : 0;
  const extract = rows.filter((p) => p.youToThem > p.themActs * 1.4 && p.themActs < 8).length;
  document.getElementById("kpis").innerHTML =
    `PEOPLE=${rows.length}   TOP15=${top15pct}%   ACTIONS_ON_YOU=${totals.them}   YOU_PERFORM_THEY_DONT=${extract}`;
}

function renderTable(model) {
  document.getElementById("circleBody").innerHTML = model.rows
    .map((p, i) => {
      const [label] = FOLLOW_LABEL[p.follow];
      const bar = hashBar(p.share * 4, 12);
      return `<tr>
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td>@${p.handle}</td>
        <td>${label}</td>
        <td class="bar">${bar} ${p.share.toFixed(1)}%</td>
        <td>${p.likes}/${p.replies}/${p.quotes}/${p.rts}</td>
        <td>${p.youToThem}/${p.themActs}</td>
        <td>${lastTouch(p.lastDays)}</td>
        <td><button data-open="${p.handle}">OPEN</button></td>
      </tr>`;
    })
    .join("");
}

function asciiRow(label, pct) {
  return `<div>${label.padEnd(18, " ")} ${hashBar(pct, 20)} ${Math.round(pct)}%</div>`;
}

function renderSplit(model) {
  const buckets = {
    "MUTUAL-ON": 0,
    "MUTUAL-OFF": 0,
    "1WAY/DRIVE": 0,
    "DEAD": 0
  };
  model.rows.forEach((p) => {
    const n = p.themActs;
    if (p.follow === "active_mutual") buckets["MUTUAL-ON"] += n;
    else if (p.follow === "lurking_mutual") buckets["MUTUAL-OFF"] += n;
    else if (p.follow === "dead") buckets["DEAD"] += n;
    else buckets["1WAY/DRIVE"] += n;
  });
  const tot = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  document.getElementById("sourceBars").innerHTML = Object.entries(buckets)
    .map(([k, v]) => asciiRow(k, (v / tot) * 100))
    .join("");

  const top15 = model.rows.slice(0, 15).reduce((s, p) => s + p.themActs, 0);
  const pct = model.totals.them ? Math.round((top15 / model.totals.them) * 100) : 0;
  document.getElementById("top15pct").textContent = "TOP15 SHARE = " + pct + "%";
  document.getElementById("crowdBars").innerHTML =
    asciiRow("TOP 15", pct) + asciiRow("EVERYONE ELSE", 100 - pct);
}

function contentFit(p) {
  const counts = {};
  p.posts.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function renderPerson(handle) {
  const model = ranked();
  const p = model.rows.find((r) => r.handle === handle);
  const empty = document.getElementById("personEmpty");
  const panel = document.getElementById("personPanel");
  if (!p) {
    empty.classList.remove("hidden");
    panel.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  panel.classList.remove("hidden");
  const fit = contentFit(p)
    .map(([k, v]) => `<li>${k.toUpperCase().padEnd(10, " ")} ${v}</li>`)
    .join("");
  const [label] = FOLLOW_LABEL[p.follow];
  panel.innerHTML = `
    <div class="card">
      @${p.handle}  ${p.name.toUpperCase()}<br />
      TYPE=${label}  LAST=${lastTouch(p.lastDays)}
    </div>
    <div class="card">
      SHARE OF YOU<br />
      ${asciiRow("LIKES", Math.min(100, p.likePct * 4))}
      ${asciiRow("REPLIES", Math.min(100, p.replyPct * 4))}
      ${asciiRow("ALL", Math.min(100, p.share * 4))}
      <br />YOU-&gt;THEM ${p.youToThem}   THEM-&gt;YOU ${p.themActs}
      <br />POST TYPES THEY TOUCH
      <ul class="fit-list">${fit}</ul>
    </div>
  `;
}

function render() {
  const model = ranked();
  renderKpis(model);
  renderTable(model);
  renderSplit(model);
  if (state.selected) renderPerson(state.selected);
}

function setView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
  document.getElementById("view-" + name).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  const titles = {
    circle: ["CIRCLE", "WEIGHT: REPLY 4  QUOTE 3.5  RT 2  LIKE 1  + DECAY"],
    split: ["SPLIT", "IF TOP15 OWNS MOST ACTIONS, FOLLOWER COUNT IS A COSTUME"],
    person: ["PERSON", "OWNERSHIP %  DIRECTION  POST FIT"],
    export: ["EXPORT", "TAKE THE CUT. DONT LIVE IN THE DASHBOARD."],
    pay: ["PAY", "BTC ETH SOL TO PUBLISHED DOSWAPZ TREASURIES. PRICE = API COST + LAYER CUT."],
    help: ["THE MISSING LAYER GUIDE", "SAME STEPS AS /docs/the-missing-layer.html  AND  LAYER-STEPS.PDF"]
  };
  document.getElementById("viewTitle").textContent = titles[name][0];
  document.getElementById("viewSub").textContent = titles[name][1];
}

document.getElementById("rangeSeg").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  state.range = Number(btn.dataset.range);
  document.querySelectorAll("#rangeSeg button").forEach((b) => b.classList.toggle("on", b === btn));
  render();
});

document.getElementById("mutualsOnly").addEventListener("change", (e) => {
  state.mutuals = e.target.checked;
  render();
});

document.querySelectorAll(".nav-btn").forEach((b) =>
  b.addEventListener("click", () => setView(b.dataset.view))
);

document.getElementById("circleBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open]");
  if (!btn) return;
  state.selected = btn.dataset.open;
  setView("person");
  renderPerson(state.selected);
});

document.getElementById("csvBtn").addEventListener("click", () => {
  const { rows } = ranked();
  const header = ["rank", "handle", "name", "follow", "share_pct", "likes", "replies", "quotes", "rts", "you_to_them", "last_days", "score"];
  const lines = [header.join(",")].concat(
    rows.map((p, i) =>
      [i + 1, p.handle, `"${p.name}"`, p.follow, p.share.toFixed(2), p.likes, p.replies, p.quotes, p.rts, p.youToThem, p.lastDays, p.s.toFixed(2)].join(",")
    )
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `missing-layer-${state.range}d.csv`;
  a.click();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "F1") { e.preventDefault(); setView("circle"); }
  if (e.key === "F2") { e.preventDefault(); setView("split"); }
  if (e.key === "F3") { e.preventDefault(); setView("person"); }
  if (e.key === "F4") { e.preventDefault(); setView("export"); }
  if (e.key === "F5") { e.preventDefault(); setView("pay"); }
  if (e.key === "F6") { e.preventDefault(); setView("help"); renderHelp(); }
});

const HELP = `THE MISSING LAYER — OPERATOR STEPS
=====================================
Person graph. Not post vanity.

DEMO BOARD = FREE. LIVE REPORT = PAY THEN RUN.
Full legal copy: /docs/the-missing-layer.html
Paper copy:      /docs/the-missing-layer-steps.pdf
Legal packet:    /docs/legal.html  §15A

A. OPEN THE APP
  1. https://doswapz.com/the-missing-layer/past
     Present era: /the-missing-layer/present
  2. F6 or GUIDE for this screen
  3. Keep this tab on doswapz.com — do not send coins to a mirror

B. READ THE BOARD (NO PAY)
  1. CIRCLE = ranked people (demo names until live X rollup)
  2. 7D / 30D / 90D = time cut
  3. MUTUALS ONLY = hide 1-way / drive-by
  4. OPEN a row = PERSON view
     share % of YOUR likes/replies
     you->them vs them->you
     which post types they touch
  5. SPLIT = top15 vs crowd + how they follow
  6. EXPORT = CIRCLE.CSV

C. BUY A LIVE REPORT
  1. F5 PAY
  2. Pick SKU
       7D QUICK     $4   API~$2   LAYER~$2
       30D STANDARD $8   API~$4   LAYER~$4
       90D DEEP     $15  API~$9   LAYER~$6
  3. Pick coin: BTC  ETH  SOL
  4. OPEN INVOICE  (memo = LYR-xxxxx)
  5. Send EXACT amount to the published DOSWAPZ treasury
       BTC  ${WALLETS.BTC}
       ETH  ${WALLETS.ETH}
       SOL  ${WALLETS.SOL}
  6. Wrong chain / wrong amount is your loss. Transfers are irreversible.
  7. RUN REPORT
     Live job: your posts, likers, replies, quotes, RTs,
     follower/following = mutuals. CIRCLE then fills with
     real people. Until that nightly job is connected,
     CIRCLE stays on demo people so you can learn the board.

D. DO NOT
  - Send coins off doswapz.com
  - Hit official liking_users on every page load
  - Promise 300 pfps. Cap at top 25-100
  - Treat this as financial advice, a credit score, or a
    product you resell as someone else's data

E. KEYS
  F1 CIRCLE  F2 SPLIT  F3 PERSON
  F4 EXPORT  F5 PAY    F6 GUIDE
`;

function renderHelp() {
  const el = document.getElementById("helpText");
  if (el) el.textContent = HELP;
}

function cryptoAmt(usd, coin) {
  return usd / PRICES_USD[coin];
}

function fmtCrypto(n, coin) {
  if (coin === "BTC") return n.toFixed(6) + " BTC";
  if (coin === "ETH") return n.toFixed(5) + " ETH";
  return n.toFixed(3) + " SOL";
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

function renderPay() {
  const sku = SKUS[state.sku];
  const margin = sku.usd - sku.cost;
  const pct = Math.round((margin / sku.usd) * 100);
  document.getElementById("payStatus").innerHTML = state.paid
    ? `STATUS=PAID  INVOICE=${state.invoiceId}  RUN UNLOCKED`
    : `STATUS=UNPAID  LIVE TREASURIES  BTC / ETH / SOL`;

  document.getElementById("skuList").innerHTML = Object.values(SKUS)
    .map((s) => {
      const on = state.sku === s.id ? "on" : "";
      return `<div><button class="${on}" data-sku="${s.id}">${s.name}  $${s.usd}</button>
        <span class="dim"> API~$${s.cost}  LAYER~$${s.usd - s.cost}  (${Math.round(((s.usd - s.cost) / s.usd) * 100)}%)</span></div>`;
    })
    .join("");

  document.getElementById("coinList").innerHTML = ["BTC", "ETH", "SOL"]
    .map((c) => `<button class="${state.coin === c ? "on" : ""}" data-coin="${c}">${c}</button>`)
    .join(" ");

  const amt = cryptoAmt(sku.usd, state.coin);
  const id = state.invoiceId || "INV-PENDING";
  document.getElementById("invoiceBox").innerHTML = `
SEND EXACT AMOUNT. MEMO/TAG = ${id}<br />
SKU=${sku.name}  CHARGE=$${sku.usd}  API_COST~$${sku.cost}  MARGIN~$${margin} (${pct}%)<br />
COIN=${state.coin}  AMOUNT=${fmtCrypto(amt, state.coin)}<br />
ADDR=<span class="addr" id="payAddr">${WALLETS[state.coin]}</span>
<button id="copyAddr">COPY ADDR</button><br />
SPOT USED: BTC $${PRICES_USD.BTC}  ETH $${PRICES_USD.ETH}  SOL $${PRICES_USD.SOL}<br />
<span class="dim">ADD ~2% SLIPPAGE ON LIVE. CONFIRM ON-CHAIN BEFORE YOU TREAT IT AS PAID. WRONG CHAIN = YOUR LOSS.</span><br />
<span class="dim">LEGAL: /docs/the-missing-layer.html  AND  /docs/legal.html#s15a</span><br /><br />
<button id="mkInv">OPEN INVOICE</button>
<button id="markPaid">${state.paid ? "ALREADY PAID" : "I SENT IT"}</button>
<button id="runJob">${state.paid ? "RUN REPORT" : "RUN LOCKED"}</button>
`;
}

document.getElementById("skuList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sku]");
  if (!b) return;
  state.sku = b.dataset.sku;
  state.range = SKUS[state.sku].days;
  document.querySelectorAll("#rangeSeg button").forEach((x) => x.classList.toggle("on", Number(x.dataset.range) === state.range));
  renderPay();
});

document.getElementById("coinList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-coin]");
  if (!b) return;
  state.coin = b.dataset.coin;
  renderPay();
});

document.getElementById("invoiceBox").addEventListener("click", (e) => {
  if (e.target.id === "copyAddr") {
    copyText(WALLETS[state.coin]).then(() => {
      e.target.textContent = "COPIED";
      setTimeout(() => { if (e.target) e.target.textContent = "COPY ADDR"; }, 1200);
    });
    return;
  }
  if (e.target.id === "mkInv") {
    state.invoiceId = "LYR-" + Date.now().toString(36).toUpperCase();
    state.paid = false;
    renderPay();
  }
  if (e.target.id === "markPaid") {
    if (!state.invoiceId) state.invoiceId = "LYR-" + Date.now().toString(36).toUpperCase();
    state.paid = true;
    renderPay();
  }
  if (e.target.id === "runJob") {
    if (!state.paid) return;
    setView("circle");
    render();
    document.getElementById("kpis").textContent =
      `JOB OK  ${SKUS[state.sku].name}  ${state.coin}  ${state.invoiceId}  (DEMO ROLLUP UNTIL LIVE X JOB)`;
  }
});

function loadSpot() {
  fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd")
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((j) => {
      const btc = Number(j && j.bitcoin && j.bitcoin.usd);
      const eth = Number(j && j.ethereum && j.ethereum.usd);
      const sol = Number(j && j.solana && j.solana.usd);
      if (btc > 0) PRICES_USD.BTC = Math.round(btc);
      if (eth > 0) PRICES_USD.ETH = Math.round(eth);
      if (sol > 0) PRICES_USD.SOL = Math.round(sol);
      if (state.view === "pay") renderPay();
    })
    .catch(() => {});
}

const _setView = setView;
setView = function (name) {
  _setView(name);
  if (name === "pay") renderPay();
  if (name === "help") renderHelp();
};

render();
renderPay();
renderHelp();
loadSpot();
