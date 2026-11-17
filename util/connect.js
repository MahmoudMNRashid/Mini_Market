import express from "express";
import mongoose from "mongoose";
import dns from "dns";

export const app = express();
export const port = process.env.PORT || 3000;
export const hostLocal = `http://localhost:${port}`;
export const hostOnline = `https://connectify-8wsv.onrender.com`;

export const connect = async () => {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    // رابط عادي بدل mongodb+srv: ما بيحتاج SRV lookup (اللي بيعلّق مع NordVPN split tunneling)
    // إذا Atlas غيّر السيرفرات: جيب الرابط الجديد من Atlas → Connect → Drivers → اختار نسخة driver قديمة (2.2.12)
    const hosts = [
      "ac-d8kj711-shard-00-00.qdwwmja.mongodb.net:27017",
      "ac-d8kj711-shard-00-01.qdwwmja.mongodb.net:27017",
      "ac-d8kj711-shard-00-02.qdwwmja.mongodb.net:27017",
    ].join(",");
    await mongoose.connect(
      `mongodb://${process.env.MONGO_CONNECT_USER_NAME}:${process.env.MONGO_CONNECT_PASSWORD}@${hosts}/${process.env.MONGO_CONNECT_DB}?tls=true&replicaSet=atlas-6juh67-shard-0&authSource=admin`
    );
    const server = app.listen(port);
    console.log(`listen to port ${port}`);
    server.timeout = 600000;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
};
