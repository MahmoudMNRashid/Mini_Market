import { createHash } from "node:crypto";

// منطق صافي لسجل الأخطاء (بلا DB) مشان ينفحص بـ node --test
// الفكرة: نفس الخطأ (نفس المصدر + نفس الرسالة + نفس المكان بالكود) = سجل واحد مع عدّاد

export const LIMITS = {
  message: 300,
  stack: 4000,
  route: 200,
  meta: 60, // رقم النسخة، رقم التحديث، اسم الشاشة
  entries: 20, // أكتر شي بطلب واحد من التطبيق
  users: 20, // أكتر شي أرقام منحفظها بكل خطأ
  samples: 5, // آخر كم نسخة بالتفاصيل
};

export const TTL_DAYS = 30;
export const SOURCES = ["server", "app"];
export const APP_KINDS = ["crash", "js", "api"];

// JWT أو Bearer ما لازم يوصلوا للسجل بأي شكل
const JWT_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER_RE = /Bearer\s+[\w.-]+/gi;

export const redact = (text) =>
  String(text ?? "").replace(JWT_RE, "[token]").replace(BEARER_RE, "Bearer [token]");

export const clip = (text, max) => {
  const s = redact(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// الأرقام والـ ids بتتغيّر من مرة لمرة، فمنشيلها قبل ما نقارن
// "Cast to ObjectId failed for value 64f0…" و "…value 650a…" ← نفس الخطأ
export const normalizeMessage = (message) =>
  String(message ?? "")
    .toLowerCase()
    .replace(/[0-9a-f]{24}/g, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();

// أول سطر بالـ stack بيشاور على كودنا، بلا رقم السطر والعمود
// (رقم السطر بيتغيّر مع كل bundle أو deploy، وما بدنا كل OTA يعمل خطأ "جديد")
export const topFrame = (stack) => {
  const lines = String(stack ?? "").split("\n").slice(1);
  const frame = lines.find((l) => /\bat\b|@/.test(l) && !/node_modules|node:internal/.test(l)) ?? "";
  return frame
    .replace(/\([^)]*\)/g, "")
    .replace(/\S*:\d+(:\d+)?/g, "")
    .replace(/^\s*at\b/, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const fingerprint = ({ source, message, stack, route }) =>
  createHash("sha1")
    .update([source, normalizeMessage(message), topFrame(stack) || route || ""].join("|"))
    .digest("hex");

const str = (value, max) => (typeof value === "string" && value.trim() ? clip(value, max) : null);

// خطأ من التطبيق: منقبل بس الحقول المعروفة ومنقصّها. بيرجع null إذا ما فيه رسالة
export const sanitizeAppEntry = (raw, now = new Date()) => {
  if (!raw || typeof raw !== "object") return null;
  const message = str(raw.message, LIMITS.message);
  if (!message) return null;
  const at = new Date(raw.at);
  return {
    source: "app",
    kind: APP_KINDS.includes(raw.kind) ? raw.kind : "js",
    message,
    stack: str(raw.stack, LIMITS.stack),
    route: str(raw.route, LIMITS.route),
    appVersion: str(raw.appVersion, LIMITS.meta),
    updateId: str(raw.updateId, LIMITS.meta),
    // وقت الخطأ عالجهاز (ممكن يكون انبعت بعدين لما رجع النت). وقت غريب ← هلق
    at: Number.isNaN(at.getTime()) || at > now ? now : at,
  };
};

// خطأ 5xx بالسيرفر. الـ route بلا ids: "/api/v2/products/:id" مو "/api/v2/products/64f…"
export const serverEntry = (error, req, now = new Date()) => ({
  source: "server",
  kind: "5xx",
  message: clip(error?.message || String(error ?? "خطأ مجهول"), LIMITS.message),
  stack: error?.stack ? clip(error.stack, LIMITS.stack) : null,
  route: clip(`${req?.method ?? ""} ${(req?.baseUrl ?? "") + (req?.route?.path ?? req?.path ?? "")}`, LIMITS.route),
  appVersion: null,
  updateId: null,
  at: now,
});

// $literal: ولا نص من برّا بينفهم كـ "$field" جوّا الـ pipeline
const lit = (value) => ({ $literal: value });

// update بـ pipeline (upsert): بيزيد العدّاد، بيضيف الرقم (لحد 20) والنسخة (آخر 5)،
// وإذا كان معلّم "انحلّت" بيرجع يفتحه ومنعلّمه "رجع"
export const upsertOp = (entry, phone, now = new Date()) => {
  const sample = {
    at: entry.at,
    phone: phone ?? null,
    stack: entry.stack,
    appVersion: entry.appVersion,
    updateId: entry.updateId,
  };
  return {
    updateOne: {
      filter: { fingerprint: fingerprint(entry) },
      upsert: true,
      update: [
        {
          $set: {
            source: lit(entry.source),
            kind: lit(entry.kind),
            message: lit(entry.message),
            route: lit(entry.route),
            firstSeen: { $ifNull: ["$firstSeen", lit(entry.at)] },
            lastSeen: lit(now),
            count: { $add: [{ $ifNull: ["$count", 0] }, 1] },
            users: phone
              ? { $slice: [{ $setUnion: [{ $ifNull: ["$users", []] }, [lit(phone)]] }, LIMITS.users] }
              : { $ifNull: ["$users", []] },
            samples: { $slice: [{ $concatArrays: [[lit(sample)], { $ifNull: ["$samples", []] }] }, LIMITS.samples] },
            reopened: {
              $cond: [{ $ne: [{ $ifNull: ["$resolvedAt", null] }, null] }, true, { $ifNull: ["$reopened", false] }],
            },
            resolvedAt: null,
          },
        },
      ],
    },
  };
};

// شكل الأخطاء لتبويب الإدارة: المفتوحة أول، وجوّا كل قسم الأحدث أول
export const buildErrorsView = (logs) => {
  const errors = logs
    .map((l) => ({
      id: String(l._id),
      source: l.source,
      kind: l.kind,
      message: l.message,
      route: l.route ?? null,
      count: l.count ?? 0,
      users: l.users ?? [],
      firstSeen: l.firstSeen,
      lastSeen: l.lastSeen,
      resolved: Boolean(l.resolvedAt),
      reopened: Boolean(l.reopened) && !l.resolvedAt,
      samples: l.samples ?? [],
    }))
    .sort((a, b) => a.resolved - b.resolved || new Date(b.lastSeen) - new Date(a.lastSeen));
  return { open: errors.filter((e) => !e.resolved).length, errors };
};
