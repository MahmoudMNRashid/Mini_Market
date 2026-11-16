import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      const error = new Error("غير مصرح، يرجى تسجيل الدخول");
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const error = new Error("جلسة غير صالحة، يرجى تسجيل الدخول مجدداً");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error("المستخدم غير موجود");
      error.statusCode = 401;
      throw error;
    }

    const isActive = user.subscriptionEnd && user.subscriptionEnd > new Date();

    if (!isActive) {
      // احرق الكود لحظة اكتشاف الانتهاء
      if (user.activationCode) {
        user.activationCode = null;
        await user.save();
      }

      const error = new Error("انتهت صلاحية اشتراكك، يرجى التواصل معنا");
      error.statusCode = 403;
      throw error;
    }

    req.userId = user._id.toString();
    next();
  } catch (error) {
    next(error);
  }
};