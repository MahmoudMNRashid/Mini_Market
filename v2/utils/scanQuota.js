// حد يومي لقراءة الفواتير لكل حساب (مفتاح Gemini المجاني مشترك بين كل المحلات)

export const DAILY_SCAN_LIMIT = () => Number(process.env.INVOICE_DAILY_LIMIT) || 30;

// اليوم بتوقيت دمشق (مو UTC) مشان العداد يتصفّر نص الليل عندنا
export const damascusDay = (date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Damascus" }); // 2026-11-25

// منطق صافي: بيرجع إذا مسموح + العداد الجديد
// current: { day, count } أو null
export const nextQuota = (current, today, limit) => {
  const count = current?.day === today ? current.count : 0;
  if (count >= limit) return { allowed: false, quota: { day: today, count }, left: 0 };
  return { allowed: true, quota: { day: today, count: count + 1 }, left: limit - count - 1 };
};
