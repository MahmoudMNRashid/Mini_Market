// منطق نقل منتجات v1 ← ProductV2 (بدون قاعدة بيانات، مشان ينفحص بالـ tests)
// السكربت: scripts/migrate-v1.js

const round = (n) => Math.round(n * 10000) / 10000;

// الاسم: بلا فراغات زيادة (الـ unique index بـ v2 على الاسم بالحرف)
export const cleanName = (name) =>
  typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";

const USD = new Set(["usd", "$", "دولار", "dollar"]);
const SYP = new Set(["syp", "sp", "ل.س", "ليرة", "ل س", "ليره"]);

export const cleanCurrency = (c) => {
  const v = String(c ?? "").trim().toLowerCase();
  if (USD.has(v)) return "USD";
  if (SYP.has(v)) return "SYP";
  return null;
};

const validDate = (...ds) => ds.map((d) => (d ? new Date(d) : null)).find((d) => d && !isNaN(d));

// منتج v1 واحد ← { doc } أو { error }
export function mapV1Product(p, userId) {
  const productName = cleanName(p.productName);
  if (!productName) return { error: "بلا اسم" };

  const currency = cleanCurrency(p.currency);
  if (!currency) return { error: `عملة مو معروفة: ${p.currency}` };

  const price = Number(p.wholesalePackagePrice);
  if (!Number.isFinite(price) || price < 0) return { error: `سعر غلط: ${p.wholesalePackagePrice}` };

  const units = Number(p.untisPerPackage);
  if (!Number.isFinite(units) || units <= 0) return { error: `عدد بالطرد غلط: ${p.untisPerPackage}` };

  return {
    doc: {
      userId,
      productName,
      wholesalePackagePrice: price,
      unitsPerPackage: units,
      wholesaleUnitPrice: round(price / units),
      currency,
      // تاريخ آخر سعر من v1 (مش تاريخ النقل) مشان "آخر تحديث" يضل صح
      latestWholeprice: validDate(p.latestWholeprice, p.updatedAt, p.createdAt) ?? new Date(),
      categoryId: null,
    },
  };
}

// كل منتجات v1 ← خطة: شو بينضاف، شو مكرر، شو غلط، شو موجود أصلاً
// existingNames: أسماء منتجات المالك بـ v2 هلق (مشان السكربت ينعاد بلا تكرار)
export function planMigration(v1Products, userId, existingNames = []) {
  const existing = new Set(existingNames.map(cleanName));
  const invalid = [];
  const byName = new Map(); // الاسم ← المنتجات بهالاسم

  for (const p of v1Products) {
    const { doc, error } = mapV1Product(p, userId);
    if (error) {
      invalid.push({ v1Id: String(p._id), productName: p.productName, error });
      continue;
    }
    const list = byName.get(doc.productName) ?? [];
    list.push({ v1Id: String(p._id), doc });
    byName.set(doc.productName, list);
  }

  const toInsert = [];
  const duplicates = [];
  const alreadyThere = [];
  for (const [name, list] of byName) {
    // مكرر بـ v1: منخلّي الأحدث سعراً
    list.sort((a, b) => b.doc.latestWholeprice - a.doc.latestWholeprice);
    const [keep, ...drop] = list;
    if (drop.length) {
      duplicates.push({
        productName: name,
        kept: { v1Id: keep.v1Id, price: keep.doc.wholesalePackagePrice, currency: keep.doc.currency },
        dropped: drop.map((d) => ({ v1Id: d.v1Id, price: d.doc.wholesalePackagePrice, currency: d.doc.currency })),
      });
    }
    if (existing.has(name)) alreadyThere.push(name);
    else toInsert.push(keep.doc);
  }

  return { toInsert, duplicates, invalid, alreadyThere };
}
