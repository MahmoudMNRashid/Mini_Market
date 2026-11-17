import Product from "../models/product.js";
import Category from "../models/category.js";
import { httpError } from "../utils/httpError.js";

export const DEFAULT_MARGIN = 12.5; // نسبة الربح الافتراضية لقائمة الزبائن (%)

const round100 = (n) => Math.round(n / 100) * 100;
const ceil100 = (n) => Math.ceil(n / 100) * 100;

// بالليرة: سعر الطرد المسجّل بالليرة بيضل متل ما هو، أي شي محوّل أو مقسوم بيتقرّب لأقرب 100
const wholesaleRow = (p, rate) => {
  const toSyp = (n) => (p.currency === "USD" ? n * rate : n);
  return {
    _id: p._id,
    productName: p.productName,
    unitsPerPackage: p.unitsPerPackage,
    packagePrice: p.currency === "USD" ? round100(toSyp(p.wholesalePackagePrice)) : p.wholesalePackagePrice,
    unitPrice: round100(toSyp(p.wholesalePackagePrice / p.unitsPerPackage)),
  };
};

// سعر المبيع للوحدة = سعر الجملة للوحدة + الربح، بيتقرّب لفوق (ما منبيع تحت نسبة الربح)
const retailRow = (p, rate, margin) => {
  const unitSyp = (p.wholesalePackagePrice / p.unitsPerPackage) * (p.currency === "USD" ? rate : 1);
  return { _id: p._id, productName: p.productName, price: ceil100(unitSyp * (1 + margin / 100)) };
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmt = (n) => Number(n).toLocaleString("en-US");

// ── قائمة أسعار فئة ────────────────────────────────────────────────────────
// GET /api/v2/price-list?categoryId=<id>&rate=13500[&type=wholesale|retail][&margin=12.5][&format=html]
// wholesale (لصاحب المحل): العدد + سعر الطرد + سعر الوحدة
// retail (للزبائن): الاسم + سعر المبيع للوحدة فقط (ما في أسعار جملة ولا سعر صرف)
// فئة أب ← منتجات الأب نفسه (بدون عنوان) + قسم لكل فئة فرعية
export const getPriceList = async (req, res, next) => {
  try {
    const { categoryId, format } = req.query;
    const type = req.query.type || "wholesale";
    const rate = req.query.rate ? Number(req.query.rate) : null;
    const margin = req.query.margin !== undefined ? Number(req.query.margin) : DEFAULT_MARGIN;

    const category = await Category.findOne({ _id: categoryId, userId: req.userId }).lean();
    if (!category) throw httpError(404, "الفئة غير موجودة");

    const children = category.parent
      ? []
      : await Category.find({ parent: category._id }).sort({ name: 1 }).lean();

    const allCategoryIds = [category._id, ...children.map((c) => c._id)];
    const products = await Product.find({ userId: req.userId, categoryId: { $in: allCategoryIds } })
      .sort({ productName: 1 })
      .select("productName wholesalePackagePrice unitsPerPackage currency categoryId")
      .lean();

    if (!rate && products.some((p) => p.currency === "USD")) {
      throw httpError(422, "سعر الصرف مطلوب لأنو في منتجات بالدولار");
    }

    const toRow = type === "retail" ? (p) => retailRow(p, rate, margin) : (p) => wholesaleRow(p, rate);

    const sectionOf = (cat, title) => ({
      categoryId: cat._id,
      title, // null = منتجات الفئة الأب نفسها (بدون عنوان)
      products: products.filter((p) => p.categoryId.toString() === cat._id.toString()).map(toRow),
    });

    const sections = [sectionOf(category, null), ...children.map((c) => sectionOf(c, c.name))]
      .filter((s) => s.products.length);

    const data = {
      type,
      category: { _id: category._id, name: category.name },
      ...(type === "retail" ? { margin } : { rate }), // الزبون ما بيشوف سعر الصرف
      generatedAt: new Date(),
      total: products.length,
      sections,
    };

    if (format === "html") {
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(renderHtml(data));
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// ── HTML للطباعة / PDF (التطبيق بيمرّقه لـ expo-print) ──────────────────────
// ما في خطوط خارجية: الجوال بيرسم العربي بخطوطه
const renderHtml = ({ type, category, rate, generatedAt, total, sections }) => {
  const isRetail = type === "retail";
  const date = new Date(generatedAt).toLocaleDateString("en-GB");
  const cols = isRetail ? 3 : 5;
  let n = 0;

  const head = isRetail
    ? `<tr><th>#</th><th>المنتج</th><th class="price">السعر (ل.س)</th></tr>`
    : `<tr><th>#</th><th>المنتج</th><th class="c">العدد</th><th class="price">سعر الطرد</th><th class="price">سعر الوحدة</th></tr>`;

  const rowHtml = (p) =>
    isRetail
      ? `<tr><td class="num">${++n}</td><td>${escapeHtml(p.productName)}</td><td class="price">${fmt(p.price)}</td></tr>`
      : `<tr><td class="num">${++n}</td><td>${escapeHtml(p.productName)}</td><td class="c">${fmt(p.unitsPerPackage)}</td><td class="price">${fmt(p.packagePrice)}</td><td class="price">${fmt(p.unitPrice)}</td></tr>`;

  const rows = sections
    .map((s) => (s.title ? `<tr class="section"><td colspan="${cols}">${escapeHtml(s.title)}</td></tr>` : "") + s.products.map(rowHtml).join(""))
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(category.name)} - ${date}</title>
<style>
  @page { size: A4; margin: 12mm; }
  /* أبيض دايماً: حتى لو الجوال على Dark mode، الطباعة لازم تكون أبيض وأسود */
  :root { color-scheme: only light; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: system-ui, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif; color: #111; margin: 0; padding: 4px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  h1 { font-size: 24px; margin: 0; }
  .meta { font-size: 14px; text-align: left; line-height: 1.6; }
  .rate { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: ${isRetail ? 18 : 15}px; }
  th { text-align: right; border-bottom: 1.5px solid #111; padding: 6px; font-size: 13px; }
  td { padding: ${isRetail ? 9 : 7}px 6px; border-bottom: 1px solid #ddd; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .num { width: 32px; color: #777; font-size: 12px; }
  .c { text-align: center; white-space: nowrap; }
  .price { text-align: left; font-weight: 700; white-space: nowrap; direction: ltr; }
  th.price { direction: rtl; }
  tr.section td { background: #222 !important; color: #fff; font-weight: 700; font-size: 15px; }
  .empty { padding: 30px; text-align: center; color: #777; }
  footer { margin-top: 10px; font-size: 12px; color: #777; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(category.name)}</h1>
  <div class="meta">
    ${!isRetail && rate ? `<div class="rate">الدولار: ${fmt(rate)} ل.س</div>` : ""}
    <div>${date}</div>
  </div>
</header>
${total ? `<table><thead>${head}</thead><tbody>${rows}</tbody></table>` : `<div class="empty">ما في منتجات بهالفئة</div>`}
<footer>${total} منتج</footer>
</body>
</html>`;
};
