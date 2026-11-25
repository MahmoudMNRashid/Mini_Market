import mongoose from "mongoose";
import ErrorLog from "../models/errorLog.js";
import { userFromToken } from "../middleware/checkSubscription.js";
import { httpError } from "../utils/httpError.js";
import { buildErrorsView, LIMITS, sanitizeAppEntry, serverEntry, upsertOp } from "../utils/errorLog.js";

// بيكتب كذا خطأ بطلب واحد. ما بيرمي أبداً: سجل الأخطاء ما لازم يكسر شي
export const recordErrors = async (entries, phone) => {
  if (!entries.length) return;
  try {
    const now = new Date();
    await ErrorLog.collection.bulkWrite(
      entries.map((e) => upsertOp(e, phone, now)),
      { ordered: false }
    );
  } catch (err) {
    console.error("errorLog: ما قدرنا نسجّل", err?.message);
  }
};

// من الـ error handler بالـ index.js، بس للـ 5xx
export const recordServerError = (error, req) =>
  recordErrors([serverEntry(error, req)], req.user?.phoneNumber ?? null);

// ── POST /api/v2/logs (من التطبيق) ───────────────────────────────────────
// التوكن اختياري: إذا التطبيق انهار بشاشة الدخول ما في توكن، وبدنا الخطأ يوصل
export const postLogs = async (req, res, next) => {
  try {
    const raw = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const entries = raw.slice(0, LIMITS.entries).map((e) => sanitizeAppEntry(e)).filter(Boolean);

    let phone = null;
    if (req.get("Authorization")) {
      try {
        phone = (await userFromToken(req)).phoneNumber;
      } catch {
        // توكن منتهي أو غلط: منسجّل بلا رقم
      }
    }

    await recordErrors(entries, phone);
    res.status(200).json({ saved: entries.length });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v2/admin/errors ─────────────────────────────────────────────
export const getErrors = async (req, res, next) => {
  try {
    const logs = await ErrorLog.find().sort({ lastSeen: -1 }).limit(100).lean();
    res.status(200).json(buildErrorsView(logs));
  } catch (error) {
    next(error);
  }
};

// ── POST /api/v2/admin/errors/resolve { id } ─────────────────────────────
export const resolveError = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!mongoose.isValidObjectId(id)) throw httpError(422, "id الخطأ مو صحيح");
    const log = await ErrorLog.findByIdAndUpdate(
      id,
      { resolvedAt: new Date(), reopened: false },
      { new: true }
    );
    if (!log) throw httpError(404, "الخطأ مو موجود (يمكن انمحى بعد 30 يوم)");
    res.status(200).json({ message: "انعلّم انحلّت", id });
  } catch (error) {
    next(error);
  }
};
