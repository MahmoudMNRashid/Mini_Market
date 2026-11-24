import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSearch } from "../search.js";

// منجرّب الـ patterns بـ RegExp تبع JS (نفس الـ $options: "i" اللي بيبعتها لـ MongoDB)
const matches = (search, name) => {
  const s = buildSearch(search);
  return s.filter.every((f) => new RegExp(f.productName.$regex, f.productName.$options).test(name));
};

describe("buildSearch", () => {
  it("بحث فاضي أو مسافات ← null", () => {
    assert.equal(buildSearch(""), null);
    assert.equal(buildSearch("   "), null);
    assert.equal(buildSearch("ًٌ"), null); // تشكيل بس
  });

  it("filter لكل كلمة، ومنحدّها لـ 10 كلمات", () => {
    assert.equal(buildSearch("رز بسمتي").filter.length, 2);
    assert.equal(buildSearch("ا ب ت ث ج ح خ د ذ ر ز س").filter.length, 10);
  });

  it("كل كلمة لازم تكون موجودة، بأي ترتيب", () => {
    assert.equal(matches("هندي رز", "رز بسمتي هندي"), true);
    assert.equal(matches("رز مصري", "رز بسمتي هندي"), false);
  });

  it("أشكال الحروف بتطابق بعض (ا/أ/إ/آ ، ة/ه ، ى/ي/ئ ، و/ؤ ، ك/ک)", () => {
    assert.equal(matches("ارز", "أرز"), true);
    assert.equal(matches("أرز", "ارز"), true);
    assert.equal(matches("علبه", "علبة محارم"), true);
    assert.equal(matches("مستشفي", "مستشفى"), true);
    assert.equal(matches("موونه", "مؤونة"), true);
    assert.equal(matches("كعك", "کعک"), true);
  });

  it("الأرقام العربية واللاتينية متل بعض", () => {
    assert.equal(matches("5 كيلو", "رز ٥ كيلو"), true);
    assert.equal(matches("٢٥٠", "بيبسي 250 مل"), true);
  });

  it("التشكيل والتطويل ما بيأثروا، لا بالبحث ولا بالاسم", () => {
    assert.equal(matches("سُكَّر", "سكر ناعم"), true);
    assert.equal(matches("سكر", "سُكَّر ناعم"), true);
    assert.equal(matches("شاي", "شــاي أخضر"), true);
  });

  it("\"ال\" اختيارية بكلمة طولها 4 أو أكتر", () => {
    assert.equal(matches("البسمتي", "رز بسمتي"), true);
    assert.equal(matches("البسمتي", "رز البسمتي"), true);
    assert.equal(matches("الة", "حاسبة"), false); // 3 حروف ← ما منشيل ال
  });

  it("الحروف الإنكليزية بلا حساسية لحالة الحرف", () => {
    assert.equal(matches("pepsi", "PEPSI Can"), true);
  });

  it("أحرف الـ regex الخاصة بتنعامل كنص عادي", () => {
    assert.equal(matches("1+1", "عرض 1+1"), true);
    assert.equal(matches("1+1", "عرض 11"), false);
    assert.equal(matches("(كبير)", "شامبو (كبير)"), true);
    assert.doesNotThrow(() => buildSearch("[*?"));
  });

  it("prefix بيطابق بداية الاسم بأول كلمة، و phrase الكلمات ورا بعض", () => {
    const s = buildSearch("رز بسمتي");
    assert.equal(new RegExp(s.prefix, "i").test("رز بسمتي هندي"), true);
    assert.equal(new RegExp(s.prefix, "i").test("كيس رز"), false);
    assert.equal(new RegExp(s.phrase, "i").test("كيس رز  بسمتي"), true);
    assert.equal(new RegExp(s.phrase, "i").test("بسمتي رز"), false);
  });

  it("ما في \\u بالـ patterns (MongoDB PCRE2 ما بيدعمها)", () => {
    const s = buildSearch("أرز البسمتي ٥");
    for (const p of [...s.filter.map((f) => f.productName.$regex), s.prefix, s.phrase]) {
      assert.equal(p.includes("\\u"), false);
    }
  });
});
