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
    await mongoose.connect(
      `mongodb+srv://${process.env.MONGO_CONNECT_USER_NAME}:${process.env.MONGO_CONNECT_PASSWORD}@clusterrashid.qdwwmja.mongodb.net/${process.env.MONGO_CONNECT_DB}`
    );
    const server = app.listen(port);
    // console.log(`listen to port ${port}`);
    server.timeout = 600000;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
};
