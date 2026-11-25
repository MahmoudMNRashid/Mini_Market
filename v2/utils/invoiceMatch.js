// مطابقة أسطر الفاتورة مع منتجات المستخدم (منطق صافي بدون DB)
// الفكرة: منوحّد الكتابة، منقارن الكلمات مع تسامح بغلطة حرف، والكلمات النادرة (اسم الماركة)
// إلها وزن أكبر من الكلمات الشائعة (شوكولا، بسكويت…). والوزن المختلف = منتج مختلف.

// ── توحيد الكتابة ─────────────────────────────────────────────────────────
const LETTERS = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ة: "ه", ى: "ي", ی: "ي", ئ: "ي", ؤ: "و", ک: "ك" };
const DIACRITICS = /[ً-ٰٟـ]/g;
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0);

export const normalizeText = (str) =>
  toLatinDigits(String(str ?? ""))
    .replace(DIACRITICS, "")
    .replace(/[أإآٱةىیئؤک]/g, (ch) => LETTERS[ch])
    .toLowerCase()
    .replace(/(\d)[,٫](\d)/g, "$1.$2") // 1,5 ← 1.5
    .replace(/[^\p{L}\p{N}.]+/gu, " ") // أي رمز (/ * ( ) -) ← فراغ
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ") // النقطة بس جوا الأرقام
    .replace(/(\d)(\p{L})/gu, "$1 $2") // 50غ ← 50 غ
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

// ── الوزن / الحجم ─────────────────────────────────────────────────────────
// كل شي بيتحول لغرام أو مل مشان نقارن 1كغ مع 1000غ
const UNITS = {
  غ: ["g", 1], غم: ["g", 1], غرام: ["g", 1], جرام: ["g", 1], g: ["g", 1], gr: ["g", 1],
  كغ: ["g", 1000], كيلو: ["g", 1000], كغم: ["g", 1000], kg: ["g", 1000],
  مل: ["ml", 1], ml: ["ml", 1],
  ل: ["ml", 1000], لتر: ["ml", 1000], ليتر: ["ml", 1000], l: ["ml", 1000],
};

// كلمات ما بتميّز المنتج (ما بتدخل بالمقارنة)
const STOP = new Set(["و", "مع", "عرض", "علبه", "طرد", "كيس", "قطعه", "حبه", "كرتونه", "تنكه", "تنك"]);

// "ال" بأول الكلمة اختيارية (متل البحث): البسمتي = بسمتي
const stripAl = (w) => (w.length >= 4 && w.startsWith("ال") ? w.slice(2) : w);

export const tokenize = (name) => {
  const parts = normalizeText(name).split(" ").filter(Boolean);
  const words = [];
  const sizes = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const unit = UNITS[parts[i + 1]];
    if (/^\d+(\.\d+)?$/.test(p) && unit) {
      sizes.push(`${Math.round(Number(p) * unit[1] * 100) / 100}${unit[0]}`);
      i++; // الوحدة انحسبت
      continue;
    }
    if (UNITS[p] || STOP.has(p)) continue;
    words.push(stripAl(p));
  }
  return { words, sizes };
};

// مفتاح ذاكرة الأسماء: نفس الاسم بأي كتابة بيعطي نفس المفتاح
export const aliasKey = (name) => {
  const { words, sizes } = tokenize(name);
  return [...words, ...sizes].join(" ");
};

// ── تشابه كلمتين (0..1) ───────────────────────────────────────────────────
const levenshtein = (a, b) => {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};

export const wordSimilarity = (a, b) => {
  if (a === b) return 1;
  if (/\d/.test(a) || /\d/.test(b)) return 0; // الأرقام لازم تتطابق بالضبط
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 3) return 0;
  if (a.startsWith(b) || b.startsWith(a)) return 0.85; // شوكولا / شوكولاته
  if (max < 4) return 0;
  const ratio = 1 - levenshtein(a, b) / max;
  return ratio >= 0.75 ? ratio * 0.95 : 0; // غلطة حرف: فرير / فريز
};

// ── الفهرس والمطابقة ──────────────────────────────────────────────────────
// products: [{ _id, productName, ... }] ← منحسب الكلمات مرة وحدة لكل طلب
export const buildIndex = (products) => {
  const df = new Map();
  const items = products.map((p) => {
    const t = tokenize(p.productName);
    for (const w of new Set(t.words)) df.set(w, (df.get(w) ?? 0) + 1);
    return { product: p, ...t };
  });
  return { items, df, n: products.length };
};

// وزن الكلمة: النادرة (ماركة) أهم من الشائعة (شوكولا)
const weightOf = (index, w) => Math.log(1 + (index.n + 1) / (1 + (index.df.get(w) ?? 0)));

// قديش كلمات "from" موجودة بـ "to" (موزونة)
const coverage = (index, from, to) => {
  let total = 0;
  let got = 0;
  for (const w of from) {
    const weight = weightOf(index, w);
    total += weight;
    got += weight * Math.max(0, ...to.map((x) => wordSimilarity(w, x)));
  }
  return total ? got / total : 0;
};

export const scoreMatch = (index, line, item) => {
  if (!line.words.length || !item.words.length) return 0;
  // اسم منتجك عادة أقصر من اسم الفاتورة ← تغطية كلماتك أهم
  let score = 0.7 * coverage(index, item.words, line.words) + 0.3 * coverage(index, line.words, item.words);
  if (line.sizes.length && item.sizes.length) {
    const same = line.sizes.some((s) => item.sizes.includes(s));
    score = same ? Math.min(1, score + 0.1) : score * 0.4; // ميلكا 100غ ≠ ميلكا 50غ
  }
  return Math.round(score * 1000) / 1000;
};

export const MATCH_SCORE = 0.8; // فوقها مع فرق واضح ← تعديل مباشر
export const CANDIDATE_SCORE = 0.35; // تحتها ما منعرضه كمرشح
const CLEAR_GAP = 0.15;

// aliases: Map(key → productId) من ذاكرة الأسماء
// بيرجع { status: "match" | "choose" | "new", productId, source, candidates: [{ productId, score }] }
export const matchLine = (index, name, aliases = new Map()) => {
  const aliased = aliases.get(aliasKey(name));
  const aliasedItem = aliased && index.items.find((i) => String(i.product._id) === String(aliased));
  if (aliasedItem) {
    return {
      status: "match",
      productId: String(aliased),
      source: "alias",
      candidates: [{ productId: String(aliased), score: 1 }],
    };
  }

  const line = tokenize(name);
  const ranked = index.items
    .map((item) => ({ productId: String(item.product._id), score: scoreMatch(index, line, item) }))
    .filter((c) => c.score >= CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const [top, second] = ranked;
  if (!top) return { status: "new", productId: null, source: null, candidates: [] };
  if (top.score >= MATCH_SCORE && (!second || top.score - second.score >= CLEAR_GAP)) {
    return { status: "match", productId: top.productId, source: "name", candidates: ranked };
  }
  return { status: "choose", productId: null, source: null, candidates: ranked };
};
