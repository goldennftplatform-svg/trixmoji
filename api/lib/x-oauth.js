/**
 * Sign in with X — identity only.
 *
 * Requested scopes: users.read tweet.read
 *   tweet.read is required by X for /2/users/me. We never call tweet endpoints.
 *
 * We call exactly one X API after token exchange:
 *   GET https://api.x.com/2/users/me
 * Then the access token is discarded (never persisted, never reused).
 *
 * Never called: tweets, search, follows, likes, DMs, lists, bookmarks, mute, block.
 */
const crypto = require('crypto');
const { b64url, randomToken, normalizeUsername } = require('./x-session');

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const ME_URL = 'https://api.x.com/2/users/me';
const SCOPES = 'users.read tweet.read';

function clientId() {
  return String(process.env.X_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.X_CLIENT_SECRET || '').trim();
}

function pkcePair() {
  const verifier = randomToken(32);
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier: verifier, challenge: challenge };
}

function authorizeUrl(opts) {
  const u = new URL(AUTH_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', opts.state);
  u.searchParams.set('code_challenge', opts.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

async function exchangeCode(opts) {
  const basic = Buffer.from(clientId() + ':' + clientSecret(), 'utf8').toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(opts.code || ''),
    redirect_uri: String(opts.redirectUri || ''),
    code_verifier: String(opts.verifier || ''),
    client_id: clientId()
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  });

  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || 'X token exchange failed';
    const err = new Error(String(msg));
    err.code = data.error || 'token_error';
    throw err;
  }
  return data.access_token;
}

async function fetchIdentity(accessToken) {
  const res = await fetch(ME_URL, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json'
    }
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok || !data.data || !data.data.id) {
    const msg = (data.detail || data.title || data.error) || 'X identity lookup failed';
    throw new Error(String(msg));
  }
  const username = normalizeUsername(data.data.username);
  if (!username) throw new Error('X returned no username');
  return {
    id: String(data.data.id),
    username: username
  };
}

/**
 * Trade the one-time code for identity, then drop the token.
 * `accessToken` lives only in this stack frame.
 */
async function identityFromCode(opts) {
  const accessToken = await exchangeCode(opts);
  try {
    return await fetchIdentity(accessToken);
  } finally {
    /* token intentionally unused after this function returns */
  }
}

module.exports = {
  SCOPES,
  pkcePair,
  authorizeUrl,
  identityFromCode
};
