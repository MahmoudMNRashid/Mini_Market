import { test } from "node:test";
import assert from "node:assert/strict";
import { sypStep, roundSyp, ceilSyp } from "../priceRound.js";

test("الخطوة على قد السعر", () => {
  assert.equal(sypStep(5), 1);
  assert.equal(sypStep(99.9), 1);
  assert.equal(sypStep(100), 5);
  assert.equal(sypStep(999), 5);
  assert.equal(sypStep(1000), 100);
  assert.equal(sypStep(250000), 100);
});

test("ceilSyp: أمثلة القائمة (ربح 12.5%)", () => {
  assert.equal(ceilSyp(90 * 1.125), 105); // هنا صغير: كانت 200
  assert.equal(ceilSyp(156 * 1.125), 180); // هنا وسط: كانت 200
  assert.equal(ceilSyp(188 * 1.125), 215); // نيو بارك: كانت 300
  assert.equal(ceilSyp(8 * 1.125), 9);
  assert.equal(ceilSyp(25063), 25100); // الأسعار الكبيرة متل قبل
});

test("ceilSyp: ما بيطلع لفوق بسبب كسور الضرب", () => {
  assert.equal(ceilSyp(100 * 1.05), 105); // 105.00000000000001
  assert.equal(ceilSyp(20000), 20000);
  assert.equal(ceilSyp(105), 105);
});

test("ceilSyp: ما بينزل تحت السعر أبداً", () => {
  for (const n of [1.2, 99.01, 101.25, 999.5, 1000.1, 33333.3]) assert.ok(ceilSyp(n) >= n, String(n));
});

test("roundSyp: لأقرب خطوة", () => {
  assert.equal(roundSyp(90), 90); // كانت 100
  assert.equal(roundSyp(156.4), 155);
  assert.equal(roundSyp(8958.3), 9000);
  assert.equal(roundSyp(25049), 25000);
  assert.equal(roundSyp(0), 0);
});
