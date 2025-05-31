import mongoose from "mongoose";
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    productName: { type: String, required: true },
    wholesalePackagePrice: { type: Number, required: true },
    untisPerPackage: { type: Number, required: true },
    wholesaleUnitPrice: { type: Number, required: true },
    currency: { type: String, required: true },
    latestWholeprice: { type: Date, required: true },
  },
  { timestamps: true }
);

productSchema.index({ productName: 1 });
productSchema.index({ productName: "text" });
export default mongoose.model("Product", productSchema);
