import crypto from "crypto";

// حماية بسيطة لـ admin routes: header اسمه x-admin-key لازم يطابق ADMIN_KEY بالـ env
export const checkAdmin = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;

  // لو ما في ADMIN_KEY بالـ env → سكّر كل شي بدل ما يضل مفتوح
  if (!adminKey) {
    const error = new Error("Admin access is not configured");
    error.statusCode = 503;
    return next(error);
  }

  const providedKey = req.get("x-admin-key") || "";

  const a = Buffer.from(providedKey);
  const b = Buffer.from(adminKey);
  const isValid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!isValid) {
    const error = new Error("غير مصرح");
    error.statusCode = 401;
    return next(error);
  }

  next();
};
