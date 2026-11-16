import express from "express";
import { activate, loginOrRegister } from "../controllers/auth.js";

const router = express.Router();

router.post("/login", loginOrRegister);
router.post("/activate", activate);

export default router;
