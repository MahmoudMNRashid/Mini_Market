import mongoose from "mongoose";
import Product from "../models/product.js";
import Category from "../models/category.js";
import PriceHistory from "../models/priceHistory.js";
import { httpError, isDuplicateKey } from "../utils/httpError.js";
import { buildSearch } from "../utils/search.js";
import {
  HISTORY_LIMIT,
  priceChanged as didPriceChange,
  priceEntry,
  recordNewPrice,
  recordPriceChange,
  safely,
} from "../utils/priceHistory.js";

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

    // ObjectId صريح لأنو الـ aggregate (تحت) ما بيعمل cast متل find
    const filter = { userId: new mongoose.Types.ObjectId(req.userId) };

    const s = search ? buildSearch(search) : null;
    if (s) filter.$and = s.filter;

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

    let products, total;

    if (s) {
      // ترتيب حسب الصلة: بيبلّش بأول كلمة (2) + الكلمات متتالية بنفس الترتيب (1)، بعدين أبجدي
      const [result] = await Product.aggregate([
        { $match: filter },
        {
          $addFields: {
            _score: {
              $add: [
                { $cond: [{ $regexMatch: { input: "$productName", regex: s.prefix, options: "i" } }, 2, 0] },
                { $cond: [{ $regexMatch: { input: "$productName", regex: s.phrase, options: "i" } }, 1, 0] },
              ],
            },
          },
        },
        { $sort: { _score: -1, productName: 1 } },
        {
          $facet: {
            products: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              { $project: { userId: 0, __v: 0, _score: 0 } },
            ],
            total: [{ $count: "n" }],
          },
        },
      ]);
      products = result.products;
      total = result.total[0]?.n || 0;
    } else {
      [products, total] = await Promise.all([
        Product.find(filter)
          .sort({ productName: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select("-userId -__v")
          .lean(),
        Product.countDocuments(filter),
      ]);
    }

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
    await safely(() => recordNewPrice(req.userId, product, "manual"));

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

    const priceChanged = didPriceChange(product, req.body);
    // نسخة السعر القديم قبل ما نغيّر (للسجل)
    const before = priceChanged ? priceEntry(req.userId, product, null) : null;

    for (const f of fields) {
      if (req.body[f] !== undefined) product[f] = f === "categoryId" ? req.body[f] || null : req.body[f];
    }

    if (priceChanged) {
      product.wholesaleUnitPrice = round(product.wholesalePackagePrice / product.unitsPerPackage);
      product.latestWholeprice = new Date();
    }

    await product.save();
    if (priceChanged) await safely(() => recordPriceChange(req.userId, before, product, "manual"));

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
    await safely(() => PriceHistory.deleteMany({ userId: req.userId, productId: product._id }));

    res.status(200).json({ message: "تم حذف المنتج", productId: product._id });
  } catch (error) {
    next(error);
  }
};

// ── سجل أسعار منتج (الأحدث أول) ───────────────────────────────────────────
// فاضي ← المنتج ما تغيّر سعره من وقت ما بلّش السجل (التطبيق بيعرض السعر الحالي بس)
export const getPriceHistory = async (req, res, next) => {
  try {
    const exists = await Product.exists({ _id: req.params.productId, userId: req.userId });
    if (!exists) throw httpError(404, "المنتج غير موجود");

    const history = await PriceHistory.find({ userId: req.userId, productId: req.params.productId })
      .sort({ at: -1, _id: -1 })
      .limit(HISTORY_LIMIT)
      .select("wholesalePackagePrice unitsPerPackage wholesaleUnitPrice currency at source")
      .lean();

    res.status(200).json({ history });
  } catch (error) {
    next(error);
  }
};
