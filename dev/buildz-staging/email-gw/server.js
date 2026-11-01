import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dns from "node:dns/promises";
import crypto from "node:crypto";
import { sha256, makeMessageId, canonicalPayload, verifyEthereum, verifySolana } from "./src/crypto.js";
import { sendEmail } from "./src/mailer.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TTL = Number(process.env.SIGNATURE_TTL_SECONDS || 300);
const challenges = new Map();
const authorized = new Map();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  limit: Number(process.env.RATE_LIMIT_MAX || 30),
  standardHeaders: "draft-8",
  legacyHeaders: false
}));
app.use(express.static("public"));

function cleanDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/\.$/, "");
}

function validDomain(domain) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

function requireString(v, max=10000) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

app.get("/api/health", (req,res) => res.json({ok:true, service:"blockchain-email-security-gateway", version:"2.0.0"}));

app.post("/api/domain/challenge", (req,res) => {
  const domain = cleanDomain(req.body?.domain);
  if (!validDomain(domain)) return res.status(400).json({error:"Invalid domain."});
  const token = `bes-${crypto.randomBytes(24).toString("hex")}`;
  challenges.set(domain, {token, expires:Date.now()+3600000});
  res.json({
    domain,
    record:{type:"TXT", name:"_blockchain-email", value:token},
    spf:"v=spf1 <YOUR-MAIL-PROVIDER> -all",
    dkim:`${process.env.DKIM_SELECTOR || "mail"}._domainkey.${domain}`,
    dmarc:`v=DMARC1; p=reject; adkim=s; aspf=s; pct=100`
  });
});

app.post("/api/domain/verify", async (req,res) => {
  const domain = cleanDomain(req.body?.domain);
  if (!validDomain(domain)) return res.status(400).json({error:"Invalid domain."});
  const c = challenges.get(domain);
  if (!c || c.expires < Date.now()) return res.status(400).json({error:"No active challenge. Create one first."});
  try {
    const records = await dns.resolveTxt("_blockchain-email."+domain);
    const values = records.flat();
    const verified = values.includes(c.token);
    res.json({domain, verified, message: verified ? "Domain verified." : "TXT challenge not found."});
  } catch {
    res.json({domain, verified:false, message:"DNS TXT record could not be resolved yet."});
  }
});

app.post("/api/message/prepare", (req,res) => {
  const {domain, from, to, subject, body} = req.body || {};
  const d = cleanDomain(domain);
  if (!validDomain(d) || !requireString(from,320) || !requireString(to,320) ||
      !requireString(subject,998) || !requireString(body,50000)) {
    return res.status(400).json({error:"Invalid or missing message fields."});
  }
  if (!from.toLowerCase().endsWith("@"+d)) {
    return res.status(400).json({error:"From address must belong to the verified domain."});
  }
  const timestamp = Math.floor(Date.now()/1000);
  const messageId = makeMessageId(d);
  const payload = canonicalPayload({messageId,domain:d,from,to,subject,body,timestamp});
  res.json({messageId, timestamp, payload, payloadHash:sha256(payload), expiresAt:timestamp+TTL});
});

app.post("/api/message/authorize", (req,res) => {
  const {messageId, walletType, walletAddress, signature, payload, payloadHash, timestamp} = req.body || {};
  if (!requireString(messageId,500) || !requireString(walletType,20) ||
      !requireString(walletAddress,200) || !requireString(signature,1000) ||
      !requireString(payload,5000) || !requireString(payloadHash,128) || !Number.isFinite(Number(timestamp))) {
    return res.status(400).json({error:"Incomplete authorization request."});
  }
  if (Math.floor(Date.now()/1000) - Number(timestamp) > TTL || Number(timestamp) - Math.floor(Date.now()/1000) > 30) {
    return res.status(401).json({error:"Signature expired or timestamp is invalid."});
  }
  if (sha256(payload) !== payloadHash || !payload.includes(`message-id:${messageId}`)) {
    return res.status(401).json({error:"Payload integrity check failed."});
  }
  if (authorized.has(messageId)) return res.status(409).json({error:"Message already authorized."});

  let ok = false;
  if (walletType === "ethereum") ok = verifyEthereum(payload, signature, walletAddress);
  if (walletType === "solana") ok = verifySolana(payload, signature, walletAddress);

  if (!ok) return res.status(401).json({error:"Wallet signature verification failed."});

  authorized.set(messageId, {walletType, walletAddress, authorizedAt:Date.now(), payloadHash});
  res.json({authorized:true, messageId});
});

app.post("/api/message/send", async (req,res) => {
  const {messageId, from, to, subject, body} = req.body || {};
  const a = authorized.get(messageId);
  if (!a) return res.status(403).json({error:"Message is not wallet-authorized."});
  try {
    const result = await sendEmail({from,to,subject,body,messageId});
    authorized.delete(messageId);
    res.json({sent:true, messageId, providerMessageId:result.messageId || null});
  } catch (e) {
    res.status(503).json({sent:false,error:e.message});
  }
});

app.listen(PORT, () => console.log(`Blockchain Email Security Gateway listening on http://localhost:${PORT}`));
