import mongoose from "mongoose";
import Category from "../models/category.js";
import Product from "../models/product.js";
import { httpError, isDuplicateKey } from "../utils/httpError.js";

const DUPLICATE_MSG = "في فئة بنفس الاسم بنفس المكان";

// بيجيب فئة الأب وبيتأكد إنها للمستخدم وإنها فئة أب (مستويين بس)
const findValidParent = async (parentId, userId) => {
  const parent = await Category.findOne({ _id: parentId, userId });
  if (!parent) throw httpError(404, "الفئة الأب غير موجودة");
  if (parent.parent) throw httpError(422, "ما بيصير تعمل فئة فرعية جوا فئة فرعية");
  return parent;
};

// ── كل الفئات كشجرة ──────────────────────────────────────────────────────
// [{ _id, name, productCount, children: [{ _id, name, productCount }] }]
export const getCategories = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [categories, counts] = await Promise.all([
      Category.find({ userId }).sort({ name: 1 }).lean(),
      Product.aggregate([
        { $match: { userId, categoryId: { $ne: null } } },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
    const node = (c) => ({
      _id: c._id,
      name: c.name,
      productCount: countMap.get(c._id.toString()) || 0,
    });

    const tree = categories
      .filter((c) => !c.parent)
      .map((p) => ({
        ...node(p),
        children: categories
          .filter((c) => c.parent && c.parent.toString() === p._id.toString())
          .map(node),
      }));

    const uncategorizedCount = await Product.countDocuments({ userId, categoryId: null });

    res.status(200).json({ categories: tree, uncategorizedCount });
  } catch (error) {
    next(error);
  }
};

// ── إضافة فئة (أب أو ابن) ──────────────────────────────────────────────────
export const createCategory = async (req, res, next) => {
  const { name, parentId = null } = req.body;

  try {
    if (parentId) await findValidParent(parentId, req.userId);

    const category = await Category.create({
      userId: req.userId,
      name,
      parent: parentId || null,
    });

    res.status(201).json({ message: "تمت إضافة الفئة", category });
  } catch (error) {
    if (isDuplicateKey(error)) return next(httpError(409, DUPLICATE_MSG));
    next(error);
  }
};

// ── تعديل الاسم و/أو نقل الفئة لأب تاني (parentId: null ← تصير فئة أب) ────
export const updateCategory = async (req, res, next) => {
  const { categoryId } = req.params;
  const { name, parentId } = req.body;

  try {
    const category = await Category.findOne({ _id: categoryId, userId: req.userId });
    if (!category) throw httpError(404, "الفئة غير موجودة");

    if (name !== undefined) category.name = name;

    if (parentId !== undefined) {
      if (parentId) {
        if (parentId === categoryId) throw httpError(422, "الفئة ما بتكون أب لحالها");

        const hasChildren = await Category.exists({ parent: category._id });
        if (hasChildren) {
          throw httpError(409, "هالفئة فيها فئات فرعية، ما بيصير تصير فئة فرعية");
        }

        await findValidParent(parentId, req.userId);
      }
      category.parent = parentId || null;
    }

    await category.save();
    res.status(200).json({ message: "تم تعديل الفئة", category });
  } catch (error) {
    if (isDuplicateKey(error)) return next(httpError(409, DUPLICATE_MSG));
    next(error);
  }
};

// ── حذف فئة ────────────────────────────────────────────────────────────────
// ابن ← منتجاته بتنتقل للأب | أب فيه أبناء ← ممنوع | أب بدون أبناء ← منتجاته بدون فئة
export const deleteCategory = async (req, res, next) => {
  const { categoryId } = req.params;

  try {
    const category = await Category.findOne({ _id: categoryId, userId: req.userId });
    if (!category) throw httpError(404, "الفئة غير موجودة");

    const hasChildren = await Category.exists({ parent: category._id });
    if (hasChildren) throw httpError(409, "امحي الفئات الفرعية أول");

    const moveTo = category.parent || null;
    const { modifiedCount } = await Product.updateMany(
      { userId: req.userId, categoryId: category._id },
      { categoryId: moveTo }
    );

    await category.deleteOne();

    res.status(200).json({
      message: "تم حذف الفئة",
      movedProducts: modifiedCount,
      movedTo: moveTo, // null = صارت بدون فئة
    });
  } catch (error) {
    next(error);
  }
};
