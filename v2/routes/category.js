import express from "express";
import { body, param } from "express-validator";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
router.use(checkSubscription);

// functions مش chains ثابتة: الـ chain بيتعدّل بمكانه، فـ .optional() كان رح يأثر على الإضافة كمان
const idParam = () => param("categoryId").isMongoId().withMessage("معرّف الفئة غير صالح");
const nameField = () => body("name").isString().trim().notEmpty().withMessage("اسم الفئة مطلوب")
  .isLength({ max: 60 }).withMessage("اسم الفئة طويل كتير");
const parentField = () => body("parentId").optional({ values: "null" }).isMongoId()
  .withMessage("معرّف الفئة الأب غير صالح");

router.get("/", getCategories);
router.post("/", [nameField(), parentField()], validate, createCategory);
router.patch("/:categoryId", [idParam(), nameField().optional(), parentField()], validate, updateCategory);
router.delete("/:categoryId", [idParam()], validate, deleteCategory);

export default router;
