// نقل كل منتجات v1 لحساب المالك (OWNER_PHONE) بـ v2
//
//   node --env-file=.env scripts/migrate-v1.js          ← تجربة بس (ما بيكتب شي)
//   node --env-file=.env scripts/migrate-v1.js --apply  ← نقل حقيقي
//
// - منتجات v1 ما بتنلمس (v1 لسا شغال للنسخ القديمة)
// - بينعاد بأمان: الاسم الموجود عند المالك بينتجاوز
// - مكرر بالاسم بـ v1 ← الأحدث سعراً
// - التقرير الكامل بـ scripts/migrate-v1-report.json
import fs from "fs";
import dns from "dns";
import mongoose from "mongoose";
import ProductV1 from "../models/product.js";
import ProductV2 from "../v2/models/product.js";
import UserV2 from "../v2/models/user.js";
import { planMigration } from "../v2/utils/migrateV1.js";

const APPLY = process.argv.includes("--apply");
const REPORT = new URL("./migrate-v1-report.json", import.meta.url);

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

async function main() {
  const phone = process.env.OWNER_PHONE;
  if (!phone) throw new Error("OWNER_PHONE مو موجود بالـ .env");

  await connectDb();
  const owner = await UserV2.findOne({ phoneNumber: phone }).lean();
  if (!owner) throw new Error(`ما في حساب v2 للرقم ${phone}`);

  const v1 = await ProductV1.find().lean();
  const existing = await ProductV2.find({ userId: owner._id }).distinct("productName");
  const plan = planMigration(v1, owner._id, existing);

  const currencies = plan.toInsert.reduce((m, d) => ((m[d.currency] = (m[d.currency] ?? 0) + 1), m), {});
  console.log(APPLY ? "── نقل حقيقي ──" : "── تجربة (ما في كتابة) ──");
  console.log(`المالك: ${phone}  (منتجاته بـ v2 هلق: ${existing.length})`);
  console.log(`منتجات v1: ${v1.length}`);
  console.log(`  رح ينضاف: ${plan.toInsert.length}  ${JSON.stringify(currencies)}`);
  console.log(`  مكرر بالاسم (انترك منه): ${plan.duplicates.reduce((n, d) => n + d.dropped.length, 0)} بـ ${plan.duplicates.length} اسم`);
  console.log(`  غلط (ما رح ينضاف): ${plan.invalid.length}`);
  console.log(`  موجود أصلاً عند المالك: ${plan.alreadyThere.length}`);
  console.log("أمثلة:");
  for (const d of plan.toInsert.slice(0, 5)) {
    console.log(`  - ${d.productName} | ${d.wholesalePackagePrice} ${d.currency} / ${d.unitsPerPackage} = ${d.wholesaleUnitPrice}`);
  }

  let inserted = 0;
  if (APPLY && plan.toInsert.length) {
    // دفعات، ordered:false ← لو منتج فشل (مثلاً اسم انضاف بنفس اللحظة) الباقي بيكمل
    for (let i = 0; i < plan.toInsert.length; i += 500) {
      try {
        const res = await ProductV2.insertMany(plan.toInsert.slice(i, i + 500), { ordered: false });
        inserted += res.length;
      } catch (e) {
        inserted += e.insertedDocs?.length ?? 0;
        console.error("  فشل قسم من الدفعة:", e.writeErrors?.length ?? e.message);
      }
    }
    console.log(`انضاف فعلياً: ${inserted}`);
  }

  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        at: new Date(),
        apply: APPLY,
        v1Count: v1.length,
        toInsert: plan.toInsert.length,
        inserted,
        duplicates: plan.duplicates,
        invalid: plan.invalid,
        alreadyThere: plan.alreadyThere,
      },
      null,
      2,
    ),
  );
  console.log("التقرير: scripts/migrate-v1-report.json");
}

main()
  .catch((e) => {
    console.error("فشل:", e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
