import type { HistoryResponse, LatestResponse, Range } from "../src/shared/types";

export async function fetchHistory(range: Range): Promise<HistoryResponse> {
  const res = await fetch(`/api/history?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`history request failed: HTTP ${res.status}`);
  return (await res.json()) as HistoryResponse;
}

export async function fetchLatest(): Promise<LatestResponse> {
  const res = await fetch("/api/latest");
  if (!res.ok) throw new Error(`latest request failed: HTTP ${res.status}`);
  return (await res.json()) as LatestResponse;
}
