import bcrypt from "bcryptjs";
import User from "../models/user.js";
import Product from "../models/product.js";
import { generateActivationCode } from "../utils/generateCode.js";
import { httpError } from "../utils/httpError.js";
import { buildDashboard, extendByDays, isAdmin, isOpenSubscription } from "../utils/account.js";
import { generateTempPassword } from "../utils/password.js";

// ── تفعيل / تجديد اشتراك مستخدم من الداشبورد ─────────────────────────────
export const activateSubscription = async (req, res, next) => {
  const { phoneNumber, months } = req.body;

  try {
    if (!phoneNumber || !months) {
      const error = new Error("رقم الهاتف وعدد الأشهر مطلوبين");
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      const error = new Error("المستخدم غير موجود");
      error.statusCode = 404;
      throw error;
    }

    const now = new Date();
    const isCurrentlyActive = user.subscriptionEnd && user.subscriptionEnd > now;

    // نقطة البداية: لو لسا نشط، مدد من تاريخ الانتهاء الحالي. لو منتهي/غير مفعل، ابدأ من الآن
    const baseDate = isCurrentlyActive ? user.subscriptionEnd : now;

    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + parseFloat(months));

    user.subscriptionEnd = newEnd;

    // لو الكود احترق (null) لأنو كان منتهي، ولّد كود جديد
    if (!user.activationCode) {
      user.activationCode = generateActivationCode();
    }
    // لو لسا نشط وعم يجدد، الكود بضل نفسه (ما منلمسه)

    await user.save();

    res.status(200).json({
      message: "تم تفعيل/تجديد الاشتراك بنجاح",
      phoneNumber: user.phoneNumber,
      subscriptionEnd: user.subscriptionEnd,
      activationCode: user.activationCode,
    });
  } catch (error) {
    next(error);
  }
};

// ── تجربة مجانية (أسبوع) ──────────────────────────────────────────────────
export const grantTrial = async (req, res, next) => {
  const { phoneNumber } = req.body;

  try {
    if (!phoneNumber) {
      const error = new Error("رقم الهاتف مطلوب");
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      const error = new Error("المستخدم غير موجود");
      error.statusCode = 404;
      throw error;
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    user.subscriptionEnd = trialEnd;

    if (!user.activationCode) {
      user.activationCode = generateActivationCode();
    }

    await user.save();

    res.status(200).json({
      message: "تم منح فترة تجربة لمدة أسبوع",
      phoneNumber: user.phoneNumber,
      subscriptionEnd: user.subscriptionEnd,
      activationCode: user.activationCode,
    });
  } catch (error) {
    next(error);
  }
};

// ── عرض كل المستخدمين (لعرضهم بالداشبورد) ────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select("phoneNumber activationCode subscriptionEnd isVerified createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

// ── الداشبورد بالتطبيق: الأرقام + الناطرين مع الكود + كل المشتركين ──────────
export const getDashboard = async (req, res, next) => {
  try {
    const [users, counts] = await Promise.all([
      User.find()
        .select("phoneNumber activationCode subscriptionEnd isVerified role linkedTo createdAt")
        .lean(),
      Product.aggregate([{ $group: { _id: "$userId", count: { $sum: 1 } } }]),
    ]);

    const productCounts = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.status(200).json(buildDashboard(users, productCounts));
  } catch (error) {
    next(error);
  }
};

// ── كلمة سر مؤقتة لمستخدم نسي كلمة سره (الأدمن بيبعتها عالواتساب) ──────
// بتطلّع كل أجهزته، وأول ما يفوت فيها التطبيق بيجبره يحط وحدة جديدة
export const resetPassword = async (req, res, next) => {
  const { phoneNumber } = req.body;

  try {
    if (!phoneNumber) throw httpError(422, "رقم الهاتف مطلوب");
    const user = await User.findOne({ phoneNumber });
    if (!user) throw httpError(404, "المستخدم غير موجود");
    // حساب المالك ما بينعمله reset من التطبيق (لو حدا وصل لتوكن الأدمن ما بيسكّر المالك برّا)
    if (isAdmin(user)) throw httpError(409, "هاد حساب المالك، غيّر كلمة سره من الإعدادات");

    const tempPassword = generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 12);
    user.mustChangePassword = true;
    user.passwordChangedAt = new Date();
    await user.save();

    res.status(200).json({ message: "انعملت كلمة سر مؤقتة", phoneNumber: user.phoneNumber, tempPassword });
  } catch (error) {
    next(error);
  }
};

// ── تفعيل / تجديد بالأيام (الافتراضي 30) ──────────────────────────────────
// إذا لسا فعّال بيمدّد من نهايته. إذا الكود محروق (منتهي) بيتولّد كود جديد ولازم ينبعتله
export const renewSubscription = async (req, res, next) => {
  const { phoneNumber } = req.body;
  const days = req.body.days == null ? 30 : Number(req.body.days);

  try {
    if (!phoneNumber) throw httpError(422, "رقم الهاتف مطلوب");
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      throw httpError(422, "عدد الأيام لازم يكون بين 1 و 366");
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) throw httpError(404, "المستخدم غير موجود");
    if (isOpenSubscription(user)) throw httpError(409, "هاد حساب المالك، اشتراكه مفتوح");

    user.subscriptionEnd = extendByDays(user.subscriptionEnd, days);
    if (!user.activationCode) user.activationCode = generateActivationCode();
    await user.save();

    res.status(200).json({
      message: "تم التجديد",
      phoneNumber: user.phoneNumber,
      subscriptionEnd: user.subscriptionEnd,
      activationCode: user.activationCode,
      // لسا ما دخّل الكود ← لازم ينبعتله
      needsCode: !user.isVerified,
    });
  } catch (error) {
    next(error);
  }
};
