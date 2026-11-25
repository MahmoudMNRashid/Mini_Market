import Product from "../models/product.js";
import { validationResult } from "express-validator";
import { esClient } from "../elasticsearch.js";
import axios from "axios";
import * as cheerio from "cheerio";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
export const addProduct = async (req, res, next) => {
  const errors = validationResult(req);
  const productName = req.body.productName;
  const wholesalePackagePrice = req.body.wholesalePackagePrice;
  const untisPerPackage = req.body.untisPerPackage;
  const currency = req.body.currency;

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

    const wholesaleUnitPrice = parseFloat(
      (wholesalePackagePrice / untisPerPackage).toFixed(10)
    );
    const product = {
      productName,
      wholesalePackagePrice,
      untisPerPackage,
      wholesaleUnitPrice,
      currency,
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

  const currency = req.body.currency;

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
    const wholesaleUnitPrice = parseFloat(
      (wholesalePackagePrice / untisPerPackage).toFixed(10)
    );
    product.productName = productName;
    product.wholesalePackagePrice = wholesalePackagePrice;
    product.untisPerPackage = untisPerPackage;
    product.latestWholeprice = new Date();
    product.currency = currency;
    product.wholesaleUnitPrice = wholesaleUnitPrice;

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
  const { name = "", page = 1, limit = 40 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  try {
    const [products, total] = await Promise.all([
      Product.find({
        productName: { $regex: new RegExp(name.trim(), "i") },
      })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments({
        productName: { $regex: new RegExp(name.trim(), "i") },
      }),
    ]);

    res.json({
      products,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total,
    });
  } catch (error) {
    next(error);
  }
};

export const getTobaccoPricePDF = async (req, res, next) => {
  try {
    // 1. جيب منتجات الدخان
    const products = await Product.find({
      productName: { $regex: /دخان|فحم|سيجار|قصدير|معسل/i },
      currency: "USD",
    }).lean();

    if (!products.length) {
      const error = new Error("No tobacco products found");
      error.statusCode = 404;
      throw error;
    }

    const exchangeRate = parseFloat(req.query.rate);
    if (!exchangeRate || isNaN(exchangeRate)) {
      const error = new Error("Exchange rate is required");
      error.statusCode = 400;
      throw error;
    }
const __dirname = dirname(fileURLToPath(import.meta.url));
const fontBase64 = readFileSync(join(__dirname, "../Cairo-Regular.ttf")).toString("base64")
    // 3. ولّد HTML
    const rows = products
      .map(
        (p, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#e8f0ef"}">
        <td>${p.productName}</td>
        <td>$${p.wholesalePackagePrice.toFixed(2)}</td>
        <td>${(
          p.wholesalePackagePrice * exchangeRate
        ).toLocaleString()} ل.س</td>
        <td>$${p.wholesaleUnitPrice.toFixed(4)}</td>
        <td>${(p.wholesaleUnitPrice * exchangeRate).toLocaleString()} ل.س</td>
         <td>${new Date(p.latestWholeprice).toLocaleDateString("en-US")}</td>
      </tr>
    `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600&display=swap" rel="stylesheet">
  <style>
  @font-face {
    font-family: 'Cairo';
    src: url('data:font/truetype;base64,${fontBase64}') format('truetype');
  }
  body { font-family: 'Cairo', sans-serif; padding: 24px; direction: rtl; }
    h1 { color: #054239; font-size: 20px; margin-bottom: 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #054239; color: white; padding: 10px 8px; text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #ddd; text-align: right; }
    .note { margin-top: 16px; font-size: 10px; color: #888; }
  </style>
</head>
      <body>
        <h1>قائمة أسعار منتجات الدخان</h1>
        <div class="meta">
          سعر الصرف: 1 USD = ${exchangeRate.toLocaleString()} ل.س &nbsp;|&nbsp;
          التاريخ: ${new Date().toLocaleDateString("ar-SY")}
        </div>
        <table>
          <thead>
            <tr>
              <th>اسم المنتج</th>
              <th>سعر الجملة (USD)</th>
              <th>سعر الجملة (ل.س)</th>
              <th>سعر المفرد (USD)</th>
              <th>سعر المفرد (ل.س)</th>
              <th>تاريخ آخر سعر</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="note">* الأسعار بسعر الجملة</div>
      </body>
      </html>
    `;
    console.log(html);
    // 4. حوّل HTML لـ PDF

    let browser;

    if (process.env.NODE_ENV === "production") {
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteer = (await import("puppeteer-core")).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });
    await browser.close();

    // 5. أرسل الـ PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=tobacco-prices.pdf",
      "Content-Length": pdfBuffer.length,
    });

    res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// not used
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
