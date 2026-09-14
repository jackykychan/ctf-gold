import { test } from "node:test";
import assert from "node:assert/strict";
import { sendPush } from "../worker/webPush";
import type { PushPayload, StoredSubscription } from "../src/shared/push";

const b64url = (b: Uint8Array): string => Buffer.from(b).toString("base64url");
const fromB64url = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64url"));
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

async function makeVapid() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pubRaw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    pubRaw,
    config: { vapidPublicKey: b64url(pubRaw), vapidPrivateKey: jwk.d!, vapidContact: "mailto:t@e.com" },
  };
}

async function makeClientSub(endpoint: string): Promise<StoredSubscription> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const pubRaw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    endpoint,
    p256dh: b64url(pubRaw),
    auth: b64url(auth),
    prefs: { everyUpdate: true, dailyHigh: false, upTarget: null, downTarget: null, series: "sell", locale: "en" },
  };
}

test("sendPush builds a valid aes128gcm + VAPID request", async () => {
  const { pubRaw, config } = await makeVapid();
  const endpoint = "https://push.example.com/xyz";
  const sub = await makeClientSub(endpoint);
  const payload: PushPayload = {
    series: "sell",
    price: 52776,
    prevPrice: 52700,
    reason: "update",
    updateDate: "2026-09-12 10:00:00",
    locale: "en",
  };

  // Stub the push service.
  const realFetch = globalThis.fetch;
  let captured: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;

  try {
    const status = await sendPush(sub, payload, config);
    assert.equal(status, 201);
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.ok(captured, "fetch was called");
  const { url, init } = captured!;
  assert.equal(url, endpoint);
  assert.equal(init.method, "POST");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["Content-Encoding"], "aes128gcm");
  assert.ok(headers.TTL);
  assert.ok(init.body instanceof Uint8Array);
  // Header is salt(16)+rs(4)+idlen(1)+keyid(65) = 86 bytes, plus ciphertext+tag.
  assert.ok((init.body as Uint8Array).length > 86);

  // The VAPID JWT must verify against the public key.
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(headers.Authorization);
  assert.ok(m, "Authorization is a vapid header");
  assert.equal(m![2], config.vapidPublicKey);
  const [h, p, s] = m![1]!.split(".");
  const verifyKey = await crypto.subtle.importKey(
    "raw",
    pubRaw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    verifyKey,
    fromB64url(s!),
    utf8(`${h}.${p}`),
  );
  assert.ok(ok, "VAPID JWT signature verifies");

  // Claims are well-formed.
  const claims = JSON.parse(Buffer.from(p!, "base64url").toString());
  assert.equal(claims.aud, "https://push.example.com");
  assert.equal(claims.sub, "mailto:t@e.com");
  assert.ok(claims.exp > Math.floor(Date.now() / 1000));
});
