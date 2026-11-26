// إدخال فئات بالجملة (صفحة dev-tools/categories.html): تحليل النص + مقارنة مع الموجود
// منطق صافي بلا DB ولا DOM ← بيشتغل بالمتصفح وبـ node --test
import { GROUPS, DIACRITICS } from "./search.js";

export const MAX_NAME = 60; // نفس حد validator الفئات

// اسم موحّد للمقارنة: بلا تشكيل، أشكال الحروف ← شكل واحد، "ال" بأول الكلمة اختيارية
// "الحبوب" = "حبوب" ، "مشروبات غازيه" = "مشروبات غازية"
export const normalizeName = (name) =>
  String(name ?? "")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      let s = [...w].map((ch) => GROUPS.find((g) => g.includes(ch))?.[0] ?? ch).join("");
      if (s.length >= 4 && s.startsWith("ال")) s = s.slice(2);
      return s;
    })
    .join(" ");

const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isHeader = (cells) => ["اب", "فئه اب"].includes(normalizeName(cells[0])) && normalizeName(cells[1] ?? "").includes("ابن");

// ── تحليل النص ──────────────────────────────────────────────────────────────
// شكلين بينفعوا (وبيتخالطوا):
//   1) سطر بأوله = أب ، سطر فيه مسافة/tab بأوله = ابن للأب اللي فوقه
//   2) ملصوق من إكسل: عمودين (أب ⇥ ابن)، خانة الأب الفاضية = نفس الأب اللي فوق
// # بأول السطر = تعليق. الأسطر الفاضية بتنتجاهل.
// بيرجع { parents: [{ name, line, children: [{ name, line }] }], errors: [{ line, message }], notes: [...] }
export const parseCategoryText = (text) => {
  const parents = [];
  const errors = [];
  const notes = []; // مكرر بالنص نفسه (مش غلط، بس بننبّه)
  let current = null;

  const addParent = (name, line) => {
    const key = normalizeName(name);
    const found = parents.find((p) => normalizeName(p.name) === key);
    if (found) {
      notes.push({ line, message: `«${name}» مكررة فوق (سطر ${found.line})، الأبناء بينضمّوا لإلها` });
      return found;
    }
    const p = { name, line, children: [] };
    parents.push(p);
    return p;
  };

  const addChild = (parent, name, line) => {
    const key = normalizeName(name);
    const found = parent.children.find((c) => normalizeName(c.name) === key);
    if (found) return notes.push({ line, message: `«${name}» مكررة تحت «${parent.name}» (سطر ${found.line})` });
    parent.children.push({ name, line });
  };

  const tooLong = (name, line) => {
    if (name.length <= MAX_NAME) return false;
    errors.push({ line, message: `«${name.slice(0, 20)}…» أطول من ${MAX_NAME} حرف` });
    return true;
  };

  String(text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || raw.trim().startsWith("#")) return;

    const cells = raw.includes("\t") ? raw.split("\t") : [raw];
    if (isHeader(cells)) return;

    // مسافة بأول السطر أو خانة أب فاضية ← ابن
    const indented = raw.includes("\t") ? !cleanName(cells[0]) : /^\s/.test(raw);
    const filled = cells.map(cleanName).filter(Boolean);

    if (filled.length > 2) {
      return errors.push({ line, message: "أكتر من عمودين، المستويات اتنين بس (أب ← ابن)" });
    }

    if (indented) {
      if (filled.length !== 1) return errors.push({ line, message: "السطر فيه أكتر من فئة ابن" });
      if (!current) return errors.push({ line, message: `«${filled[0]}» ابن بلا أب فوقه` });
      if (!tooLong(filled[0], line)) addChild(current, filled[0], line);
      return;
    }

    if (tooLong(filled[0], line)) return (current = null);
    current = addParent(filled[0], line);
    if (filled[1] && !tooLong(filled[1], line)) addChild(current, filled[1], line);
  });

  return { parents, errors, notes };
};

// ── مقارنة مع الفئات الموجودة ───────────────────────────────────────────────
// existing: شجرة GET /categories ← [{ _id, name, children: [{ _id, name }] }]
// كل فئة بتطلع بـ status:
//   new      ← رح تنضاف
//   exists   ← موجودة بنفس المكان (بالاسم الموحّد) ← بتنتجاوز
//   conflict ← الاسم موجود بس بمستوى تاني (أب ↔ ابن) ← ما بتنضاف، صلّحها بإيدك
// بيرجع { parents: [{ name, line, status, id, existingName, note, children: [{ name, line, status, id, existingName, note }] }], counts }
export const planCategoryImport = (parsed, existing = []) => {
  const byKey = (list) => new Map(list.map((c) => [normalizeName(c.name), c]));
  const existingParents = byKey(existing);
  const existingChildren = new Map(); // اسم ابن ← أسماء الآباء اللي هو تحتهن
  for (const p of existing) {
    for (const c of p.children ?? []) {
      const k = normalizeName(c.name);
      existingChildren.set(k, [...(existingChildren.get(k) ?? []), p.name]);
    }
  }

  const counts = { new: 0, exists: 0, conflict: 0 };
  const parents = parsed.parents.map((p) => {
    const key = normalizeName(p.name);
    const match = existingParents.get(key);
    let row;
    if (match) {
      row = { ...p, status: "exists", id: match._id, existingName: match.name };
    } else if (existingChildren.has(key)) {
      row = { ...p, status: "conflict", note: `موجودة كفئة فرعية تحت «${existingChildren.get(key).join("، ")}»` };
    } else {
      row = { ...p, status: "new" };
    }
    counts[row.status]++;

    const siblings = byKey(match?.children ?? []);
    row.children = p.children.map((c) => {
      const ck = normalizeName(c.name);
      let child;
      if (row.status === "conflict") {
        child = { ...c, status: "conflict", note: "أبوها ما رح ينضاف" };
      } else if (siblings.has(ck)) {
        const s = siblings.get(ck);
        child = { ...c, status: "exists", id: s._id, existingName: s.name };
      } else if (existingParents.has(ck)) {
        child = { ...c, status: "conflict", note: `«${existingParents.get(ck).name}» موجودة كفئة أب` };
      } else {
        child = { ...c, status: "new" };
      }
      counts[child.status]++;
      return child;
    });
    return row;
  });

  return { parents, counts };
};
