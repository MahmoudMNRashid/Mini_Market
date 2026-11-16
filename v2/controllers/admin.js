import User from "../models/user.js";
import { generateActivationCode } from "../utils/generateCode.js";

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
      .select("phoneNumber activationCode subscriptionEnd createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};