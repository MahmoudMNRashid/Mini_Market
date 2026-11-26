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

// حروف المد: الأسماء الأجنبية بتنكتب فيها وبلاها (ليبيرس/ليبرس، نسكافيه/نسكافه، شامبو/شامبوو)
const LONG_VOWELS = "اوىيی";
const LOOSE_MIN = 4; // كلمة أقصر ← بحث دقيق ("رز" ما بتلاقي "روز")
const ARABIC_WORD = /^[ء-ي]+$/;
const MAX_WORD = 20; // حماية: كلمة طويلة كتير ما بتطوّل الـ regex بلا حدود
const MAX_VARIANTS = 3; // أول 3 حروف مد بس ممكن ينقصوا (كلمة فيها أكتر نادرة)
const OPTIONAL_VOWEL = `(?:[${LONG_VOWELS}]${OPTIONAL_DIACRITICS})?`;

// loose: بين أي حرفين ممكن يجي حرف مد زيادة بالاسم ("ليبرس" ← "ليبيرس")،
// وحرف مد واحد بس من البحث ممكن يكون ناقص بالاسم ("ليبيرس" ← "ليبرس").
// واحد بس: لو كلهن اختياريين "ليمون" بتصير ل-م-ن وبتلاقي أي شي
const lettersPattern = (word, loose) => {
  const chars = [...word];
  if (!loose) return chars.map(charPattern).join(OPTIONAL_DIACRITICS);
  const join = (parts) => parts.join(OPTIONAL_DIACRITICS + OPTIONAL_VOWEL);
  const vowelAt = chars.flatMap((ch, i) => (i > 0 && LONG_VOWELS.includes(ch) ? [i] : [])).slice(0, MAX_VARIANTS);
  if (!vowelAt.length) return join(chars.map(charPattern));
  const variants = vowelAt.map((v) =>
    join(chars.map((ch, i) => (i === v ? `(?:${charPattern(ch)})?` : charPattern(ch))))
  );
  return variants.length === 1 ? variants[0] : `(?:${variants.join("|")})`;
};

const wordPattern = (word, { loose = true } = {}) => {
  word = word.slice(0, MAX_WORD);
  // "البسمتي" ← بيطابق "بسمتي" و "البسمتي"
  let prefix = "";
  if (word.length >= 4 && /^[اأإآ]ل/.test(word)) {
    prefix = "(?:[اأإآ]ل)?";
    word = word.slice(2);
  }
  const isLoose = loose && word.length >= LOOSE_MIN && ARABIC_WORD.test(word);
  return prefix + lettersPattern(word, isLoose);
};

// بيرجع null إذا البحث فاضي
// filter: كل كلمة لازم تكون موجودة (بأي ترتيب)، مع تسامح بحروف المد للكلمات الطويلة
// strict: نفس الكلمات بلا تسامح ← التطابق الحرفي بيطلع أول بالترتيب
// prefix / phrase: للترتيب حسب الصلة
export const buildSearch = (search) => {
  const words = String(search).replace(DIACRITICS, "").trim().split(/\s+/).filter(Boolean).slice(0, 10);
  if (!words.length) return null;

  const patterns = words.map((w) => wordPattern(w));
  return {
    filter: patterns.map((p) => ({ productName: { $regex: p, $options: "i" } })),
    strict: words.map((w) => wordPattern(w, { loose: false })),
    prefix: "^" + patterns[0],
    phrase: patterns.join("\\s+"),
  };
};
