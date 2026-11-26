import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, parseCategoryText, planCategoryImport } from "../categoryImport.js";

const names = (parsed) => parsed.parents.map((p) => [p.name, p.children.map((c) => c.name)]);

describe("normalizeName", () => {
  it("أشكال الحروف والتشكيل والـ ال", () => {
    assert.equal(normalizeName("الحبوب"), normalizeName("حبوب"));
    assert.equal(normalizeName("مشروبات غازيه"), normalizeName("مشروبات  غازيّة"));
    assert.equal(normalizeName("أجنبي"), normalizeName("اجنبى"));
    assert.equal(normalizeName("  رز "), "رز");
  });

  it("ال بكلمة قصيرة بتضل (الو ≠ و)", () => {
    assert.notEqual(normalizeName("الو"), normalizeName("و"));
  });

  it("مظفات ≠ منظفات (غلطة إملائية مش شكل حرف)", () => {
    assert.notEqual(normalizeName("مظفات"), normalizeName("منظفات"));
  });
});

describe("parseCategoryText", () => {
  it("شكل المسافات: أب بأول السطر، ابن بمسافة أو tab", () => {
    const p = parseCategoryText("حبوب\n  رز\n\tعدس\n\n# تعليق\nمنظفات\nدخان\n  وطني");
    assert.deepEqual(names(p), [["حبوب", ["رز", "عدس"]], ["منظفات", []], ["دخان", ["وطني"]]]);
    assert.equal(p.errors.length, 0);
  });

  it("ملصوق من إكسل: عمودين، خانة الأب الفاضية = نفس الأب، والعناوين بتنتجاهل", () => {
    const p = parseCategoryText("الأب\tالابن\nحبوب\tرز\n\tبرغل\nمنظفات\t\nمعلبات\tتونة\r\n\tفول وحمص");
    assert.deepEqual(names(p), [["حبوب", ["رز", "برغل"]], ["منظفات", []], ["معلبات", ["تونة", "فول وحمص"]]]);
  });

  it("أرقام الأسطر محفوظة", () => {
    const p = parseCategoryText("\nحبوب\n  رز");
    assert.equal(p.parents[0].line, 2);
    assert.equal(p.parents[0].children[0].line, 3);
  });

  it("ابن بلا أب ← غلط برقم السطر", () => {
    const p = parseCategoryText("  رز\nحبوب");
    assert.deepEqual(p.errors, [{ line: 1, message: "«رز» ابن بلا أب فوقه" }]);
    assert.deepEqual(names(p), [["حبوب", []]]);
  });

  it("أكتر من عمودين ← غلط", () => {
    const p = parseCategoryText("حبوب\tرز\tبسمتي");
    assert.equal(p.errors.length, 1);
    assert.equal(p.parents.length, 0);
  });

  it("اسم أطول من 60 ← غلط", () => {
    const p = parseCategoryText("حبوب\n  " + "ا".repeat(61));
    assert.equal(p.errors.length, 1);
    assert.deepEqual(names(p), [["حبوب", []]]);
  });

  it("المكرر بالنص بينضم (بالاسم الموحّد) مع ملاحظة", () => {
    const p = parseCategoryText("حبوب\n  رز\nالحبوب\n  الرز\n  عدس");
    assert.deepEqual(names(p), [["حبوب", ["رز", "عدس"]]]);
    assert.equal(p.notes.length, 2);
  });

  it("المسافات الزيادة جوا الاسم بتنضب", () => {
    assert.deepEqual(names(parseCategoryText("مشروبات   غازية")), [["مشروبات غازية", []]]);
  });
});

describe("planCategoryImport", () => {
  const existing = [
    { _id: "p1", name: "حبوب", children: [{ _id: "c1", name: "رز" }, { _id: "c2", name: "برغل" }] },
    { _id: "p2", name: "دخان", children: [] },
  ];

  it("جديد / موجود بالاسم الموحّد", () => {
    const plan = planCategoryImport(parseCategoryText("الحبوب\n  الرز\n  عدس\nمعلبات\n  تونة"), existing);
    const [hb, ml] = plan.parents;
    assert.equal(hb.status, "exists");
    assert.equal(hb.id, "p1");
    assert.equal(hb.existingName, "حبوب");
    assert.deepEqual(hb.children.map((c) => c.status), ["exists", "new"]);
    assert.equal(hb.children[0].id, "c1");
    assert.equal(ml.status, "new");
    assert.equal(ml.children[0].status, "new");
    assert.deepEqual(plan.counts, { new: 3, exists: 2, conflict: 0 });
  });

  it("أب بالنص موجود كابن ← conflict مع أبنائه", () => {
    const plan = planCategoryImport(parseCategoryText("رز\n  بسمتي"), existing);
    assert.equal(plan.parents[0].status, "conflict");
    assert.match(plan.parents[0].note, /حبوب/);
    assert.equal(plan.parents[0].children[0].status, "conflict");
  });

  it("ابن بالنص اسمه متل أب موجود ← conflict", () => {
    const plan = planCategoryImport(parseCategoryText("مشروبات\n  دخان"), existing);
    assert.equal(plan.parents[0].status, "new");
    assert.equal(plan.parents[0].children[0].status, "conflict");
  });

  it("نفس اسم الابن تحت أب تاني ← جديد (مسموح)", () => {
    const plan = planCategoryImport(parseCategoryText("دخان\n  رز"), existing);
    assert.equal(plan.parents[0].children[0].status, "new");
  });

  it("بلا فئات موجودة ← كلو جديد", () => {
    const plan = planCategoryImport(parseCategoryText("حبوب\n  رز"));
    assert.deepEqual(plan.counts, { new: 2, exists: 0, conflict: 0 });
  });
});
