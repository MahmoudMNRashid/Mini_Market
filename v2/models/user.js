import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    activationCode: { type: String, default: null },
    subscriptionEnd: { type: Date, default: null },
    // true بعد ما يدخل الكود مرة وحدة بفترة الاشتراك الحالية، بيرجع false عند الانتهاء
    isVerified: { type: Boolean, default: false },
    // admin بس للمالك (OWNER_PHONE)، بينضبط لحالو من الـ env عند الدخول
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // رقم المالك التاني (OWNER_LINKED_PHONE): بيشتغل على نفس بيانات المالك
    linkedTo: { type: Schema.Types.ObjectId, ref: "UserV2", default: null },
    // آخر تغيير لكلمة السر: التوكنات الأقدم منه بتبطل (checkSubscription)
    passwordChangedAt: { type: Date, default: null },
    // كلمة سر مؤقتة من الأدمن ← التطبيق بيجبره يغيّرها أول ما يفوت
    mustChangePassword: { type: Boolean, default: false },
    // عداد قراءة الفواتير اليومي (utils/scanQuota.js)
    invoiceScans: {
      day: { type: String, default: null },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("UserV2", userSchema);
