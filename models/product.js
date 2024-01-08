import mongoose from "mongoose";
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    name: { type: String, required: true },
    wholesalePrice: { type: Number, required: true },
    wholesalePriceDate: { type: Date, required: true },
    sellingPrice: { type: Number, required: true },
    numberInBox: { type: Number, required: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text" });
export default mongoose.model("Product", productSchema);
