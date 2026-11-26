import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTempPassword, isTokenStale, newPasswordError } from "../password.js";

test("newPasswordError: فاضية أو مسافات بس", () => {
  assert.ok(newPasswordError(""));
  assert.ok(newPasswordError("   "));
  assert.ok(newPasswordError(undefined));
  assert.ok(newPasswordError(1234));
});

test("newPasswordError: قصيرة / طويلة / تمام", () => {
  assert.ok(newPasswordError("123"));
  assert.equal(newPasswordError("1234"), null);
  assert.equal(newPasswordError("كلمة سر"), null);
  assert.ok(newPasswordError("x".repeat(65)));
});

test("generateTempPassword: 6 أرقام", () => {
  for (let i = 0; i < 50; i++) assert.match(generateTempPassword(), /^\d{6}$/);
});

test("isTokenStale", () => {
  const changed = new Date("2026-11-26T10:00:00.500Z");
  const sec = Math.floor(changed.getTime() / 1000);
  assert.equal(isTokenStale(sec - 1, changed), true); // قبل التغيير
  assert.equal(isTokenStale(sec, changed), false); // نفس الثانية (التوكن الجديد)
  assert.equal(isTokenStale(sec + 60, changed), false);
  assert.equal(isTokenStale(sec - 1, null), false); // ما تغيّرت أبداً
  assert.equal(isTokenStale(undefined, changed), false);
});
