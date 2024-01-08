import express from "express";
import { body } from "express-validator";

import { deleteProduct,addProduct, updateProduct, searchProduct, searchProduct_Es, addProduct_Es,updateProduct_Es,deleteProduct_Es } from "../controllers/product.js";


const validateAddProduct = [
    body('name').notEmpty().withMessage('Product name is required'),
    body('wholesalePrice')
      .isNumeric().withMessage('Wholesale price must be a number')
      .custom(value => value >= 0).withMessage('Wholesale must be a positive number'),
    body('sellingPrice').isNumeric().withMessage('Selling price must be a number')
    .custom(value => value >= 0).withMessage('Selling price must be a positive number'),
    body('numberInBox')
    .isNumeric().withMessage('Number in box must be a number')
    .custom(value => value >= 0).withMessage('Number in box must be a positive number'),
];
  


const router = express.Router()
router.delete('/delete_Es/:productId',deleteProduct_Es)
router.post('/add_Es',validateAddProduct,addProduct_Es)
router.patch('/update_Es/:productId',validateAddProduct,updateProduct_Es)
router.get('/search_Es',searchProduct_Es)




router.delete('/delete/:productId',deleteProduct)
router.post('/add',validateAddProduct,addProduct)
router.patch('/update/:productId',validateAddProduct,updateProduct)
router.get('/search',searchProduct)



export default router;