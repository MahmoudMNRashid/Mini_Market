import mongoose from "mongoose";
const Schema = mongoose.Schema;

// ذاكرة الأسماء: اسم المنتج متل ما بيجي بفاتورة المورّد ← منتج المستخدم
// key = aliasKey(اسم الفاتورة) (موحّد الكتابة)، مشان نفس الاسم يطابق فوراً المرة الجاية
const invoiceAliasSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserV2", required: true },
    key: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "ProductV2", required: true },
  },
  { timestamps: true }
);

invoiceAliasSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("InvoiceAliasV2", invoiceAliasSchema);
