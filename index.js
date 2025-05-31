import { connect, app } from "./util/connect.js";
import bodyParser from "body-parser";
import multer from "multer";
import dotenv from "dotenv";

import productRoute from "./routes/product.js";

dotenv.config();

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(multer({}).array("assets"));

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
