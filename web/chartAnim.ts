// Pure helpers for the chart's left-to-right "draw" reveal. Deliberately free of
// Chart.js / DOM imports so they can be unit-tested in Node.

// Duration of the left-to-right line-draw reveal.
export const DRAW_MS = 900;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Eased 0..1 progress of the draw reveal for a given elapsed time. */
export function drawProgress(elapsedMs: number, durationMs: number = DRAW_MS): number {
  if (durationMs <= 0) return 1;
  const linear = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return easeOutCubic(linear);
}

/**
 * Width of the reveal clip rectangle over a plot area spanning [left, right].
 * `progress` is clamped to 0..1.
 */
export function clipWidth(left: number, right: number, progress: number): number {
  return (right - left) * Math.min(Math.max(progress, 0), 1);
}
