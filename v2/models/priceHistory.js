import mongoose from "mongoose";
const Schema = mongoose.Schema;

// سجل الأسعار: سطر لكل مرة انحط فيها سعر لمنتج (إضافة، تعديل، فاتورة)
// السعر الحالي = آخر سطر. المنتجات اللي قبل السجل بينحفظ سعرها القديم أول مرة بيتغيّر (source: null)
const priceHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "UserV2", required: true },
  productId: { type: Schema.Types.ObjectId, ref: "ProductV2", required: true },
  wholesalePackagePrice: { type: Number, required: true },
  unitsPerPackage: { type: Number, required: true },
  wholesaleUnitPrice: { type: Number, required: true },
  currency: { type: String, required: true, enum: ["USD", "SYP"] },
  at: { type: Date, required: true },
  // manual = من ورقة المنتج، invoice = من فاتورة، null = سعر قديم من قبل السجل
  source: { type: String, enum: ["manual", "invoice", null], default: null },
});

priceHistorySchema.index({ userId: 1, productId: 1, at: -1 });

export default mongoose.model("PriceHistoryV2", priceHistorySchema);
