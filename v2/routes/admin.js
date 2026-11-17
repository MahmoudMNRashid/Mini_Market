import express from "express";
import {
  activateSubscription,
  grantTrial,
  getAllUsers,
} from "../controllers/admin.js";
import { checkAdmin } from "../middleware/checkAdmin.js";

const router = express.Router();

// كل admin routes محمية بـ x-admin-key
router.use(checkAdmin);

router.post("/activate-subscription", activateSubscription);
router.post("/grant-trial", grantTrial);
router.get("/users", getAllUsers);

export default router;
