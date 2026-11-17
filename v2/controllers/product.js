import Product from "../models/product.js";
import Category from "../models/category.js";
import { httpError, isDuplicateKey, escapeRegex } from "../utils/httpError.js";

const DUPLICATE_MSG = "في منتج بنفس الاسم";

const assertCategoryOwned = async (categoryId, userId) => {
  if (!categoryId) return;
  const exists = await Category.exists({ _id: categoryId, userId });
  if (!exists) throw httpError(404, "الفئة غير موجودة");
};

const round = (n) => Math.round(n * 10000) / 10000;

// ── عرض المنتجات مع بحث وفلترة وصفحات ──────────────────────────────────────
// ?search=رز  &categoryId=<id> | none  &page=1  &limit=20
// categoryId لفئة أب ← بيجيب منتجاتها + منتجات كل الأبناء
export const getProducts = async (req, res, next) => {
  try {
    const { search, categoryId } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    const filter = { userId: req.userId };

    if (search && search.trim()) {
      filter.productName = { $regex: escapeRegex(search.trim()), $options: "i" };
    }

    if (categoryId === "none") {
      filter.categoryId = null;
    } else if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId: req.userId }).lean();
      if (!category) throw httpError(404, "الفئة غير موجودة");

      if (!category.parent) {
        const children = await Category.find({ parent: category._id }).select("_id").lean();
        filter.categoryId = { $in: [category._id, ...children.map((c) => c._id)] };
      } else {
        filter.categoryId = category._id;
      }
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ productName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-userId -__v")
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// ── إضافة منتج ─────────────────────────────────────────────────────────────
export const createProduct = async (req, res, next) => {
  const { productName, wholesalePackagePrice, unitsPerPackage, currency, categoryId = null } = req.body;

  try {
    await assertCategoryOwned(categoryId, req.userId);

    const product = await Product.create({
      userId: req.userId,
      productName,
      wholesalePackagePrice,
      unitsPerPackage,
      wholesaleUnitPrice: round(wholesalePackagePrice / unitsPerPackage),
      currency,
      latestWholeprice: new Date(),
      categoryId: categoryId || null,
    });

    const { userId, __v, ...data } = product.toObject();
    res.status(201).json({ message: "تمت إضافة المنتج", product: data });
  } catch (error) {
    if (isDuplicateKey(error)) return next(httpError(409, DUPLICATE_MSG));
    next(error);
  }
};

// ── تعديل منتج (جزئي: بتبعت بس الحقول اللي بدك تغيّرها) ──────────────────
// categoryId: null ← بيصير بدون فئة
export const updateProduct = async (req, res, next) => {
  const { productId } = req.params;
  const fields = ["productName", "wholesalePackagePrice", "unitsPerPackage", "currency", "categoryId"];

  try {
    const product = await Product.findOne({ _id: productId, userId: req.userId });
    if (!product) throw httpError(404, "المنتج غير موجود");

    if (req.body.categoryId !== undefined) {
      await assertCategoryOwned(req.body.categoryId, req.userId);
    }

    const priceFields = ["wholesalePackagePrice", "unitsPerPackage", "currency"];
    const priceChanged = priceFields.some(
      (f) => req.body[f] !== undefined && req.body[f] !== product[f]
    );

    for (const f of fields) {
      if (req.body[f] !== undefined) product[f] = f === "categoryId" ? req.body[f] || null : req.body[f];
    }

    if (priceChanged) {
      product.wholesaleUnitPrice = round(product.wholesalePackagePrice / product.unitsPerPackage);
      product.latestWholeprice = new Date();
    }

    await product.save();

    const { userId, __v, ...data } = product.toObject();
    res.status(200).json({ message: "تم تعديل المنتج", product: data });
  } catch (error) {
    if (isDuplicateKey(error)) return next(httpError(409, DUPLICATE_MSG));
    next(error);
  }
};

// ── حذف منتج ───────────────────────────────────────────────────────────────
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.productId, userId: req.userId });
    if (!product) throw httpError(404, "المنتج غير موجود");

    res.status(200).json({ message: "تم حذف المنتج", productId: product._id });
  } catch (error) {
    next(error);
  }
};
