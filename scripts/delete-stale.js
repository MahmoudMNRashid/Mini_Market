// حذف منتجات المالك (OWNER_PHONE) اللي سعرها ما تغيّر من أكتر من N يوم (افتراضي 400)
//
//   node --env-file=.env scripts/delete-stale.js                ← تجربة بس (ما بيمحي شي)
//   node --env-file=.env scripts/delete-stale.js --apply        ← حذف نهائي
//   node --env-file=.env scripts/delete-stale.js --days=365     ← حد تاني
//
// - "ما تغيّر" = latestWholeprice أقدم من الحد
// - مع المنتج بينمحى سجل أسعاره وأسماء الفواتير المحفوظة إلو (invoice aliases)
// - قبل الحذف بينحفظ كلشي بـ scripts/delete-stale-backup-*.json (للرجعة إذا لزم)
// - منتجات v1 ما بتنلمس
import fs from "fs";
import dns from "dns";
import mongoose from "mongoose";
import ProductV2 from "../v2/models/product.js";
import UserV2 from "../v2/models/user.js";
import PriceHistory from "../v2/models/priceHistory.js";
import InvoiceAlias from "../v2/models/invoiceAlias.js";
import { staleCutoff, summarizeStale } from "../v2/utils/staleProducts.js";

const APPLY = process.argv.includes("--apply");
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 400);

async function connectDb() {
  // نفس اتصال util/connect.js بدون ما نشغّل السيرفر
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  const hosts = [
    "ac-d8kj711-shard-00-00.qdwwmja.mongodb.net:27017",
    "ac-d8kj711-shard-00-01.qdwwmja.mongodb.net:27017",
    "ac-d8kj711-shard-00-02.qdwwmja.mongodb.net:27017",
  ].join(",");
  const { MONGO_CONNECT_USER_NAME: u, MONGO_CONNECT_PASSWORD: p, MONGO_CONNECT_DB: db } = process.env;
  await mongoose.connect(
    `mongodb://${u}:${p}@${hosts}/${db}?tls=true&replicaSet=atlas-6juh67-shard-0&authSource=admin`,
  );
}

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

async function main() {
  const phone = process.env.OWNER_PHONE;
  if (!phone) throw new Error("OWNER_PHONE مو موجود بالـ .env");
  const cutoff = staleCutoff(DAYS);

  await connectDb();
  const owner = await UserV2.findOne({ phoneNumber: phone }).lean();
  if (!owner) throw new Error(`ما في حساب v2 للرقم ${phone}`);

  const userId = owner._id;
  const total = await ProductV2.countDocuments({ userId });
  const stale = await ProductV2.find({ userId, latestWholeprice: { $lt: cutoff } })
    .sort({ latestWholeprice: 1 })
    .lean();
  const ids = stale.map((p) => p._id);
  const [history, aliases] = await Promise.all([
    PriceHistory.find({ userId, productId: { $in: ids } }).lean(),
    InvoiceAlias.find({ userId, productId: { $in: ids } }).lean(),
  ]);
  const s = summarizeStale(stale);

  console.log(APPLY ? "── حذف نهائي ──" : "── تجربة (ما في حذف) ──");
  console.log(`المالك: ${phone}  ·  منتجاته: ${total}`);
  console.log(`الحد: سعر ما تغيّر من ${DAYS} يوم ← قبل ${day(cutoff)}`);
  console.log(`  رح ينمحى: ${s.count}  ·  بيضل: ${total - s.count}`);
  if (s.count) {
    console.log(`  أقدم سعر: ${day(s.oldest)}  ·  أحدث واحد بينهن: ${day(s.newest)}`);
    console.log(`  حسب السنة: ${JSON.stringify(s.byYear)}`);
    console.log(`  مع: ${history.length} سطر سجل أسعار، ${aliases.length} اسم فاتورة محفوظ`);
    console.log(`  منتجات إلها فئة: ${stale.filter((p) => p.categoryId).length}`);
    console.log("أمثلة (الأقدم):");
    for (const p of stale.slice(0, 8)) console.log(`  - ${day(p.latestWholeprice)}  ${p.productName}`);
    console.log("أمثلة (الأحدث بين اللي رح ينمحوا):");
    for (const p of stale.slice(-5)) console.log(`  - ${day(p.latestWholeprice)}  ${p.productName}`);
  }

  if (!APPLY || !s.count) return;

  // نسخة احتياطية قبل أي حذف
  const backup = new URL(`./delete-stale-backup-${Date.now()}.json`, import.meta.url);
  fs.writeFileSync(backup, JSON.stringify({ at: new Date(), phone, days: DAYS, cutoff, products: stale, history, aliases }, null, 2));
  console.log(`النسخة الاحتياطية: scripts/${backup.pathname.split("/").pop()}`);

  const del = await ProductV2.deleteMany({ userId, _id: { $in: ids } });
  const delH = await PriceHistory.deleteMany({ userId, productId: { $in: ids } });
  const delA = await InvoiceAlias.deleteMany({ userId, productId: { $in: ids } });
  console.log(`انمحى: ${del.deletedCount} منتج، ${delH.deletedCount} سطر سجل، ${delA.deletedCount} اسم فاتورة`);
  console.log(`بقي عند المالك: ${await ProductV2.countDocuments({ userId })}`);
}

main()
  .catch((e) => {
    console.error("فشل:", e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
