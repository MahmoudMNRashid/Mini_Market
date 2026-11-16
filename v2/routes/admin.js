import express from "express";
import {
  activateSubscription,
  grantTrial,
  getAllUsers,
} from "../controllers/admin.js";

const router = express.Router();

// ⚠️ لاحقاً لازم نحمي هالـ routes بـ admin auth خاص فيك انت بس
router.post("/activate-subscription", activateSubscription);
router.post("/grant-trial", grantTrial);
router.get("/users", getAllUsers);

export default router;
