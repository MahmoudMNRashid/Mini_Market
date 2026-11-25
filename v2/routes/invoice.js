import express from "express";
import { body } from "express-validator";
import { applyInvoice, scanInvoice } from "../controllers/invoice.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
router.use(checkSubscription);

const applyValidators = [
  body("lines").isArray({ min: 1, max: 200 }).withMessage("لازم يكون في سطر واحد عالأقل"),
  body("lines.*.action").isIn(["create", "update"]).withMessage('الإجراء لازم يكون "create" أو "update"'),
  body("lines.*.productId").optional().isMongoId().withMessage("معرّف المنتج غير صالح"),
  body("lines.*.productName").optional().isString().trim().notEmpty().withMessage("اسم المنتج مطلوب"),
  body("lines.*.wholesalePackagePrice").isFloat({ min: 0 }).toFloat().withMessage("سعر الطرد لازم يكون رقم موجب"),
  body("lines.*.unitsPerPackage").isFloat({ gt: 0 }).toFloat().withMessage("عدد الوحدات لازم يكون أكبر من صفر"),
  body("lines.*.currency").isIn(["USD", "SYP"]).withMessage('العملة لازم تكون "USD" أو "SYP"'),
  body("lines.*.categoryId").optional({ values: "null" }).isMongoId().withMessage("معرّف الفئة غير صالح"),
  body("lines.*.invoiceName").optional().isString().trim().isLength({ max: 200 }),
];

// الصورة بتوصل بحقل assets (multer معمول global بالـ index.js)
router.post("/scan", scanInvoice);
router.post("/apply", applyValidators, validate, applyInvoice);

export default router;
