import Product from "../models/product.js";
import Category from "../models/category.js";
import User from "../models/user.js";
import InvoiceAlias from "../models/invoiceAlias.js";
import { httpError, isDuplicateKey } from "../utils/httpError.js";
import { scanInvoiceWithFallback } from "../utils/invoiceScan.js";
import { checkInvoice, checkLine } from "../utils/invoiceCheck.js";
import { aliasKey, buildIndex, matchLine } from "../utils/invoiceMatch.js";
import { DAILY_SCAN_LIMIT, damascusDay, nextQuota } from "../utils/scanQuota.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel أصلاً ما بيقبل أكبر من 4.5MB

const PRODUCT_FIELDS = "productName wholesalePackagePrice unitsPerPackage wholesaleUnitPrice currency categoryId latestWholeprice";

const round = (n) => Math.round(n * 10000) / 10000;

// ── قراءة فاتورة ───────────────────────────────────────────────────────────
// multipart: صورة بحقل assets ← سطور الفاتورة + لكل سطر المنتج المطابق أو المرشحين
export const scanInvoice = async (req, res, next) => {
  try {
    const file = req.files?.[0];
    if (!file) throw httpError(422, "ما وصلت صورة الفاتورة");
    if (!IMAGE_TYPES.includes(file.mimetype)) throw httpError(422, "الملف لازم يكون صورة");
    if (file.size > MAX_IMAGE_BYTES) throw httpError(413, "الصورة كبيرة كتير");

    // الحد اليومي (المالك بلا حد)
    const isAdmin = req.user.role === "admin";
    const today = damascusDay();
    const quota = nextQuota(req.user.invoiceScans, today, DAILY_SCAN_LIMIT());
    if (!isAdmin && !quota.allowed) {
      throw httpError(429, `وصلت للحد اليومي (${DAILY_SCAN_LIMIT()} فاتورة)، جرّب بكرا`);
    }

    const { result, model } = await scanInvoiceWithFallback({ buffer: file.buffer, mimeType: file.mimetype });

    // العداد بيزيد بس إذا نجحت القراءة
    await User.updateOne({ _id: req.user._id }, { $set: { invoiceScans: quota.quota } });

    const [products, aliasDocs] = await Promise.all([
      Product.find({ userId: req.userId }).select(PRODUCT_FIELDS).lean(),
      InvoiceAlias.find({ userId: req.userId, key: { $in: result.lines.map((l) => aliasKey(l.name)) } }).lean(),
    ]);

    const index = buildIndex(products);
    const aliases = new Map(aliasDocs.map((a) => [a.key, String(a.productId)]));
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const used = new Map(); // المنتجات اللي بنرجعها (المطابقة والمرشحين بس، مو كل الكتالوج)

    const lines = result.lines.map((line) => {
      const match = matchLine(index, line.name, aliases);
      for (const c of match.candidates) used.set(c.productId, byId.get(c.productId));
      return { ...line, mathOk: checkLine(line), match };
    });

    const check = checkInvoice(result);
    res.status(200).json({
      invoice: {
        supplier: result.supplier ?? null,
        date: result.date ?? null,
        currency: result.currency ?? "UNKNOWN",
        invoiceTotal: check.invoiceTotal,
        linesSum: check.linesSum,
        totalMatches: check.totalMatches,
      },
      lines,
      products: Object.fromEntries(used),
      model,
      scansLeft: isAdmin ? null : quota.left,
    });
  } catch (error) {
    next(error);
  }
};

// ── حفظ سطور الفاتورة دفعة وحدة ────────────────────────────────────────────
// كل سطر لحاله: اللي بينجح بينحفظ، واللي بيفشل بيرجع سببه (ما في كل شي أو لا شي)
// lines: [{ action: "update", productId, ... } | { action: "create", productName, categoryId, ... }]
// invoiceName (اختياري) ← بينحفظ بذاكرة الأسماء مشان يطابق فوراً المرة الجاية
export const applyInvoice = async (req, res, next) => {
  try {
    const { lines } = req.body;

    // الفئات اللي انطلبت لازم تكون للمستخدم نفسه
    const categoryIds = [...new Set(lines.map((l) => l.categoryId).filter(Boolean))];
    const ownedCategories = new Set(
      (await Category.find({ _id: { $in: categoryIds }, userId: req.userId }).select("_id").lean()).map((c) =>
        String(c._id)
      )
    );

    const results = [];
    for (const [i, line] of lines.entries()) {
      try {
        const product = line.action === "create" ? await createLine(req.userId, line, ownedCategories) : await updateLine(req.userId, line);
        if (line.invoiceName && product) await rememberAlias(req.userId, line.invoiceName, product._id);
        results.push({ index: i, ok: true, action: product.changed === false ? "unchanged" : line.action, product: clean(product) });
      } catch (error) {
        const status = isDuplicateKey(error) ? 409 : error.statusCode || 500;
        if (status === 500) console.error("invoice apply line failed:", error);
        results.push({
          index: i,
          ok: false,
          status,
          message: status === 409 ? "في منتج بنفس الاسم" : status === 500 ? "صار خطأ، جرّب مرة تانية" : error.message,
        });
      }
    }

    const count = (fn) => results.filter(fn).length;
    res.status(200).json({
      results,
      summary: {
        created: count((r) => r.ok && r.action === "create"),
        updated: count((r) => r.ok && r.action === "update"),
        unchanged: count((r) => r.ok && r.action === "unchanged"),
        failed: count((r) => !r.ok),
      },
    });
  } catch (error) {
    next(error);
  }
};

const clean = (doc) => {
  const { userId, __v, changed, ...data } = doc.toObject ? doc.toObject() : doc;
  return data;
};

const createLine = async (userId, line, ownedCategories) => {
  if (!line.productName) throw httpError(422, "اسم المنتج مطلوب");
  const categoryId = line.categoryId || null;
  if (categoryId && !ownedCategories.has(String(categoryId))) throw httpError(404, "الفئة غير موجودة");

  return Product.create({
    userId,
    productName: line.productName,
    wholesalePackagePrice: line.wholesalePackagePrice,
    unitsPerPackage: line.unitsPerPackage,
    wholesaleUnitPrice: round(line.wholesalePackagePrice / line.unitsPerPackage),
    currency: line.currency,
    latestWholeprice: new Date(),
    categoryId,
  });
};

// بالتعديل منغيّر حقول السعر بس (الاسم والفئة بيضلوا متل ما المستخدم حاططهم)
const updateLine = async (userId, line) => {
  if (!line.productId) throw httpError(422, "معرّف المنتج مطلوب");
  const product = await Product.findOne({ _id: line.productId, userId });
  if (!product) throw httpError(404, "المنتج غير موجود، يمكن انمحى");

  const fields = ["wholesalePackagePrice", "unitsPerPackage", "currency"];
  const changed = fields.some((f) => line[f] !== product[f]);
  if (!changed) {
    product.changed = false;
    return product;
  }

  for (const f of fields) product[f] = line[f];
  product.wholesaleUnitPrice = round(product.wholesalePackagePrice / product.unitsPerPackage);
  product.latestWholeprice = new Date();
  await product.save();
  return product;
};

const rememberAlias = async (userId, invoiceName, productId) => {
  const key = aliasKey(invoiceName);
  if (!key) return;
  await InvoiceAlias.updateOne({ userId, key }, { $set: { productId } }, { upsert: true });
};
