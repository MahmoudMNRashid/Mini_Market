import { escapeRegex } from "./httpError.js";

// حروف بتنكتب بأكتر من شكل ← أي شكل منها بيطابق التاني
export const GROUPS = [
  "اأإآٱ",
  "ةه",
  "ىيیئ",
  "وؤ",
  "كک",
  "0٠", "1١", "2٢", "3٣", "4٤", "5٥", "6٦", "7٧", "8٨", "9٩",
];

// تشكيل + تطويل (ـ): بنشيلهم من البحث وبنسمح فيهم بين حروف الاسم
// (الحروف نفسها مش \uXXXX، لأنو MongoDB (PCRE2) ما بيدعم \u)
export const DIACRITICS = /[ً-ٰٟـ]/g;
const OPTIONAL_DIACRITICS = "[ً-ٰٟـ]*";

const charPattern = (ch) => {
  const group = GROUPS.find((g) => g.includes(ch));
  return group ? `[${group}]` : escapeRegex(ch);
};

const wordPattern = (word) => {
  // "البسمتي" ← بيطابق "بسمتي" و "البسمتي"
  let prefix = "";
  if (word.length >= 4 && /^[اأإآ]ل/.test(word)) {
    prefix = "(?:[اأإآ]ل)?";
    word = word.slice(2);
  }
  return prefix + [...word].map(charPattern).join(OPTIONAL_DIACRITICS);
};

// بيرجع null إذا البحث فاضي
// filter: كل كلمة لازم تكون موجودة (بأي ترتيب)
// prefix / phrase: للترتيب حسب الصلة
export const buildSearch = (search) => {
  const words = String(search).replace(DIACRITICS, "").trim().split(/\s+/).filter(Boolean).slice(0, 10);
  if (!words.length) return null;

  const patterns = words.map(wordPattern);
  return {
    filter: patterns.map((p) => ({ productName: { $regex: p, $options: "i" } })),
    prefix: "^" + patterns[0],
    phrase: patterns.join("\\s+"),
  };
};
