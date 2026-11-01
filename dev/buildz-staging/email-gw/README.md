# Blockchain Email Security Gateway

Drop-in backend/frontend package for adding domain ownership, SPF/DKIM/DMARC guidance,
wallet authorization, signed Message-IDs, replay protection, and rate limiting to an
existing website.

## Important

This package is a security gateway starter. It does NOT magically make arbitrary email
spoof-proof by itself. Production mail still needs a real SMTP/API provider and correct
DNS records. The gateway is fail-closed for its own authorization checks.

It never asks for or stores wallet private keys/seed phrases.

## Quick start

Requirements: Node.js 20+

```bash
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000

## Website integration

You can keep your existing website wherever it is hosted and call this service over HTTPS.

1. Create a domain record such as `mail-api.example.com` pointing to this service.
2. Set `PUBLIC_ORIGIN=https://mail-api.example.com`.
3. Put your email provider credentials in environment variables on the backend only.
4. Add the frontend widget from `public/index.html` to your existing site, or call the API directly.

## API

### POST /api/domain/challenge
```json
{"domain":"example.com"}
```

### POST /api/domain/verify
```json
{"domain":"example.com"}
```

### POST /api/message/prepare
```json
{
  "domain":"example.com",
  "from":"alice@example.com",
  "to":"bob@example.net",
  "subject":"Test",
  "body":"Hello"
}
```

Returns a canonical message payload and SHA-256 hash to sign with the connected wallet.

### POST /api/message/authorize
```json
{
  "messageId":"<...>",
  "walletType":"ethereum",
  "walletAddress":"0x...",
  "signature":"0x...",
  "payloadHash":"..."
}
```

The service verifies the signature and prevents replay.

## DNS

The dashboard generates the TXT challenge and displays SPF/DKIM/DMARC guidance.
Do not blindly copy an SPF record if the domain already has SPF; SPF should normally
be consolidated into one record.

DKIM private keys belong on the mail-sending infrastructure, never in browser code.

## Sending email

`POST /api/message/send` is intentionally disabled unless `ENABLE_EMAIL_SEND=true`.
Before enabling it, implement the provider adapter in `src/mailer.js` for your SMTP/API
provider. The gateway should only send after domain ownership and wallet authorization pass.

## Security defaults

- Domain ownership required
- Wallet signature required for authorized messages
- Signed payload includes message ID, timestamp, domain, sender, recipient, subject hash and body hash
- 5-minute signature lifetime by default
- Message ID replay protection
- Per-IP and per-wallet rate limits
- No private keys stored
- No wallet seed phrases requested
- Email sending disabled by default
