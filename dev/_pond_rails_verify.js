const vaults = {
  SOL: "9hCLuXrQrHCU9i7y648Nh7uuWKHUsKDiZ5zyBHdZPWtG",
  USDC: "6NqvoPpSYCPEtLEukQaSNs7mS3yK6k285saH9o3vgC96",
  USDT: "5LmFGjbae5iWejFVT8UiRLggh1me22nTetmere8SjwKy",
  wPOND: "GKHmDYWPE8Bf74xDntnpx4hi4H7pRp3HK5QYvPyXGEiU",
  hSOL: "4jkVjzXtrCuxQus3neMtLfNL4wZhsPmm9fKGXoLMXqsG",
  Pepe: "3qGSU2RySrjvQ2iGMts2HZ4ssGVSrBUSGL4jN7LHGhgo",
};
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

(async () => {
  // 1) Vault accounts exist
  const rpc = "https://api.mainnet-beta.solana.com";
  for (const [name, addr] of Object.entries(vaults)) {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [addr, { encoding: "jsonParsed" }],
    };
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const v = j.result && j.result.value;
    console.log(
      "VAULT",
      name,
      addr.slice(0, 6) + "..." + addr.slice(-4),
      v ? "EXISTS owner=" + (v.owner || "?") + " lamports=" + v.lamports : "MISSING"
    );
  }

  // 2) Metis quote with platform fee + build with Pond SOL vault only
  const amount = "50000000"; // 0.05 SOL
  const quoteUrl =
    "https://lite-api.jup.ag/swap/v1/quote?inputMint=" +
    SOL +
    "&outputMint=" +
    USDC +
    "&amount=" +
    amount +
    "&slippageBps=100&platformFeeBps=100";
  const qr = await fetch(quoteUrl);
  const quote = await qr.json();
  if (!quote.outAmount) {
    console.log("QUOTE FAIL", JSON.stringify(quote).slice(0, 300));
    process.exit(1);
  }
  console.log("QUOTE OK outAmount=", quote.outAmount, "platformFee=", quote.platformFee || quote.feeBps || "in-route");

  const taker = "11111111111111111111111111111111";
  const sr = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: taker,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
      feeAccount: vaults.SOL,
    }),
  });
  const st = await sr.text();
  let ok = false;
  try {
    const sj = JSON.parse(st);
    ok = !!sj.swapTransaction;
  } catch (e) {}
  console.log("BUILD with Pond SOL fee vault:", sr.status, ok ? "TX_BUILT_WITH_FEE_ACCOUNT" : st.slice(0, 200));

  // 3) Build WITHOUT feeAccount should still work but would NOT be pond rails
  const sr2 = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: taker,
      wrapAndUnwrapSol: true,
      feeAccount: "So11111111111111111111111111111111111111112", // invalid fee account
    }),
  });
  console.log(
    "BUILD with INVALID feeAccount:",
    sr2.status,
    (await sr2.text()).slice(0, 160)
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
