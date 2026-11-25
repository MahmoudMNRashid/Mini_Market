import dotenv from "dotenv";
dotenv.config(); // ← لازم تكون أول شي

import { connect, app } from "./util/connect.js";
import bodyParser from "body-parser";
import multer from "multer";

import productRoute from "./routes/product.js";
import authRouteV2 from "./v2/routes/auth.js";
import adminRouteV2 from "./v2/routes/admin.js";
import categoryRouteV2 from "./v2/routes/category.js";
import productRouteV2 from "./v2/routes/product.js";
import priceListRouteV2 from "./v2/routes/priceList.js";
import logsRouteV2 from "./v2/routes/logs.js";
import invoiceRouteV2 from "./v2/routes/invoice.js";
import { recordServerError } from "./v2/controllers/errorLog.js";
connect();
app.get("/test", async (req, res) => {
  res.status(200).json({ message: "hello" });
});

// سجل أخطاء التطبيق: حد صغير للحجم (أكبر من هيك ← 413 قبل ما يوصل للكود)
app.use("/api/v2/logs", bodyParser.json({ limit: "16kb" }));
app.use(bodyParser.json()); // application/jsonss
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");
  // preflight: رد مباشرة قبل ما يوصل لـ checkAdmin / checkSubscription
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(multer({}).array("assets"));
app.use("/api/v2/auth", authRouteV2);
app.use("/api/v2/admin", adminRouteV2);
app.use("/api/v2/categories", categoryRouteV2);
app.use("/api/v2/products", productRouteV2);
app.use("/api/v2/price-list", priceListRouteV2);
app.use("/api/v2/logs", logsRouteV2);
app.use("/api/v2/invoices", invoiceRouteV2);
app.use("/product", productRoute);
app.use(async (error, req, res, next) => {
  const status = error.statusCode || error.status || 500;
  // 5xx بس بينحفظ بسجل الأخطاء (تبويب الإدارة). منستنّاه لأنو Vercel بيوقف الشغل بعد الرد
  if (status >= 500) await recordServerError(error, req);
  const message = error.message || error.error || error || "Something Accurr";
  const data = error.data || null;

  if (error.data) {
    res.status(status).json({ message, data });
  } else {
    res.status(status).json({ message });
  }
});
