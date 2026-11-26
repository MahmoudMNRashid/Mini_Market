import { toSyrianPhone } from "./phone.js";

// منطق صافي (بلا DB) للحساب: المالك، الرقم المربوط، الاشتراك المفتوح، الداشبورد
// كلو هون مشان ينفحص بـ node --test

const DAY = 24 * 60 * 60 * 1000;

// رقمين المالك من الـ env (Vercel): OWNER_PHONE أدمن، OWNER_LINKED_PHONE نفس حسابه
export const ownerPhones = (env = process.env) => ({
  owner: toSyrianPhone(env.OWNER_PHONE),
  linked: toSyrianPhone(env.OWNER_LINKED_PHONE),
});

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// شو لازم يتغيّر عالمستخدم ليطابق الـ env، أو null إذا ما في شي
// ownerId بيلزم بس للرقم المربوط (إذا المالك لسا ما سجّل ← ما منربط)
// وإذا الرقم انشال من الـ env ← الدور/الربط بينشالوا كمان
export const ownerPatch = (user, phones, ownerId = null) => {
  const patch = {};
  const isOwner = phones.owner && user.phoneNumber === phones.owner;
  const isLinked = phones.linked && user.phoneNumber === phones.linked && !isOwner;

  const role = isOwner ? "admin" : "user";
  if ((user.role ?? "user") !== role) patch.role = role;

  const linkedTo = isLinked && ownerId ? ownerId : null;
  const current = user.linkedTo ?? null;
  if (current !== linkedTo && !sameId(current, linkedTo)) patch.linkedTo = linkedTo;

  return Object.keys(patch).length ? patch : null;
};

export const isAdmin = (user) => user?.role === "admin";

// المالك ورقمه التاني: اشتراك ما بيخلص
export const isOpenSubscription = (user) => isAdmin(user) || user?.linkedTo != null;

export const isSubscriptionActive = (user, now = new Date()) =>
  isOpenSubscription(user) || (!!user?.subscriptionEnd && new Date(user.subscriptionEnd) > now);

// صاحب البيانات: الرقم المربوط بيشتغل على منتجات وفئات المالك
export const dataOwnerId = (user) => String(user.linkedTo ?? user._id);

// يلي بيرجع للتطبيق (login / activate / me)
export const publicUser = (user) => ({
  phoneNumber: user.phoneNumber,
  subscriptionEnd: user.subscriptionEnd,
  isAdmin: isAdmin(user),
  openSubscription: isOpenSubscription(user),
  mustChangePassword: !!user.mustChangePassword,
});

// الأيام الباقية (تقريب لفوق: باقي ساعات = يوم)، 0 إذا خلص أو ما انفعّل
export const daysLeft = (end, now = new Date()) => {
  if (!end) return 0;
  const ms = new Date(end) - now;
  return ms > 0 ? Math.ceil(ms / DAY) : 0;
};

// تجديد بالأيام: إذا لسا فعّال منمدّد من نهايته، وإلا من هلق
export const extendByDays = (currentEnd, days, now = new Date()) => {
  const base = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : new Date(now);
  return new Date(base.getTime() + days * DAY);
};

export const WEEK_DAYS = 7;

// بيقسم المستخدمين للداشبورد:
// - pending: ما دخّل الكود، ويا ما انفعّل أبداً يا اشتراكه فعّال (عم يستنى الكود)
//   (الرقم المربوط بيطلع هون أول مرة كمان، مشان المالك يشوف الكود)
// - subscribers: الباقي، بلا حسابات المالك، الأقرب للخلصان أول والمنتهين آخر شي
// productCounts: { [userId]: count }
export const buildDashboard = (users, productCounts = {}, now = new Date()) => {
  const pending = [];
  const subscribers = [];
  let active = 0;
  let expiringWeek = 0;
  let total = 0;

  for (const u of users) {
    const open = isOpenSubscription(u);
    const isActive = isSubscriptionActive(u, now);
    const left = daysLeft(u.subscriptionEnd, now);

    if (!u.isVerified && (open || !u.subscriptionEnd || isActive)) {
      pending.push({
        phoneNumber: u.phoneNumber,
        activationCode: u.activationCode ?? null,
        activated: isActive, // انفعّل وناطر يدخّل الكود
        daysLeft: open ? null : left,
        owner: open,
        createdAt: u.createdAt,
      });
    }

    if (open) continue; // المالك برّا الإحصائيات والقائمة
    total += 1;

    if (u.isVerified && isActive) {
      active += 1;
      if (left <= WEEK_DAYS) expiringWeek += 1;
    }

    if (u.isVerified || (u.subscriptionEnd && !isActive)) {
      subscribers.push({
        phoneNumber: u.phoneNumber,
        subscriptionEnd: u.subscriptionEnd,
        daysLeft: left,
        active: isActive,
        productCount: productCounts[String(u._id)] ?? 0,
      });
    }
  }

  subscribers.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const ea = new Date(a.subscriptionEnd).getTime();
    const eb = new Date(b.subscriptionEnd).getTime();
    return a.active ? ea - eb : eb - ea;
  });
  pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    stats: { users: total, active, expiringWeek, pending: pending.length },
    pending,
    subscribers,
  };
};
