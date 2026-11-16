import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    activationCode: { type: String, default: null },
    subscriptionEnd: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("UserV2", userSchema);
