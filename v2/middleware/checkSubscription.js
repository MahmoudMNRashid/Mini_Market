import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { httpError } from "../utils/httpError.js";
import { dataOwnerId, isSubscriptionActive } from "../utils/account.js";
import { syncOwner } from "../utils/owner.js";
import { isTokenStale } from "../utils/password.js";

// بيقرا الـ Bearer token وبيجيب المستخدم من الـ DB (مع مطابقة المالك من الـ env)
// بيرمي 401 إذا ما في توكن، أو غلط، أو المستخدم انمسح
export const userFromToken = async (req) => {
  const authHeader = req.get("Authorization");
  if (!authHeader) throw httpError(401, "غير مصرح، يرجى تسجيل الدخول");

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw httpError(401, "جلسة غير صالحة، يرجى تسجيل الدخول مجدداً");
  }

  const user = await User.findById(decoded.userId);
  if (!user) throw httpError(401, "المستخدم غير موجود");
  // كلمة السر تغيّرت بعد ما انطلع هالتوكن (من جهاز تاني أو مؤقتة من الأدمن)
  if (isTokenStale(decoded.iat, user.passwordChangedAt)) {
    throw httpError(401, "تغيّرت كلمة السر، ادخل من جديد");
  }

  return syncOwner(user);
};

export const checkSubscription = async (req, res, next) => {
  try {
    const user = await userFromToken(req);

    if (!isSubscriptionActive(user)) {
      // احرق الكود وألغِ التحقق لحظة اكتشاف الانتهاء
      if (user.activationCode || user.isVerified) {
        user.activationCode = null;
        user.isVerified = false;
        await user.save();
      }
      throw httpError(403, "انتهت صلاحية اشتراكك، يرجى التواصل معنا");
    }

    // كل الاستعلامات بتمشي على req.userId ← الرقم التاني للمالك بيشوف بيانات المالك
    req.userId = dataOwnerId(user);
    req.user = user; // مشان ما نرجع نجيبه من الـ DB بالـ controller
    next();
  } catch (error) {
    next(error);
  }
};
