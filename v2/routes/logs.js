import express from "express";
import { postLogs } from "../controllers/errorLog.js";

const router = express.Router();

// أخطاء التطبيق (انهيار، JS، 5xx من السيرفر). مفتوح، والحماية بالقص وحدّ الحجم
router.post("/", postLogs);

export default router;
