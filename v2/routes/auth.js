import express from "express";
import { activate, loginOrRegister, getMe } from "../controllers/auth.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { normalizePhoneBody } from "../utils/phone.js";

const router = express.Router();

// الرقم بيتوحّد لـ 09XXXXXXXX قبل ما يوصل للـ controller
router.post("/login", normalizePhoneBody, loginOrRegister);
router.post("/activate", normalizePhoneBody, activate);

// محمي: التطبيق بيستدعيه عند الفتح ليتأكد إنو الاشتراك لسا شغال
router.get("/me", checkSubscription, getMe);

export default router;
