// رقم الموبايل هو هوية الحساب ← لازم يتخزّن بصيغة وحدة: 09XXXXXXXX
// بيقبل: 0968935347 ، 968935347 ، +963968935347 ، 00963 968 935 347 ، ٠٩٦٨٩٣٥٣٤٧
// بيرجّع null إذا مو رقم موبايل سوري
export const toSyrianPhone = (value) => {
  let p = String(value ?? "")
    .replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf)) // أرقام عربية/فارسية ← لاتيني
    .replace(/[\s\-().]/g, "");

  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);

  if (p.startsWith("963")) p = "0" + p.slice(3);
  else if (/^9\d{8}$/.test(p)) p = "0" + p;

  return /^09\d{8}$/.test(p) ? p : null;
};

export const INVALID_PHONE_MSG = "رقم الموبايل لازم يكون سوري، متل 0912345678";

// middleware: بيوحّد req.body.phoneNumber، وإذا غلط ← 422
// (إذا الرقم ناقص منخلي الـ controller يرجّع رسالته)
export const normalizePhoneBody = (req, res, next) => {
  if (req.body?.phoneNumber == null || req.body.phoneNumber === "") return next();
  const phone = toSyrianPhone(req.body.phoneNumber);
  if (!phone) {
    const error = new Error(INVALID_PHONE_MSG);
    error.statusCode = 422;
    error.data = [{ field: "phoneNumber", message: INVALID_PHONE_MSG }];
    return next(error);
  }
  req.body.phoneNumber = phone;
  next();
};
