// قراءة صورة فاتورة بنموذج Gemini ورجّع السطور كـ JSON مرتب
// هون منستخرج القيم متل ما هي مكتوبة بالفاتورة (خام)، والتحويل لحقول المنتج بيصير بخطوة بعدين
import { GoogleGenAI } from "@google/genai";
import { httpError } from "./httpError.js";

// دالة مو ثابت: بالـ index.js الـ imports بتتنفذ قبل dotenv.config()
// 3.6-flash هو اللي نجح بالتجربة (3.8 و 4-hydrogen كانوا مضغوطين 503 عالخطة المجانية)
export const defaultModel = () => process.env.GEMINI_MODEL || "gemini-3.6-flash";

// الـ client بينعمل أول مرة بس (lazy) لأنو dotenv لازم يكون اشتغل قبل
let client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw httpError(503, "قراءة الفواتير مو مفعّلة على السيرفر (GEMINI_API_KEY ناقص)");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

// شكل الجواب المطلوب من النموذج (JSON Schema)
const num = { anyOf: [{ type: "number" }, { type: "null" }] };
const str = { anyOf: [{ type: "string" }, { type: "null" }] };

export const INVOICE_SCHEMA = {
  type: "object",
  properties: {
    supplier: { ...str, description: "Supplier / company name at the top of the invoice" },
    date: { ...str, description: "Invoice date as written" },
    currency: {
      type: "string",
      enum: ["USD", "SYP_NEW", "SYP_OLD", "UNKNOWN"],
      description: "Currency of the prices on this invoice",
    },
    invoiceTotal: { ...num, description: "Sum of the product lines as written on the invoice (before discounts/balances)" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Clean product name: brand/type + weight or volume, WITHOUT the pack-count notation (e.g. شوكولا سنيكرز 50غ)",
          },
          quantity: num,
          unit: { ...str, description: "Unit word as written: علبة، طرد، قطعة، كيس، تنكة، كرتونة..." },
          packagePrice: { ...num, description: "Price of ONE invoice unit (one علبة/طرد/قطعة...) as written" },
          total: { ...num, description: "Line total as written" },
          unitsPerPackage: {
            ...num,
            description: "How many single pieces are inside ONE invoice unit, taken from the pack notation; 1 if the unit is قطعة; null if unknown",
          },
          confidence: { type: "string", enum: ["high", "medium", "low"], description: "How sure you are about the NAME" },
        },
        required: ["name", "quantity", "unit", "packagePrice", "total", "unitsPerPackage", "confidence"],
      },
    },
  },
  required: ["supplier", "date", "currency", "invoiceTotal", "lines"],
};

const PROMPT = `You are reading a photo of a wholesale invoice from a supplier to a small grocery shop in Syria.
Invoices may be printed, thermal receipts, or handwritten, in Arabic (Levantine), possibly with Eastern Arabic digits (٠١٢٣٤٥٦٧٨٩).

Extract every PRODUCT line. Rules:
- Ignore non-product rows: totals, discounts (الحسم), payments (الدفعة), customer balance (رصيد), item counts, footers, and handwritten side notes (e.g. "دفعت ٣ ملايين", "ترجيع ...").
- Ignore extra columns such as المستهلك, tax or gift (هدية) columns.
- Convert all numbers to Western digits. Remove thousands separators (1,440 -> 1440).

Name:
- Read the brand and product words exactly as written (Arabic). Do not translate or "fix" brand names.
- Keep the weight/volume of a single piece (50غ، 1.5 لتر، 1كغ).
- REMOVE the pack-count notation and its separators from the name; it goes into unitsPerPackage instead.
  "شوكولا كيندر 4 اصابع *20" -> name "شوكولا كيندر 4 اصابع", unitsPerPackage 20
  "شوكولا سنيكرز 50غ *24" -> name "شوكولا سنيكرز 50غ", unitsPerPackage 24
  "بسكويت ماريو شوكولا /6*24*30غ/" -> name "بسكويت ماريو شوكولا 30غ", unitsPerPackage 24
  Note: "4 اصابع" is part of the product (4 fingers), not a pack count.

unitsPerPackage:
- Pack notation is usually CARTON*PIECES*WEIGHT: in "6*24*30غ" sold per علبة, the علبة has 24 pieces (6 is boxes per carton). In "50غ*24" or "*24" the unit has 24 pieces.
- If the unit is قطعة, unitsPerPackage is 1 and packagePrice is the price of that one piece.
- Use null when unsure.

Currency (prices are often written without any currency sign):
- "USD" ONLY if the invoice explicitly shows dollars: $, دولار, or "العملة: $".
- "SYP_NEW" if it says ليرة سورية جديدة, or there is no dollar sign and prices of single grocery items are in the tens / hundreds / low thousands (the new Syrian pound dropped two zeros).
- "SYP_OLD" if line amounts are in the hundreds of thousands or millions.
- Otherwise "UNKNOWN". Do not guess; the user will choose.

Handwriting:
- If a handwritten line is partly illegible, give your best reading of the name and set confidence to "low". Never invent lines that are not there.
- Handwritten invoices often have only a description, a quantity and a line total; leave packagePrice null if it is not written.`;

