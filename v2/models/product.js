import mongoose from "mongoose";
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserV2", required: true },
    productName: { type: String, required: true, trim: true },
    wholesalePackagePrice: { type: Number, required: true, min: 0 },
    unitsPerPackage: { type: Number, required: true, min: 0 },
    wholesaleUnitPrice: { type: Number, required: true, min: 0 }, // بينحسب بالسيرفر
    currency: { type: String, required: true, enum: ["USD", "SYP"] },
    latestWholeprice: { type: Date, required: true }, // آخر مرة تغيّر فيها السعر
    // ممكن تكون فئة أب أو ابن، أو null (بدون فئة)
    categoryId: { type: Schema.Types.ObjectId, ref: "CategoryV2", default: null },
  },
  { timestamps: true }
);

// اسم المنتج ما بيتكرر عند نفس المستخدم
productSchema.index({ userId: 1, productName: 1 }, { unique: true });
productSchema.index({ userId: 1, categoryId: 1 });

export default mongoose.model("ProductV2", productSchema);
