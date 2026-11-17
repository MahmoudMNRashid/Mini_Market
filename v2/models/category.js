import mongoose from "mongoose";
const Schema = mongoose.Schema;

// مستويين بس: parent = null ← فئة أب، parent = id ← فئة ابن
const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserV2", required: true },
    name: { type: String, required: true, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: "CategoryV2", default: null },
  },
  { timestamps: true }
);

// الاسم ما بيتكرر عند نفس المستخدم تحت نفس الأب
categorySchema.index({ userId: 1, parent: 1, name: 1 }, { unique: true });

export default mongoose.model("CategoryV2", categorySchema);
