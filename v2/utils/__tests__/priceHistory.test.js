import { test } from "node:test";
import assert from "node:assert/strict";
import { priceChanged, priceEntry } from "../priceHistory.js";

const product = {
  _id: "p1",
  productName: "رز",
  wholesalePackagePrice: 25,
  unitsPerPackage: 10,
  wholesaleUnitPrice: 2.5,
  currency: "USD",
  latestWholeprice: new Date("2026-11-01T10:00:00Z"),
};

test("priceEntry: نسخة السعر بتاريخه", () => {
  assert.deepEqual(priceEntry("u1", product, "manual"), {
    userId: "u1",
    productId: "p1",
    wholesalePackagePrice: 25,
    unitsPerPackage: 10,
    wholesaleUnitPrice: 2.5,
    currency: "USD",
    at: product.latestWholeprice,
    source: "manual",
  });
});

test("priceEntry: بلا تاريخ ← هلق", () => {
  const e = priceEntry("u1", { ...product, latestWholeprice: null }, null);
  assert.ok(e.at instanceof Date);
  assert.equal(e.source, null);
});

test("priceChanged: بس حقول السعر اللي انبعتت وتغيّرت", () => {
  assert.equal(priceChanged(product, { productName: "رز تاني" }), false);
  assert.equal(priceChanged(product, { wholesalePackagePrice: 25 }), false);
  assert.equal(priceChanged(product, { wholesalePackagePrice: 26 }), true);
  assert.equal(priceChanged(product, { unitsPerPackage: 12 }), true);
  assert.equal(priceChanged(product, { currency: "SYP" }), true);
  assert.equal(priceChanged(product, {}), false);
});
