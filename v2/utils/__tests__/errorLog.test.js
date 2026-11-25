import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildErrorsView,
  clip,
  fingerprint,
  LIMITS,
  normalizeMessage,
  redact,
  sanitizeAppEntry,
  serverEntry,
  topFrame,
  upsertOp,
} from "../errorLog.js";

const NOW = new Date("2026-11-25T12:00:00Z");

const nodeStack = (line) =>
  `TypeError: x is undefined\n    at Object.find (node_modules/mongoose/lib/query.js:10:5)\n    at getDashboard (file:///srv/v2/controllers/admin.js:${line}:7)\n    at node:internal/process:1:1`;

test("redact بيشيل الـ JWT والـ Bearer", () => {
  const out = redact("auth Bearer abc.def eyJhbGciOi.eyJ1c2VySWQ.sig_9-x end");
  assert.ok(!out.includes("eyJ"));
  assert.ok(!out.includes("abc.def"));
  assert.match(out, /\[token\]/);
});

test("clip بيقص وبيحط …", () => {
  assert.equal(clip("a".repeat(10), 5), "aaaa…");
  assert.equal(clip("  hi ", 5), "hi");
});

test("normalizeMessage بيشيل الأرقام والـ ids", () => {
  assert.equal(
    normalizeMessage('Cast to ObjectId failed for value "64f0a1b2c3d4e5f6a7b8c9d0" at 12'),
    normalizeMessage('Cast to ObjectId failed for value "650a1b2c3d4e5f6a7b8c9d0e" at 99')
  );
});

test("topFrame بيتجاهل node_modules وأرقام الأسطر", () => {
  assert.equal(topFrame(nodeStack(120)), "getDashboard");
  assert.equal(topFrame(nodeStack(120)), topFrame(nodeStack(300)));
  assert.equal(topFrame("Error: x\n    at fetchRate (address at index.android.bundle:1:2345)"), "fetchRate");
  assert.equal(topFrame(""), "");
});

test("fingerprint: نفس الخطأ بسطر تاني ← نفسه، مصدر أو رسالة تانية ← غيره", () => {
  const a = { source: "server", message: "x is undefined", stack: nodeStack(120) };
  assert.equal(fingerprint(a), fingerprint({ ...a, stack: nodeStack(500) }));
  assert.notEqual(fingerprint(a), fingerprint({ ...a, source: "app" }));
  assert.notEqual(fingerprint(a), fingerprint({ ...a, message: "y is undefined" }));
});

test("fingerprint بلا stack بيعتمد عالـ route", () => {
  const a = { source: "app", message: "Request failed with status code 500" };
  assert.notEqual(fingerprint({ ...a, route: "GET /a" }), fingerprint({ ...a, route: "GET /b" }));
});

test("sanitizeAppEntry: بلا رسالة ← null، وبيقص وبيصلّح النوع والوقت", () => {
  assert.equal(sanitizeAppEntry(null), null);
  assert.equal(sanitizeAppEntry({ message: "  " }), null);
  const e = sanitizeAppEntry(
    { message: "m".repeat(999), kind: "evil", at: "2099-01-01", extra: "x", password: "123", appVersion: 5 },
    NOW
  );
  assert.equal(e.message.length, LIMITS.message);
  assert.equal(e.kind, "js");
  assert.equal(e.at, NOW);
  assert.equal(e.appVersion, null);
  assert.ok(!("password" in e) && !("extra" in e));
  assert.equal(sanitizeAppEntry({ message: "x", kind: "crash", at: "2026-11-24T00:00:00Z" }, NOW).kind, "crash");
});

test("serverEntry بياخد الـ route بلا ids", () => {
  const req = { method: "PUT", baseUrl: "/api/v2/products", route: { path: "/:id" }, path: "/64f0" };
  const e = serverEntry(new Error("boom"), req, NOW);
  assert.equal(e.route, "PUT /api/v2/products/:id");
  assert.equal(e.source, "server");
  assert.equal(e.message, "boom");
});

test("upsertOp: كل النصوص جوّا $literal، والرقم بس إذا موجود", () => {
  const entry = sanitizeAppEntry({ message: "$where", route: "$x" }, NOW);
  const op = upsertOp(entry, "0911111111", NOW).updateOne;
  assert.equal(op.upsert, true);
  const set = op.update[0].$set;
  assert.deepEqual(set.message, { $literal: "$where" });
  assert.deepEqual(set.route, { $literal: "$x" });
  assert.ok(JSON.stringify(set.users).includes("0911111111"));
  const anon = upsertOp(entry, null, NOW).updateOne.update[0].$set;
  assert.deepEqual(anon.users, { $ifNull: ["$users", []] });
});

test("buildErrorsView: المفتوحة أول والأحدث أول، والعدد", () => {
  const view = buildErrorsView([
    { _id: 1, message: "old", lastSeen: new Date("2026-11-20"), count: 2 },
    { _id: 2, message: "done", lastSeen: new Date("2026-11-25"), resolvedAt: new Date() },
    { _id: 3, message: "new", lastSeen: new Date("2026-11-24"), reopened: true },
  ]);
  assert.deepEqual(view.errors.map((e) => e.message), ["new", "old", "done"]);
  assert.equal(view.open, 2);
  assert.equal(view.errors[0].reopened, true);
  assert.equal(view.errors[2].resolved, true);
});
