/**
 * Generate a VAPID (P-256) keypair for Web Push, printed as base64url.
 *   npm run gen:vapid
 * Then:
 *   - paste VAPID_PUBLIC_KEY into wrangler.jsonc "vars" (public, safe to commit)
 *   - set the private key as a secret:  wrangler secret put VAPID_PRIVATE_KEY
 *   - for local dev, put both (+ VAPID_CONTACT) in .dev.vars
 */
function bytesToB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function main() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  // Public key as the uncompressed point 0x04 | x | y (what applicationServerKey expects).
  const x = Buffer.from(jwk.x!, "base64url");
  const y = Buffer.from(jwk.y!, "base64url");
  const pub = new Uint8Array(65);
  pub[0] = 0x04;
  pub.set(x, 1);
  pub.set(y, 33);

  console.log("VAPID_PUBLIC_KEY =", bytesToB64url(pub));
  console.log("VAPID_PRIVATE_KEY =", jwk.d);
}

void main();
