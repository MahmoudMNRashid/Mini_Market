import { test } from "node:test";
import assert from "node:assert/strict";
import { staleCutoff, isStale, summarizeStale } from "../staleProducts.js";

const NOW = new Date("2026-11-26T12:00:00Z");

test("staleCutoff: 400 يوم لورا", () => {
  assert.equal(staleCutoff(400, NOW).toISOString(), "2025-10-22T12:00:00.000Z");
});

test("staleCutoff: أيام غلط ← خطأ", () => {
  assert.throws(() => staleCutoff(0, NOW));
  assert.throws(() => staleCutoff(-5, NOW));
  assert.throws(() => staleCutoff(1.5, NOW));
  assert.throws(() => staleCutoff("400", NOW));
});

test("isStale: أقدم من الحد بس، والحد نفسه مش قديم", () => {
  const cutoff = staleCutoff(400, NOW);
  assert.equal(isStale({ latestWholeprice: "2025-10-22T11:59:59Z" }, cutoff), true);
  assert.equal(isStale({ latestWholeprice: cutoff }, cutoff), false);
  assert.equal(isStale({ latestWholeprice: "2026-11-01" }, cutoff), false);
});

test("isStale: بلا تاريخ أو تاريخ غلط ← ما بينلمس", () => {
  const cutoff = staleCutoff(400, NOW);
  assert.equal(isStale({}, cutoff), false);
  assert.equal(isStale({ latestWholeprice: "مش تاريخ" }, cutoff), false);
});

test("summarizeStale: عدد، أقدم/أحدث، وتوزيع بالسنة", () => {
  const s = summarizeStale([
    { latestWholeprice: "2024-03-01" },
    { latestWholeprice: "2023-05-01" },
    { latestWholeprice: "2024-12-31" },
  ]);
  assert.equal(s.count, 3);
  assert.equal(s.oldest.toISOString().slice(0, 10), "2023-05-01");
  assert.equal(s.newest.toISOString().slice(0, 10), "2024-12-31");
  assert.deepEqual(s.byYear, { 2023: 1, 2024: 2 });
  assert.deepEqual(summarizeStale([]), { count: 0, oldest: null, newest: null, byYear: {} });
});
