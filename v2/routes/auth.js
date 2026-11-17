import express from "express";
import { activate, loginOrRegister, getMe } from "../controllers/auth.js";
import { checkSubscription } from "../middleware/checkSubscription.js";

const router = express.Router();

router.post("/login", loginOrRegister);
router.post("/activate", activate);

// محمي: التطبيق بيستدعيه عند الفتح ليتأكد إنو الاشتراك لسا شغال
router.get("/me", checkSubscription, getMe);

export default router;
