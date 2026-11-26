import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCurrency, cleanName, mapV1Product, planMigration } from "../migrateV1.js";

const U = "owner";
const v1 = (o) => ({
  _id: o._id ?? Math.random().toString(36).slice(2),
  productName: "رز",
  wholesalePackagePrice: 100,
  untisPerPackage: 10,
  currency: "USD",
  latestWholeprice: "2026-01-01",
  ...o,
});

test("cleanName collapses spaces", () => {
  assert.equal(cleanName("  رز   سيدي  "), "رز سيدي");
  assert.equal(cleanName(null), "");
});

test("cleanCurrency", () => {
  assert.equal(cleanCurrency("usd"), "USD");
  assert.equal(cleanCurrency(" SYP "), "SYP");
  assert.equal(cleanCurrency("EUR"), null);
});

test("mapV1Product fixes the field name and computes the unit price", () => {
  const { doc } = mapV1Product(v1({ wholesalePackagePrice: 10, untisPerPackage: 3 }), U);
  assert.equal(doc.unitsPerPackage, 3);
  assert.equal(doc.wholesaleUnitPrice, 3.3333);
  assert.equal(doc.userId, U);
  assert.equal(doc.categoryId, null);
  assert.equal(doc.latestWholeprice.toISOString().slice(0, 10), "2026-01-01");
});

test("mapV1Product rejects bad rows", () => {
  assert.ok(mapV1Product(v1({ productName: "  " }), U).error);
  assert.ok(mapV1Product(v1({ currency: "EUR" }), U).error);
  assert.ok(mapV1Product(v1({ untisPerPackage: 0 }), U).error);
  assert.ok(mapV1Product(v1({ wholesalePackagePrice: -1 }), U).error);
  assert.ok(mapV1Product(v1({ wholesalePackagePrice: "x" }), U).error);
});

test("planMigration keeps the newest duplicate and skips existing names", () => {
  const plan = planMigration(
    [
      v1({ _id: "a", productName: "رز", wholesalePackagePrice: 1, latestWholeprice: "2026-01-01" }),
      v1({ _id: "b", productName: "رز ", wholesalePackagePrice: 2, latestWholeprice: "2026-03-01" }),
      v1({ _id: "c", productName: "سكر" }),
      v1({ _id: "d", productName: "شاي" }),
      v1({ _id: "e", currency: "?" }),
    ],
    U,
    ["شاي"],
  );
  assert.deepEqual(plan.toInsert.map((d) => d.productName).sort(), ["رز", "سكر"]);
  assert.equal(plan.toInsert.find((d) => d.productName === "رز").wholesalePackagePrice, 2);
  assert.equal(plan.duplicates.length, 1);
  assert.equal(plan.duplicates[0].kept.v1Id, "b");
  assert.deepEqual(plan.alreadyThere, ["شاي"]);
  assert.equal(plan.invalid.length, 1);
});
