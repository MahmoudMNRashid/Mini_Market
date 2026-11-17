import express from "express";
import { query } from "express-validator";
import { getPriceList } from "../controllers/priceList.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
router.use(checkSubscription);

router.get(
  "/",
  [
    query("categoryId").isMongoId().withMessage("اختار فئة"),
    query("rate").optional().isFloat({ gt: 0 }).withMessage("سعر الصرف لازم يكون رقم أكبر من صفر"),
    query("format").optional().isIn(["json", "html"]).withMessage('format لازم يكون "json" أو "html"'),
    query("type").optional().isIn(["wholesale", "retail"]).withMessage('type لازم يكون "wholesale" أو "retail"'),
    query("margin").optional().isFloat({ min: 0, max: 500 }).withMessage("نسبة الربح لازم تكون بين 0 و 500"),
  ],
  validate,
  getPriceList
);

export default router;
