import crypto from "node:crypto";
import nacl from "tweetnacl";
import { getAddress, verifyMessage } from "ethers";

export function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function makeMessageId(domain) {
  const random = crypto.randomBytes(12).toString("hex");
  return `<bes-${Date.now()}-${random}@${domain}>`;
}

export function canonicalPayload({messageId, domain, from, to, subject, body, timestamp}) {
  return [
    "BLOCKCHAIN-EMAIL-V1",
    `message-id:${messageId}`,
    `domain:${domain.toLowerCase()}`,
    `from:${from.toLowerCase()}`,
    `to:${to.toLowerCase()}`,
    `timestamp:${timestamp}`,
    `subject-sha256:${sha256(subject)}`,
    `body-sha256:${sha256(body)}`
  ].join("\n");
}

export function verifyEthereum(payload, signature, expectedAddress) {
  try {
    const recovered = getAddress(verifyMessage(payload, signature));
    return recovered.toLowerCase() === getAddress(expectedAddress).toLowerCase();
  } catch {
    return false;
  }
}

export function verifySolana(payload, signatureB64, address) {
  try {
    const message = new TextEncoder().encode(payload);
    const sig = Buffer.from(signatureB64, "base64");
    const pub = Buffer.from(address, "base64");
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(message, sig, pub);
  } catch {
    return false;
  }
}
