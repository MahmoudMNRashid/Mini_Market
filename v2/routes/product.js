import express from "express";
import { body, param, query } from "express-validator";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
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

router.get("/", listValidators, validate, getProducts);
router.post("/", createValidators, validate, createProduct);
router.patch("/:productId", updateValidators, validate, updateProduct);
router.delete("/:productId", [idParam()], validate, deleteProduct);

export default router;
