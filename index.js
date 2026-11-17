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
connect();
app.get("/test", async (req, res) => {
  res.status(200).json({ message: "hello" });
});

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
app.use("/product", productRoute);
app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message || error.error || error || "Something Accurr";
  const data = error.data || null;

  if (error.data) {
    res.status(status).json({ message, data });
  } else {
    res.status(status).json({ message });
  }
});
