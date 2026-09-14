import type { AppConfig } from "../src/config";
import type { PushPayload, StoredSubscription } from "../src/shared/push";

/**
 * Self-contained Web Push sender for Cloudflare Workers (WebCrypto only, no npm
 * dependency). Implements aes128gcm content encryption (RFC 8291 / RFC 8188)
 * and VAPID request authentication (RFC 8292). Returns the push service's HTTP
 * status so the caller can prune subscriptions on 404/410 (gone).
 */

type VapidConfig = Pick<AppConfig, "vapidPublicKey" | "vapidPrivateKey" | "vapidContact">;

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Encrypt `payload` for a subscription, returning the aes128gcm request body. */
async function encrypt(
  clientPub: Uint8Array,
  authSecret: Uint8Array,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey("raw", eph.publicKey)) as ArrayBuffer,
  ); // 65B
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      eph.privateKey,
      256,
    ),
  );

  // PRK/IKM per RFC 8291 §3.4: HKDF(auth, ecdh, "WebPush: info"\0 ua_pub as_pub).
  const keyInfo = concat(utf8("WebPush: info"), new Uint8Array([0]), clientPub, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(utf8("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = concat(payload, new Uint8Array([2])); // single-record delimiter 0x02
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record),
  );

  // aes128gcm header (RFC 8188): salt(16) | rs(4, BE) | idlen(1) | keyid(as_pub).
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ct);
}

/** Build the VAPID `Authorization: vapid t=<jwt>, k=<pub>` header for an endpoint. */
async function vapidAuthHeader(endpoint: string, config: VapidConfig): Promise<string> {
  const url = new URL(endpoint);
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: unknown) => bytesToB64url(utf8(JSON.stringify(o)));
  const signingInput =
    enc({ typ: "JWT", alg: "ES256" }) +
    "." +
    enc({ aud: `${url.protocol}//${url.host}`, exp: now + 12 * 3600, sub: config.vapidContact });

  const pub = b64urlToBytes(config.vapidPublicKey); // 0x04 | x(32) | y(32)
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: config.vapidPrivateKey,
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput)),
  );
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${config.vapidPublicKey}`;
}

/** Send one push. Returns the HTTP status (404/410 ⇒ subscription is gone). */
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload,
  config: VapidConfig,
): Promise<number> {
  const body = await encrypt(
    b64urlToBytes(sub.p256dh),
    b64urlToBytes(sub.auth),
    utf8(JSON.stringify(payload)),
  );
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: await vapidAuthHeader(sub.endpoint, config),
    },
    body,
  });
  return res.status;
}
