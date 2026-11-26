import express from "express";
import {
  activateSubscription,
  grantTrial,
  getAllUsers,
  getDashboard,
  renewSubscription,
  resetPassword,
} from "../controllers/admin.js";
import { getErrors, resolveError } from "../controllers/errorLog.js";
import { checkAdmin } from "../middleware/checkAdmin.js";
import { normalizePhoneBody } from "../utils/phone.js";

const router = express.Router();

// كل admin routes محمية: x-admin-key (الـ test panel) أو توكن المالك (التطبيق)
router.use(checkAdmin);

// الأدمن فيه يكتب الرقم بأي صيغة (+963… أو 09…) وبيلاقي المستخدم
router.post("/activate-subscription", normalizePhoneBody, activateSubscription);
router.post("/grant-trial", normalizePhoneBody, grantTrial);
router.get("/users", getAllUsers);
router.get("/dashboard", getDashboard);
router.post("/renew", normalizePhoneBody, renewSubscription);
router.post("/reset-password", normalizePhoneBody, resetPassword);
router.get("/errors", getErrors);
router.post("/errors/resolve", resolveError);

export default router;
