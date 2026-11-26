// المنتجات اللي سعرها ما تغيّر من زمان (scripts/delete-stale.js)
const DAY = 24 * 60 * 60 * 1000;

// آخر يوم مقبول: أقدم من هيك ← قديم
export const staleCutoff = (days, now = new Date()) => {
  if (!Number.isInteger(days) || days < 1) throw new Error("عدد الأيام لازم يكون رقم صحيح أكبر من 0");
  return new Date(now.getTime() - days * DAY);
};

// latestWholeprice أقدم من الحد بالضبط ← قديم (اللي ما إلو تاريخ ما بينلمس)
export const isStale = (product, cutoff) => {
  const at = new Date(product.latestWholeprice);
  return !Number.isNaN(at.getTime()) && at < cutoff;
};

// ملخص للتقرير: كم واحد، أقدم وأحدث تاريخ، وتوزيع حسب السنة
export const summarizeStale = (products) => {
  const dates = products.map((p) => new Date(p.latestWholeprice)).sort((a, b) => a - b);
  const byYear = {};
  for (const d of dates) byYear[d.getUTCFullYear()] = (byYear[d.getUTCFullYear()] ?? 0) + 1;
  return {
    count: products.length,
    oldest: dates[0] ?? null,
    newest: dates.at(-1) ?? null,
    byYear,
  };
};
