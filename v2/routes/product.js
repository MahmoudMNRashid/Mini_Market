import express from "express";
import { body, param, query } from "express-validator";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getPriceHistory,
  setCategoryBulk,
} from "../controllers/product.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
router.use(checkSubscription);

// كل validator دالة مشان نقدر نعمله optional بالتعديل بدون ما نأثر على الإضافة
const v = {
  productName: () => body("productName").isString().trim().notEmpty().withMessage("اسم المنتج مطلوب"),
  wholesalePackagePrice: () => body("wholesalePackagePrice").isFloat({ min: 0 }).toFloat()
    .withMessage("سعر الطرد لازم يكون رقم موجب"),
  unitsPerPackage: () => body("unitsPerPackage").isFloat({ gt: 0 }).toFloat()
    .withMessage("عدد الوحدات لازم يكون أكبر من صفر"),
  currency: () => body("currency").isIn(["USD", "SYP"]).withMessage('العملة لازم تكون "USD" أو "SYP"'),
  categoryId: () => body("categoryId").optional({ values: "null" }).isMongoId()
    .withMessage("معرّف الفئة غير صالح"),
};

const BULK_MAX = 2000;

const idParam = () => param("productId").isMongoId().withMessage("معرّف المنتج غير صالح");

const listValidators = [
  query("categoryId").optional()
    .custom((val) => val === "none" || /^[a-f\d]{24}$/i.test(val))
    .withMessage("معرّف الفئة غير صالح"),
];

const createValidators = [
  v.productName(), v.wholesalePackagePrice(), v.unitsPerPackage(), v.currency(), v.categoryId(),
];

const updateValidators = [
  idParam(),
  v.productName().optional(),
  v.wholesalePackagePrice().optional(),
  v.unitsPerPackage().optional(),
  v.currency().optional(),
  v.categoryId(),
];

// ربط فئة بمنتجات كتير بطلب واحد (أداة dev-tools/categories.html)
// { productIds: [...], categoryId: <id> | null }
const bulkCategoryValidators = [
  body("productIds").isArray({ min: 1, max: BULK_MAX }).withMessage(`لازم تبعت بين 1 و ${BULK_MAX} منتج`),
  body("productIds.*").isMongoId().withMessage("معرّف منتج غير صالح"),
  // لازم ينبعت صريح: غيابه ما بيعني null (وإلا طلب ناقص بيفك فئة الكل)
  body("categoryId").custom((val) => val === null || (typeof val === "string" && /^[a-f\d]{24}$/i.test(val)))
    .withMessage("categoryId لازم يكون معرّف فئة أو null"),
];

router.get("/", listValidators, validate, getProducts);
router.post("/bulk-category", bulkCategoryValidators, validate, setCategoryBulk);
router.post("/", createValidators, validate, createProduct);
router.patch("/:productId", updateValidators, validate, updateProduct);
router.delete("/:productId", [idParam()], validate, deleteProduct);
router.get("/:productId/history", [idParam()], validate, getPriceHistory);

export default router;
