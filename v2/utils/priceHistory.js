import PriceHistory from "../models/priceHistory.js";

export const PRICE_FIELDS = ["wholesalePackagePrice", "unitsPerPackage", "currency"];
export const HISTORY_LIMIT = 50;

// نسخة من سعر المنتج (قبل أو بعد التعديل) ← سطر بالسجل
export const priceEntry = (userId, product, source, at = product.latestWholeprice) => ({
  userId,
  productId: product._id,
  wholesalePackagePrice: product.wholesalePackagePrice,
  unitsPerPackage: product.unitsPerPackage,
  wholesaleUnitPrice: product.wholesaleUnitPrice,
  currency: product.currency,
  at: at ?? new Date(),
  source,
});

// السعر تغيّر؟ (نفس منطق updateProduct: بس الحقول اللي انبعتت)
export const priceChanged = (product, changes) =>
  PRICE_FIELDS.some((f) => changes[f] !== undefined && changes[f] !== product[f]);

// منتج جديد ← أول سطر
export const recordNewPrice = (userId, product, source) =>
  PriceHistory.create(priceEntry(userId, product, source));

// تعديل سعر. before = نسخة السعر قبل التعديل (priceEntry قبل ما نغيّر المنتج)
// إذا المنتج ما إلو سجل (من قبل الميزة) منحفظ القديم كمان، مشان يبيّن من وين لوين
export const recordPriceChange = async (userId, before, product, source) => {
  const hasHistory = await PriceHistory.exists({ userId, productId: product._id });
  const docs = hasHistory ? [] : [before];
  docs.push(priceEntry(userId, product, source));
  await PriceHistory.insertMany(docs);
};

// الغلط بالسجل ما لازم يفشّل حفظ المنتج نفسه (السعر انحفظ، السجل إضافة)
export const safely = async (fn) => {
  try {
    await fn();
  } catch (err) {
    console.error("price history:", err.message);
  }
};
