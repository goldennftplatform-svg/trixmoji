const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const feeVaultSOL = "9hCLuXrQrHCU9i7y648Nh7uuWKHUsKDiZ5zyBHdZPWtG";
const feeVaultUSDC = "6NqvoPpSYCPEtLEukQaSNs7mS3yK6k285saH9o3vgC96";
const amount = "100000000"; // 0.1 SOL
const bases = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1"];

(async () => {
  let quote = null;
  let baseUsed = null;
  let quoteErr = null;
  for (const b of bases) {
    try {
      const u =
        b +
        "/quote?inputMint=" +
        SOL +
        "&outputMint=" +
        USDC +
        "&amount=" +
        amount +
        "&slippageBps=100&platformFeeBps=100";
      const r = await fetch(u);
      const t = await r.text();
      if (!r.ok) throw new Error(r.status + " " + t.slice(0, 200));
      quote = JSON.parse(t);
      baseUsed = b;
      break;
    } catch (e) {
      quoteErr = String(e.message || e);
    }
  }
  if (!quote) {
    console.log("QUOTE FAIL", quoteErr);
    process.exit(1);
  }
  console.log("QUOTE OK via", baseUsed);
  console.log(
    "outAmount",
    quote.outAmount,
    "routeSteps",
    (quote.routePlan || []).length,
    "priceImpact",
    quote.priceImpactPct
  );

  // Use a valid-looking base58 pubkey (System Program) for build smoke only
  const taker = "11111111111111111111111111111111";

  async function trySwap(feeAccount, label) {
    const r = await fetch(baseUsed + "/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: taker,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
        feeAccount,
      }),
    });
    const t = await r.text();
    console.log(
      "SWAP build fee=" + label + ":",
      r.status,
      r.ok ? "HAS_TX=" + Boolean(JSON.parse(t).swapTransaction) : t.slice(0, 280)
    );
  }

  await trySwap(feeVaultSOL, "SOL_vault");
  await trySwap(feeVaultUSDC, "USDC_vault");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
