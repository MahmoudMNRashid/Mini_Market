import express from "express";
import { body } from "express-validator";

import {
  deleteProduct,
  addProduct,
  updateProduct,
  searchProduct,
  searchProduct_Es,
  addProduct_Es,
  updateProduct_Es,
  deleteProduct_Es,
  getSellPrice,
} from "../controllers/product.js";

const validateAddProduct = [
  body("productName").notEmpty().withMessage("Product name is required"),

  body("wholesalePackagePrice")
    .isNumeric()
    .withMessage("Wholesale package price must be a number")
    .custom((value) => value >= 0)
    .withMessage("Wholesale must be a positive number"),

  body("untisPerPackage")
    .isNumeric()
    .withMessage("Untis per package must be a number")
    .custom((value) => value >= 0)
    .withMessage("Untis per package must be a positive number"),

  body("wholesaleUnitPrice")
    .isNumeric()
    .withMessage("wholesale unit price must be a number")
    .custom((value) => value >= 0)
    .withMessage("wholesale unit price must be a positive number"),

  body("currency")
    .isIn(["USD", "SYP"])

    .withMessage(`currency  must be a "USD" or "SYP"`),
];

const router = express.Router();
router.delete("/delete_Es/:productId", deleteProduct_Es);
router.post("/add_Es", validateAddProduct, addProduct_Es);
router.patch("/update_Es/:productId", validateAddProduct, updateProduct_Es);
router.get("/search_Es", searchProduct_Es);

router.delete("/delete/:productId", deleteProduct);
router.post("/add", validateAddProduct, addProduct);
router.patch("/update/:productId", validateAddProduct, updateProduct);
router.get("/search", searchProduct);
router.get("/sellPrice", getSellPrice);

export default router;
