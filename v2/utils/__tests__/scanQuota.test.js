import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { damascusDay, nextQuota } from "../scanQuota.js";

describe("nextQuota", () => {
  it("أول قراءة باليوم", () =>
    assert.deepEqual(nextQuota(null, "2026-11-25", 30), { allowed: true, quota: { day: "2026-11-25", count: 1 }, left: 29 }));
  it("بيكمل العد بنفس اليوم", () => assert.equal(nextQuota({ day: "2026-11-25", count: 5 }, "2026-11-25", 30).quota.count, 6));
  it("بيوقف عند الحد", () => assert.equal(nextQuota({ day: "2026-11-25", count: 30 }, "2026-11-25", 30).allowed, false));
  it("بيتصفّر بيوم جديد", () => assert.equal(nextQuota({ day: "2026-11-24", count: 30 }, "2026-11-25", 30).allowed, true));
});

describe("damascusDay", () => {
  it("بعد نص الليل بدمشق بيصير اليوم الجاي (UTC+3)", () =>
    assert.equal(damascusDay(new Date("2026-11-25T22:30:00Z")), "2026-11-26"));
});
