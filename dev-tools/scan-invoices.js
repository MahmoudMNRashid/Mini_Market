// تجربة قراءة الفواتير على صور حقيقية (من الطرفية، مو من السيرفر)
// الاستعمال (من مجلد backend):
//   node dev-tools/scan-invoices.js                      ← كل الصور بـ invoice-samples بالنموذج الافتراضي
//   node dev-tools/scan-invoices.js --model=gemini-3.5-flash-lite
//   node dev-tools/scan-invoices.js 2.png 6.png          ← صور محددة بس
// النتائج بتنحفظ بـ dev-tools/invoice-samples/results/<model>.json
import "dotenv/config";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanInvoice, defaultModel } from "../v2/utils/invoiceScan.js";
import { checkInvoice, checkLine } from "../v2/utils/invoiceCheck.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, "invoice-samples");

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const args = process.argv.slice(2);
const model = args.find((a) => a.startsWith("--model="))?.slice(8) || defaultModel();
let files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  files = (await readdir(samplesDir)).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
}

const mark = (ok) => (ok === true ? "✓" : ok === false ? "✗" : "-");

console.log(`\nالنموذج: ${model} — عدد الصور: ${files.length}\n`);
const all = [];
let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const buffer = await readFile(path.join(samplesDir, file));
  const mimeType = MIME[path.extname(file).toLowerCase()];
  const started = Date.now();
  try {
    const { result, usage } = await scanInvoice({ buffer, mimeType, model });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const check = checkInvoice(result);
    totalIn += usage?.promptTokenCount ?? 0;
    totalOut += (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);

    console.log(`━━━ ${file} — ${result.supplier ?? "؟"} — ${result.currency} — ${seconds}s`);
    console.table(
      result.lines.map((l) => ({
        الاسم: l.name,
        الكمية: l.quantity,
        الوحدة: l.unit,
        السعر: l.packagePrice,
        الإجمالي: l.total,
        "قطع/وحدة": l.unitsPerPackage,
        ثقة: l.confidence,
        حساب: mark(checkLine(l)),
      }))
    );
    console.log(
      `مجموع السطور ${check.linesSum} — مجموع الفاتورة ${check.invoiceTotal ?? "؟"} ${mark(check.totalMatches)}\n`
    );
    all.push({ file, seconds: Number(seconds), usage, check, result });
  } catch (err) {
    console.log(`━━━ ${file} — فشل: ${err.message}\n`);
    all.push({ file, error: err.message, data: err.data });
  }
}

console.log(`التوكنز: دخل ${totalIn} — طلع ${totalOut}`);

const outDir = path.join(samplesDir, "results");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, `${model}.json`);
await writeFile(outFile, JSON.stringify(all, null, 2));
console.log(`النتائج انحفظت: ${path.relative(process.cwd(), outFile)}`);
