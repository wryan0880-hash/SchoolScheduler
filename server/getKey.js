let cachedKey = null;
let cachedExpiresAt = 0;

function makeError(message, fix, cause) {
  const error = new Error(message, { cause });
  error.fix = fix;
  return error;
}

function readConfig() {
  const url = process.env.KEYGEN_URL;
  const token = process.env.KEYGEN_TOKEN;

  if (!url || url === 'paste-here' || !token || token === 'paste-here') {
    throw makeError(
      'The AI key service is not configured.',
      'Put your real KEYGEN_URL and KEYGEN_TOKEN in the server .env file.'
    );
  }

  return { url: url.replace(/\/$/, ''), token };
}

function clearCachedKey() {
  cachedKey = null;
  cachedExpiresAt = 0;
}

/**
 * Get a short-lived AI key without exposing the key or token to client code.
 * Pass { force: true } after the AI provider reports that the key is invalid.
 * Call this module only from server code; neither the key nor token is returned
 * to, logged by, or otherwise exposed to client code.
 */
async function getKey({ force = false } = {}) {
  if (!force && cachedKey && Date.now() < cachedExpiresAt) {
    return cachedKey;
  }

  clearCachedKey();
  const { url, token } = readConfig();

  let response;
  try {
    response = await fetch(`${url}/api/lookup-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (cause) {
    throw makeError(
      'The AI key service could not be reached.',
      'Check KEYGEN_URL, your network connection, and the key service status.',
      cause
    );
  }

  let body;
  try {
    body = await response.json();
  } catch (cause) {
    throw makeError(
      'The AI key service returned an unreadable response.',
      'Check that the key service returns JSON containing apiKey and expiresAt.',
      cause
    );
  }

  if (!response.ok || !body.apiKey || !body.expiresAt) {
    throw makeError(
      'The AI key service did not provide a usable key.',
      'Check the key service response and make sure the token has permission to request a key.'
    );
  }

  const expiresAt = Date.parse(body.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw makeError(
      'The AI key service returned an expired key.',
      'Check that expiresAt is a future ISO date and request a new key.'
    );
  }

  cachedKey = body.apiKey;
  cachedExpiresAt = expiresAt;
  return cachedKey;
}

module.exports = { getKey, clearCachedKey };
