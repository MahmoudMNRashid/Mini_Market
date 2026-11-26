import { randomInt } from "node:crypto";

export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 64;

// كلمة السر الجديدة: بيرجّع رسالة الغلط أو null إذا تمام
export const newPasswordError = (password) => {
  if (typeof password !== "string" || password.trim().length === 0) return "اكتب كلمة السر الجديدة";
  if (password.length < PASSWORD_MIN) return `كلمة السر لازم تكون ${PASSWORD_MIN} أحرف أو أرقام عالأقل`;
  if (password.length > PASSWORD_MAX) return "كلمة السر طويلة كتير";
  return null;
};

// كلمة سر مؤقتة يبعتها الأدمن عالواتساب: 6 أرقام (crypto مش Math.random)
export const generateTempPassword = () => String(randomInt(100000, 1000000));

// توكن انطلع قبل آخر تغيير لكلمة السر ← ما عاد صالح (بيطلّع الأجهزة التانية)
// iat بالثواني، passwordChangedAt تاريخ. نفس الثانية = صالح (التوكن الجديد بينطلع فوراً بعد التغيير)
export const isTokenStale = (iat, passwordChangedAt) => {
  if (!passwordChangedAt || typeof iat !== "number") return false;
  return iat < Math.floor(new Date(passwordChangedAt).getTime() / 1000);
};
