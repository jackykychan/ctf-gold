/**
 * HTTP client for the Chow Tai Fook gold price API. Raw fetch only — parsing
 * lives in the pure `parseGoldPrice`. Browser-like headers are required: the
 * CloudFront edge returns 403 to requests without a real User-Agent.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.chowtaifook.com/",
};

export interface GoldPriceClient {
  fetchRaw(): Promise<unknown>;
}

export function createGoldPriceClient(apiUrl: string): GoldPriceClient {
  return {
    async fetchRaw(): Promise<unknown> {
      const res = await fetch(apiUrl, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        throw new Error(`goldPrice API returned HTTP ${res.status}`);
      }
      return (await res.json()) as unknown;
    },
  };
}
