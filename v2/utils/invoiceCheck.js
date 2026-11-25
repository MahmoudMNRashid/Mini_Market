// فحوصات حسابية على نتيجة قراءة الفاتورة (منطق صافي بدون أي استدعاء خارجي)
// الفكرة: الأرقام بتفضح غلط القراءة، إذا الكمية × السعر ≠ الإجمالي أو مجموع السطور ≠ مجموع الفاتورة

// فرق صغير مسموح بسبب التدوير (مثلاً 15 × 46.97 = 704.55 بس الفاتورة كاتبة 704.48)
const TOLERANCE = 0.01; // 1%

const near = (a, b) => {
  if (a == null || b == null) return null; // ما فينا نحكم
  const diff = Math.abs(a - b);
  return diff <= Math.max(Math.abs(b) * TOLERANCE, 0.05);
};

// كل سطر: هل الكمية × السعر قريبة من الإجمالي؟
export const checkLine = (line) => {
  const { quantity, packagePrice, total } = line;
  if (quantity == null || packagePrice == null) return null;
  return near(quantity * packagePrice, total);
};

// الفاتورة كلها: مجموع السطور مقابل المجموع المكتوب
export const checkInvoice = (result) => {
  const lines = result.lines ?? [];
  const linesSum = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  return {
    linesSum: Math.round(linesSum * 100) / 100,
    invoiceTotal: result.invoiceTotal ?? null,
    totalMatches: near(linesSum, result.invoiceTotal ?? null),
    badLines: lines
      .map((l, i) => (checkLine(l) === false ? i : null))
      .filter((i) => i != null),
  };
};
