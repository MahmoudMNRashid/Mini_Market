import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkInvoice, checkLine } from "../invoiceCheck.js";

describe("checkLine", () => {
  it("بيقبل سطر مظبوط", () => assert.equal(checkLine({ quantity: 10, packagePrice: 8.85, total: 88.5 }), true));
  it("بيقبل فرق تدوير صغير", () =>
    assert.equal(checkLine({ quantity: 15, packagePrice: 46.97, total: 704.48 }), true));
  it("بيكشف قراءة غلط", () => assert.equal(checkLine({ quantity: 2, packagePrice: 380, total: 7600 }), false));
  it("ما بيحكم إذا السعر ناقص (خط إيد)", () =>
    assert.equal(checkLine({ quantity: 3, packagePrice: null, total: 180000 }), null));
});

describe("checkInvoice", () => {
  it("بيطابق مجموع السطور مع مجموع الفاتورة", () => {
    const r = checkInvoice({
      invoiceTotal: 1854000,
      lines: [{ total: 204000 }, { total: 414000 }, { total: 180000 }, { total: 826000 }, { total: 230000 }],
    });
    assert.equal(r.linesSum, 1854000);
    assert.equal(r.totalMatches, true);
  });

  it("بيكشف رقم مقروء غلط من المجموع", () => {
    const r = checkInvoice({
      invoiceTotal: 1854000,
      lines: [{ total: 204000 }, { total: 364000 }, { total: 180000 }, { total: 826000 }, { total: 230000 }],
    });
    assert.equal(r.totalMatches, false);
  });

  it("بيرجّع أرقام السطور الغلط", () => {
    const r = checkInvoice({
      invoiceTotal: null,
      lines: [
        { quantity: 1, packagePrice: 950, total: 950 },
        { quantity: 2, packagePrice: 380, total: 7600 },
      ],
    });
    assert.deepEqual(r.badLines, [1]);
    assert.equal(r.totalMatches, null);
  });
});
