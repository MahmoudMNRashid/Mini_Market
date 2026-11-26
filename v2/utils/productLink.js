// ربط الفئات بالمنتجات (صفحة dev-tools/categories.html): فلترة محلية للمنتجات المحمّلة
// منطق صافي ← بيشتغل بالمتصفح وبـ node --test، ونفس قواعد السيرفر
import { buildSearch } from "./search.js";

// نفس بحث السيرفر (أشكال الحروف، التشكيل، "ال" اختيارية، كل الكلمات بأي ترتيب)
export const searchMatcher = (search) => {
  const s = buildSearch(search ?? "");
  if (!s) return () => true;
  const res = s.filter.map((f) => new RegExp(f.productName.$regex, f.productName.$options));
  return (name) => res.every((re) => re.test(name));
};

// شجرة GET /categories ← Map: id ← { label: "حبوب ← رز", parentId, ids: [نفسها + أبناؤها] }
export const categoryIndex = (tree = []) => {
  const map = new Map();
  for (const p of tree) {
    const kids = p.children ?? [];
    map.set(String(p._id), { label: p.name, parentId: null, ids: [String(p._id), ...kids.map((c) => String(c._id))] });
    for (const c of kids) {
      map.set(String(c._id), { label: `${p.name} ← ${c.name}`, parentId: String(p._id), ids: [String(c._id)] });
    }
  }
  return map;
};

// اسم فئة المنتج للعرض ("" ← بلا فئة، "؟" ← فئة انمحت أو مش معروفة)
export const categoryLabel = (product, index) =>
  product.categoryId ? (index.get(String(product.categoryId))?.label ?? "؟") : "";

// category: "all" | "none" | id (فئة أب ← منتجاتها + منتجات أبنائها، متل السيرفر)
export const filterProducts = (products, { search = "", category = "all", index = new Map() } = {}) => {
  const match = searchMatcher(search);
  let inCategory = () => true;
  if (category === "none") inCategory = (p) => !p.categoryId;
  else if (category !== "all") {
    const ids = new Set(index.get(String(category))?.ids ?? [String(category)]);
    inCategory = (p) => p.categoryId != null && ids.has(String(p.categoryId));
  }
  return products.filter((p) => inCategory(p) && match(p.productName));
};
