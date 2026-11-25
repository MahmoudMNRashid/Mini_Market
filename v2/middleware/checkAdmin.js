import crypto from "crypto";
import { httpError } from "../utils/httpError.js";
import { isAdmin } from "../utils/account.js";
import { userFromToken } from "./checkSubscription.js";

// admin routes بتقبل طريقتين:
// 1. header اسمه x-admin-key لازم يطابق ADMIN_KEY بالـ env (الـ test panel)
// 2. توكن مستخدم دوره admin (التطبيق، ADMIN_KEY ما بينحط بالتطبيق أبداً)
export const checkAdmin = async (req, res, next) => {
  try {
    const providedKey = req.get("x-admin-key");

    if (providedKey != null) {
      const adminKey = process.env.ADMIN_KEY;
      // لو ما في ADMIN_KEY بالـ env → سكّر بدل ما يضل مفتوح
      if (!adminKey) throw httpError(503, "Admin access is not configured");

      const a = Buffer.from(providedKey);
      const b = Buffer.from(adminKey);
      if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) throw httpError(401, "غير مصرح");
      return next();
    }

    // الدور منقراه من الـ DB مو من التوكن ← إذا انشال الدور بينشال فوراً
    const user = await userFromToken(req);
    // 404 مو 403: التطبيق بيعمل logout على 403، والمستخدم العادي ما لازم يطلع من حسابه
    if (!isAdmin(user)) throw httpError(404, "مو موجود");

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
