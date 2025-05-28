import Product from "../models/product.js";
import { validationResult } from "express-validator";
import { esClient } from "../elasticsearch.js";
import axios from "axios";
import * as cheerio from "cheerio";
export const addProduct = async (req, res, next) => {
  const errors = validationResult(req);
  const productName = req.body.productName;
  const wholesalePackagePrice = req.body.wholesalePackagePrice;
  const untisPerPackage = req.body.untisPerPackage;
  const wholesaleUnitPrice = req.body.wholesaleUnitPrice;
  const retailUnitPrice = req.body.retailUnitPrice;

  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    const existProduct = await Product.find({
      productName: { $regex: new RegExp(productName, "i") },
    });

    if (existProduct.length > 0) {
      const error = new Error("There are already item with this name");
      error.statusCode = 400;
      throw error;
    }

    const product = {
      productName,
      wholesalePackagePrice,
      untisPerPackage,
      wholesaleUnitPrice,
      retailUnitPrice,
      latestWholeprice: new Date(),
    };

    const newProduct = new Product(product);
    await newProduct.save();
    res.status(200).json({ message: "Product was created" });
  } catch (error) {
    next(error);
  }
};
export const updateProduct = async (req, res, next) => {
  const productId = req.params.productId;
  const errors = validationResult(req);
  const productName = req.body.productName;
  const wholesalePackagePrice = req.body.wholesalePackagePrice;
  const untisPerPackage = req.body.untisPerPackage;
  const wholesaleUnitPrice = req.body.wholesaleUnitPrice;
  const retailUnitPrice = req.body.retailUnitPrice;

  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    product.productName = productName;
    product.wholesalePackagePrice = wholesalePackagePrice;
    product.untisPerPackage = untisPerPackage;
    product.wholesaleUnitPrice = wholesaleUnitPrice;
    product.retailUnitPrice = retailUnitPrice;
    product.latestWholeprice = new Date();

    await product.save();

    res.status(200).json({ message: "Product was updated" });
  } catch (error) {
    next(error);
  }
};
export const deleteProduct = async (req, res, next) => {
  const productId = req.params.productId;
  try {
    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ message: "Prodcut was deleted" });
  } catch (error) {
    next(error);
  }
};
export const searchProduct = async (req, res, next) => {
  const searchQuery = req.query.name;

  try {
    const products = await Product.find({
      productName: { $regex: new RegExp(searchQuery, "i") },
    }).limit(40);
    res.json(products);
  } catch (error) {
    next(error);
  }
};
export const getSellPrice = async (req, res, next) => {
  try {
    const response = await axios.get(
      "https://www.sp-today.com/en/currency/us_dollar/city/damascus"
    );

    const $ = cheerio.load(response.data);
    let sellPrice = null;

    // البحث عن div يحتوي على النص Sell ثم إيجاد القيمة التي تليه
    $(".cur-col").each((_, el) => {
      const label = $(el).find(".label").text().trim();
      if (label.toLowerCase().includes("sell")) {
        sellPrice = $(el).find(".value").text().trim();
      }
    });

    res.status(200).json({ price: +sellPrice });
  } catch (error) {
    next(error);
  }
};

/////////////////////////////////////////////

export const addProduct_Es = async (req, res, next) => {
  const errors = validationResult(req);
  const name = req.body.name;
  const wholesalePrice = req.body.wholesalePrice;
  const sellingPrice = req.body.sellingPrice;
  const weight = req.body.weight;
  const expiryDate = req.body.expiryDate;
  const numberInBox = req.body.numberInBox;

  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Month is zero-based, so add 1
    const day = currentDate.getDate();
    const product = {
      name,
      wholesalePrice,
      sellingPrice,
      wholesalePriceDate: year + "-" + month + "-" + day,
      weight: weight || "",
      expiryDate: expiryDate || "",
      numberInBox,
    };

    const newProduct = new Product(product);
    const result = await newProduct.save();
    await esClient.index({
      index: "products",
      id: result._id.toString(),
      body: {
        name: result.name,
        wholesalePrice: result.wholesalePrice,
        sellingPrice: result.sellingPrice,
        weight: result.weight,
        expiryDate: result.expiryDate,
        numberInBox: result.numberInBox,
      },
    });
    res.status(200).json({ message: "Product was created" });
  } catch (error) {
    next(error);
  }
};
export const updateProduct_Es = async (req, res, next) => {
  const productId = req.params.productId;
  const errors = validationResult(req);
  const name = req.body.name;
  const wholesalePrice = req.body.wholesalePrice;
  const sellingPrice = req.body.sellingPrice;
  const weight = req.body.weight;
  const expiryDate = req.body.expiryDate;
  const numberInBox = req.body.numberInBox;

  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Month is zero-based, so add 1
    const day = currentDate.getDate();

    product.name = name;
    product.wholesalePrice = wholesalePrice;
    product.sellingPrice = sellingPrice;
    product.numberInBox = numberInBox;
    product.weight = weight || "";
    product.expiryDate = expiryDate || "";
    product.wholesalePriceDate = year + "-" + month + "-" + day;

    const result = await product.save();

    await esClient.update({
      index: "products",
      id: result._id.toString(),
      body: {
        doc: {
          name: result.name,
          wholesalePrice: result.wholesalePrice,
          sellingPrice: result.sellingPrice,
          weight: result.weight,
          expiryDate: result.expiryDate,
          numberInBox: result.numberInBox,
        },
      },
    });
    res.status(200).json({ message: "Product was updated" });
  } catch (error) {
    next(error);
  }
};
export const deleteProduct_Es = async (req, res, next) => {
  const productId = req.params.productId;
  try {
    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    await esClient.delete({
      index: "products",
      id: product._id.toString(),
    });

    res.status(200).json({ message: "Prodcut was deleted" });
  } catch (error) {
    next(error);
  }
};
export const searchProduct_Es = async (req, res, next) => {
  const searchQuery = req.query.name;

  try {
    const result = await esClient.search({
      index: "products",
      body: {
        query: {
          match: {
            name: searchQuery,
          },
        },
      },
    });

    const hits = result.hits.hits;
    const products = hits.map((hit) => hit._source);

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};
