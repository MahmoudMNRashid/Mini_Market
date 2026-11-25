import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aliasKey, buildIndex, matchLine, normalizeText, tokenize, wordSimilarity } from "../invoiceMatch.js";

const products = [
  { _id: "p1", productName: "سنيكرز" },
  { _id: "p2", productName: "شوكولا كيندر 4 أصابع" },
  { _id: "p3", productName: "ميلكا 100 غ" },
  { _id: "p4", productName: "ميلكا 50 غ" },
  { _id: "p5", productName: "شوكولا ماريو" },
  { _id: "p6", productName: "كيك رول بيغ ام فريز" },
  { _id: "p7", productName: "كيك رول فراولة" },
  { _id: "p8", productName: "بسكويت تريتو دايجستف" },
  { _id: "p9", productName: "زيت كلارا 1 لتر" },
  { _id: "p10", productName: "شوكولا غالاكسي" },
];
const index = buildIndex(products);
const match = (name, aliases) => matchLine(index, name, aliases);

describe("normalizeText / tokenize", () => {
  it("بيوحّد الهمزات والتاء والأرقام", () =>
    assert.equal(normalizeText("شوكولاتة إصبع ٥٠غ"), "شوكولاته اصبع 50 غ"));
  it("بيشيل رموز الطرد", () => assert.equal(normalizeText("بسكويت /6*24*30غ/"), "بسكويت 6 24 30 غ"));
  it("بيحوّل الوزن لوحدة وحدة", () => {
    assert.deepEqual(tokenize("زيت 1.5 لتر").sizes, ["1500ml"]);
    assert.deepEqual(tokenize("رز 1كغ").sizes, ["1000g"]);
    assert.deepEqual(tokenize("سنيكرز 50 غرام").sizes, ["50g"]);
  });
  it("ال بأول الكلمة اختيارية", () => assert.deepEqual(tokenize("رأس العبد").words, ["راس", "عبد"]));
  it("نفس الاسم بكتابة مختلفة بيعطي نفس المفتاح", () =>
    assert.equal(aliasKey("شوكولا سنيكرز ٥٠ غ"), aliasKey("شوكولا  سنيكرز 50غ")));
});

describe("wordSimilarity", () => {
  it("غلطة حرف مقبولة", () => assert.ok(wordSimilarity("فرير", "فريز") > 0.7));
  it("كلمات مختلفة لأ", () => assert.equal(wordSimilarity("كيندر", "سنيكرز"), 0));
  it("الأرقام لازم تتطابق", () => assert.equal(wordSimilarity("4", "6"), 0));
});

describe("matchLine", () => {
  it("اسم الفاتورة الأطول بيلاقي منتجك القصير", () => {
    const r = match("شوكولا سنيكرز 50غ");
    assert.equal(r.status, "match");
    assert.equal(r.productId, "p1");
  });

  it("كيندر بيطابق مع اختلاف الهمزة", () => assert.equal(match("شوكولا كيندر 4 اصابع").productId, "p2"));

  it("الوزن المختلف ما بيطابق", () => {
    const r = match("لوح شوكولا ميلكا 100غ");
    assert.equal(r.productId, "p3");
    assert.ok(!r.candidates.slice(1).some((c) => c.productId === "p4" && c.score >= 0.8));
  });

  it("كلمة شائعة لحالها (شوكولا) ما بتعمل مطابقة", () => {
    const r = match("شوكولا توكس");
    assert.notEqual(r.status, "match");
  });

  it("غلطة حرف بالماركة بتعطي مرشح", () => {
    const r = match("كيك رول بيغ ام فرير 48غ");
    assert.equal(r.candidates[0].productId, "p6");
  });

  it("منتج مالو موجود ← جديد", () => assert.equal(match("مصاص جنكل بوي فواكه").status, "new"));

  it("ذاكرة الأسماء بتغلب كل شي", () => {
    const aliases = new Map([[aliasKey("بسكويت اوربيتر 60غ"), "p8"]]);
    const r = match("بسكويت اوربيتر 60 غ", aliases);
    assert.equal(r.status, "match");
    assert.equal(r.source, "alias");
    assert.equal(r.productId, "p8");
  });

  it("ذاكرة لمنتج انمحى بتنتجاهل", () => {
    const aliases = new Map([[aliasKey("شي قديم"), "deleted"]]);
    assert.equal(match("شي قديم", aliases).status, "new");
  });
});
