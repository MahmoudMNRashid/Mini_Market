import { validationResult } from "express-validator";
import { httpError } from "../utils/httpError.js";

// بيرجع 422 مع تفاصيل الحقول الغلط إذا فشل express-validator
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      httpError(
        422,
        errors.array()[0].msg,
        errors.array().map((e) => ({ field: e.path, message: e.msg }))
      )
    );
  }
  next();
};
