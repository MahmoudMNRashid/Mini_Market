import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchMatcher, categoryIndex, categoryLabel, filterProducts } from "../productLink.js";

const tree = [
  { _id: "p1", name: "حبوب", children: [{ _id: "c1", name: "رز" }, { _id: "c2", name: "برغل" }] },
  { _id: "p2", name: "دخان", children: [] },
];
const index = categoryIndex(tree);
const products = [
  { _id: "1", productName: "رز مصري فرط", categoryId: "c1" },
  { _id: "2", productName: "أرز بسمتي", categoryId: null },
  { _id: "3", productName: "برغل ناعم", categoryId: "c2" },
  { _id: "4", productName: "حمص حب", categoryId: "p1" },
  { _id: "5", productName: "مالبورو أحمر", categoryId: "p2" },
  { _id: "6", productName: "علبة محارم", categoryId: "gone" },
];
const ids = (list) => list.map((p) => p._id);

describe("searchMatcher", () => {
  it("فاضي ← كلشي بيطابق", () => {
    assert.equal(searchMatcher("")("أي شي"), true);
    assert.equal(searchMatcher(undefined)("أي شي"), true);
  });
  it("نفس قواعد بحث السيرفر", () => {
    assert.equal(searchMatcher("ارز")("أرز بسمتي"), true);
    assert.equal(searchMatcher("علبه")("علبة محارم"), true);
    assert.equal(searchMatcher("فرط رز")("رز مصري فرط"), true);
    assert.equal(searchMatcher("رز هندي")("رز مصري فرط"), false);
  });
});

describe("categoryIndex / categoryLabel", () => {
  it("الأب بيضم أبناءه، والابن اسمه مع أبوه", () => {
    assert.deepEqual(index.get("p1").ids, ["p1", "c1", "c2"]);
    assert.equal(index.get("c1").label, "حبوب ← رز");
    assert.equal(index.get("c1").parentId, "p1");
    assert.deepEqual(index.get("p2").ids, ["p2"]);
  });
  it("بلا فئة ← فاضي، فئة مش معروفة ← ؟", () => {
    assert.equal(categoryLabel(products[0], index), "حبوب ← رز");
    assert.equal(categoryLabel(products[1], index), "");
    assert.equal(categoryLabel(products[5], index), "؟");
  });
});

describe("filterProducts", () => {
  it("الكل", () => assert.equal(filterProducts(products, { index }).length, 6));
  it("بلا فئة", () => assert.deepEqual(ids(filterProducts(products, { category: "none", index })), ["2"]));
  it("فئة أب ← هي وأبناؤها", () => {
    assert.deepEqual(ids(filterProducts(products, { category: "p1", index })), ["1", "3", "4"]);
  });
  it("فئة ابن ← هي بس", () => {
    assert.deepEqual(ids(filterProducts(products, { category: "c1", index })), ["1"]);
  });
  it("بحث + فئة مع بعض", () => {
    assert.deepEqual(ids(filterProducts(products, { search: "رز", category: "all", index })), ["1", "2"]);
    assert.deepEqual(ids(filterProducts(products, { search: "رز", category: "none", index })), ["2"]);
  });
});
