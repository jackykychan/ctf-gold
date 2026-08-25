import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAW_MS, clipWidth, drawProgress, easeOutCubic } from "../web/chartAnim";

test("easeOutCubic: pinned endpoints and eased midpoint", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  // Ease-out: past the halfway output by the time input is halfway.
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test("drawProgress: clamps to [0,1] and is monotonic across the reveal", () => {
  assert.equal(drawProgress(0), 0);
  assert.equal(drawProgress(-100), 0); // before start clamps to 0
  assert.equal(drawProgress(DRAW_MS), 1);
  assert.equal(drawProgress(DRAW_MS * 2), 1); // past the end clamps to 1

  let prev = -1;
  for (let e = 0; e <= DRAW_MS; e += DRAW_MS / 10) {
    const p = drawProgress(e);
    assert.ok(p >= prev, `progress should not decrease at ${e}ms`);
    prev = p;
  }
});

test("drawProgress: a zero/negative duration is treated as already complete", () => {
  assert.equal(drawProgress(0, 0), 1);
  assert.equal(drawProgress(10, -5), 1);
});

test("clipWidth: proportional to progress and clamped", () => {
  // Plot area spans 100px (left=20 .. right=120).
  assert.equal(clipWidth(20, 120, 0), 0);
  assert.equal(clipWidth(20, 120, 1), 100);
  assert.equal(clipWidth(20, 120, 0.25), 25);
  assert.equal(clipWidth(20, 120, 2), 100); // progress > 1 clamps
  assert.equal(clipWidth(20, 120, -1), 0); // progress < 0 clamps
});
