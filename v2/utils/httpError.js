// اختصار لإنشاء error مع statusCode (بيلقطه الـ error handler بالـ index.js)
export const httpError = (statusCode, message, data) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (data) error.data = data;
  return error;
};

// MongoDB duplicate key (unique index)
export const isDuplicateKey = (err) => err && err.code === 11000;

// منع أحرف الـ regex الخاصة من إنها تكسر البحث
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
