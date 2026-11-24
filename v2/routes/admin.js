import express from "express";
import {
  activateSubscription,
  grantTrial,
  getAllUsers,
} from "../controllers/admin.js";
import { checkAdmin } from "../middleware/checkAdmin.js";
import { normalizePhoneBody } from "../utils/phone.js";

const router = express.Router();

// كل admin routes محمية بـ x-admin-key
router.use(checkAdmin);

// الأدمن فيه يكتب الرقم بأي صيغة (+963… أو 09…) وبيلاقي المستخدم
router.post("/activate-subscription", normalizePhoneBody, activateSubscription);
router.post("/grant-trial", normalizePhoneBody, grantTrial);
router.get("/users", getAllUsers);

export default router;
