import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { generateActivationCode } from "../utils/generateCode.js";
import { isSubscriptionActive, publicUser } from "../utils/account.js";
import { syncOwner } from "../utils/owner.js";
import { httpError } from "../utils/httpError.js";
import { newPasswordError } from "../utils/password.js";

const signToken = (user) =>
  jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "30d" });

export const loginOrRegister = async (req, res, next) => {
  const { phoneNumber, password } = req.body;

  try {
    if (!phoneNumber || !password) {
      const error = new Error("رقم الهاتف وكلمة المرور مطلوبين");
      error.statusCode = 422;
      throw error;
    }

    let user = await User.findOne({ phoneNumber });

    // ── المستخدم غير موجود → أنشئ حساب جديد ──────────────────────────────
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 12);
      const activationCode = generateActivationCode();

      user = new User({
        phoneNumber,
        password: hashedPassword,
        activationCode,
        subscriptionEnd: null,
      });

      await user.save();
      await syncOwner(user); // رقم المالك التاني بينربط من أول تسجيل

      return res.status(201).json({
        message: "تم إنشاء الحساب، تواصل معنا لتفعيل الاشتراك",
        requiresActivation: true,
        isNewAccount: true,
      });
    }

    // ── المستخدم موجود → تحقق من كلمة المرور ─────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error("رقم الهاتف أو كلمة المرور غير صحيحة");
      error.statusCode = 401;
      throw error;
    }

    await syncOwner(user);
    const isActive = isSubscriptionActive(user);

    // ── الاشتراك غير نشط ──────────────────────────────────────────────────
    if (!isActive) {
      // لو كان نشط سابقاً وانتهى الآن → احرق الكود وألغِ التحقق
      if (
        user.subscriptionEnd &&
        user.subscriptionEnd <= new Date() &&
        (user.activationCode || user.isVerified)
      ) {
        user.activationCode = null;
        user.isVerified = false;
        await user.save();
      }

      return res.status(403).json({
        message: "اشتراكك غير مفعل، يرجى التواصل معنا",
        requiresActivation: true,
        isNewAccount: false,
      });
    }

    // ── الاشتراك نشط بس لسا ما دخل الكود → لازم يفعّل ──────────────────────
    if (!user.isVerified) {
      return res.status(403).json({
        message: "أدخل كود التفعيل اللي وصلك على WhatsApp",
        requiresActivation: true,
        requiresCode: true,
        isNewAccount: false,
      });
    }

    // ── الاشتراك نشط ومتحقق → أصدر توكن ───────────────────────────────────
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "تم تسجيل الدخول",
      token,
      ...publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ── تفعيل الحساب بالكود (بعد التسجيل أو بعد انتهاء الاشتراك) ─────────────
export const activate = async (req, res, next) => {
  const { phoneNumber, password, code } = req.body;

  try {
    if (!phoneNumber || !password || !code) {
      const error = new Error("رقم الهاتف وكلمة المرور والكود مطلوبين");
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      const error = new Error("المستخدم غير موجود");
      error.statusCode = 404;
      throw error;
    }

    // بدون كلمة المرور، أي حدا بيعرف رقم مشترك فعّال بيقدر يجرب الأكواد لحد ما يطلع معه توكن
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error("رقم الهاتف أو كلمة المرور غير صحيحة");
      error.statusCode = 401;
      throw error;
    }

    if (!user.activationCode || user.activationCode !== code) {
      const error = new Error("الكود غير صحيح");
      error.statusCode = 401;
      throw error;
    }

    await syncOwner(user);
    const isActive = isSubscriptionActive(user);
    if (!isActive) {
      const error = new Error("اشتراكك غير مفعل بعد، يرجى التواصل معنا");
      error.statusCode = 403;
      throw error;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "تم التفعيل بنجاح",
      token,
      ...publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};


// ── تغيير كلمة السر (من الإعدادات، أو إجباري بعد كلمة سر مؤقتة) ─────────
// الأجهزة التانية بتطلع (passwordChangedAt)، وهالجهاز بياخد توكن جديد مشان يضل داخل
export const changePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  try {
    if (typeof oldPassword !== "string" || !oldPassword) throw httpError(422, "اكتب كلمة السر الحالية");
    const invalid = newPasswordError(newPassword);
    if (invalid) throw httpError(422, invalid);

    const user = req.user;
    // 400 مش 401: الـ 401 بيطلّع التطبيق من الحساب
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      throw httpError(400, "كلمة السر الحالية غلط");
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw httpError(422, "الجديدة نفس القديمة، اختار وحدة تانية");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    res.status(200).json({ message: "تغيّرت كلمة السر", token: signToken(user), ...publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// ── بيانات المستخدم الحالي (محمي بـ checkSubscription) ─────────────────────
export const getMe = (req, res) => {
  res.status(200).json(publicUser(req.user));
};