// buffer: صورة الفاتورة، mimeType: image/jpeg | image/png | image/webp
export const scanInvoice = async ({ buffer, mimeType, model = defaultModel(), timeoutMs = 0 }) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: buffer.toString("base64") } },
          { text: PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: INVOICE_SCHEMA,
      // الـ SDK كان يعيد لحاله دقايق لما يكون في ضغط ← منلغي إعادته ومنعمل إعادة نحنا بنموذج تاني
      httpOptions: { retryOptions: { attempts: 1 } },
      ...(timeoutMs ? { abortSignal: AbortSignal.timeout(timeoutMs) } : {}),
    },
  });

  const text = response.text;
  if (!text) throw httpError(502, "ما قدرنا نقرا الفاتورة، جرّب صورة أوضح");

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw httpError(502, "ما قدرنا نقرا الفاتورة، جرّب مرة تانية", { raw: text.slice(0, 500) });
  }
  if (!Array.isArray(result.lines)) result.lines = [];
  return { result, usage: response.usageMetadata ?? null, model };
};

// ── إعادة المحاولة بنماذج بديلة ───────────────────────────────────────────
// الخطة المجانية بتعطي 503 (ضغط) كتير ← منجرّب النموذج التاني بدل ما نوقف
const fallbackModels = () =>
  (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.7-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

// أخطاء بتستاهل نجرّب نموذج تاني: ضغط، حصة، خطأ عندهم، مهلة، نموذج مو موجود
const isRetryable = (err) => {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  const status = err?.status ?? err?.statusCode;
  return [404, 429, 500, 502, 503, 504].includes(status);
};

const isBadKey = (err) => /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(err?.message ?? "");

// deadlineMs: الوقت الكلي المسموح (Vercel بيقطع الطلب بعد مدة)
export const scanInvoiceWithFallback = async ({ buffer, mimeType, deadlineMs = Number(process.env.SCAN_DEADLINE_MS) || 55_000 }) => {
  const started = Date.now();
  const models = [...new Set([defaultModel(), ...fallbackModels()])];
  let lastError = null;

  for (const model of models) {
    const left = deadlineMs - (Date.now() - started);
    if (left < 8_000) break; // ما في وقت كافي لمحاولة جديدة
    try {
      return await scanInvoice({ buffer, mimeType, model, timeoutMs: Math.min(left, 35_000) });
    } catch (err) {
      if (err.statusCode) throw err; // httpError من عنا (جواب مو مفهوم…) ← ما في داعي نعيد
      if (isBadKey(err)) throw httpError(503, "قراءة الفواتير مو مفعّلة على السيرفر، خبّرنا");
      if (!isRetryable(err)) throw httpError(502, "ما قدرنا نقرا الفاتورة، جرّب صورة تانية");
      console.warn(`invoice scan: ${model} failed (${err.status ?? err.name}), trying next`);
      lastError = err;
    }
  }

  if (lastError?.status === 429) throw httpError(429, "خلصت حصة قراءة الفواتير لليوم، جرّب بكرا");
  throw httpError(503, "خدمة قراءة الفواتير مضغوطة هلق، جرّب بعد شوي");
};
