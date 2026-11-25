import mongoose from "mongoose";
import { TTL_DAYS } from "../utils/errorLog.js";
const Schema = mongoose.Schema;

// سجل واحد لكل خطأ مختلف (fingerprint)، والتكرار بيزيد count بس
// الكتابة بتصير بـ pipeline update من utils/errorLog.js (upsertOp)، هون بس الشكل والـ indexes
const sampleSchema = new Schema(
  {
    at: Date,
    phone: String,
    stack: String,
    appVersion: String,
    updateId: String,
  },
  { _id: false }
);

const errorLogSchema = new Schema({
  fingerprint: { type: String, required: true, unique: true },
  source: { type: String, enum: ["server", "app"], required: true },
  kind: String, // 5xx | crash | js | api
  message: String,
  route: String,
  count: { type: Number, default: 0 },
  users: [String], // أرقام صار عندهم (لحد 20)
  samples: [sampleSchema], // آخر 5 مرات بالتفاصيل
  firstSeen: Date,
  lastSeen: Date,
  resolvedAt: { type: Date, default: null }, // "انحلّت" من تبويب الإدارة
  reopened: { type: Boolean, default: false }, // رجع صار بعد ما انعلّم انحلّت
});

// بينمحى لحالو إذا مرّ 30 يوم بلا ما يتكرر
errorLogSchema.index({ lastSeen: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });

export default mongoose.model("ErrorLogV2", errorLogSchema);
