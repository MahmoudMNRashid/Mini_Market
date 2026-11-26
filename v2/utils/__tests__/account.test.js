import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboard,
  dataOwnerId,
  daysLeft,
  extendByDays,
  isOpenSubscription,
  isSubscriptionActive,
  ownerPatch,
  ownerPhones,
  publicUser,
} from "../account.js";

const NOW = new Date("2026-11-25T12:00:00Z");
const inDays = (d) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);
const PHONES = { owner: "0968935347", linked: "0934049335" };
const OWNER_ID = "owner-id";

describe("ownerPhones", () => {
  it("بيوحّد الصيغ", () => {
    assert.deepEqual(ownerPhones({ OWNER_PHONE: "+963968935347", OWNER_LINKED_PHONE: "934049335" }), PHONES);
  });
  it("فاضي أو غلط ← null", () => {
    assert.deepEqual(ownerPhones({}), { owner: null, linked: null });
    assert.deepEqual(ownerPhones({ OWNER_PHONE: "123" }), { owner: null, linked: null });
  });
});

describe("ownerPatch", () => {
  it("المالك بياخد admin", () => {
    assert.deepEqual(ownerPatch({ phoneNumber: PHONES.owner }, PHONES), { role: "admin" });
  });
  it("المالك يلي عنده الدور ← ما في تغيير", () => {
    assert.equal(ownerPatch({ phoneNumber: PHONES.owner, role: "admin", linkedTo: null }, PHONES), null);
  });
  it("الرقم التاني بينربط بالمالك", () => {
    assert.deepEqual(ownerPatch({ phoneNumber: PHONES.linked }, PHONES, OWNER_ID), { linkedTo: OWNER_ID });
  });
  it("الرقم التاني المربوط ← ما في تغيير (حتى لو الـ id نوعه مختلف)", () => {
    const linkedTo = { toString: () => OWNER_ID };
    assert.equal(ownerPatch({ phoneNumber: PHONES.linked, role: "user", linkedTo }, PHONES, OWNER_ID), null);
  });
  it("الرقم التاني والمالك لسا ما سجّل ← ما منربط", () => {
    assert.equal(ownerPatch({ phoneNumber: PHONES.linked }, PHONES, null), null);
  });
  it("الرقم التاني ما بياخد admin", () => {
    assert.equal(ownerPatch({ phoneNumber: PHONES.linked, linkedTo: OWNER_ID }, PHONES, OWNER_ID), null);
  });
  it("مستخدم عادي ← ما في تغيير", () => {
    assert.equal(ownerPatch({ phoneNumber: "0911111111" }, PHONES), null);
  });
  it("انشال الرقم من الـ env ← الدور والربط بينشالوا", () => {
    const none = { owner: null, linked: null };
    assert.deepEqual(ownerPatch({ phoneNumber: PHONES.owner, role: "admin" }, none), { role: "user" });
    assert.deepEqual(ownerPatch({ phoneNumber: PHONES.linked, linkedTo: OWNER_ID }, none), { linkedTo: null });
  });
  it("نفس الرقم بالاتنين ← أدمن بس، بلا ربط", () => {
    const same = { owner: PHONES.owner, linked: PHONES.owner };
    assert.deepEqual(ownerPatch({ phoneNumber: PHONES.owner }, same, OWNER_ID), { role: "admin" });
  });
});

describe("الاشتراك", () => {
  it("المالك والمربوط مفتوح حتى بلا تاريخ", () => {
    assert.equal(isSubscriptionActive({ role: "admin", subscriptionEnd: null }, NOW), true);
    assert.equal(isSubscriptionActive({ linkedTo: OWNER_ID, subscriptionEnd: inDays(-10) }, NOW), true);
    assert.equal(isOpenSubscription({ role: "user" }), false);
  });
  it("العادي حسب التاريخ", () => {
    assert.equal(isSubscriptionActive({ subscriptionEnd: inDays(1) }, NOW), true);
    assert.equal(isSubscriptionActive({ subscriptionEnd: inDays(-1) }, NOW), false);
    assert.equal(isSubscriptionActive({ subscriptionEnd: null }, NOW), false);
  });
  it("dataOwnerId: المربوط بياخد id المالك", () => {
    assert.equal(dataOwnerId({ _id: "me", linkedTo: OWNER_ID }), OWNER_ID);
    assert.equal(dataOwnerId({ _id: "me", linkedTo: null }), "me");
  });
  it("publicUser", () => {
    assert.deepEqual(publicUser({ phoneNumber: PHONES.owner, role: "admin", subscriptionEnd: null, password: "x" }), {
      phoneNumber: PHONES.owner,
      subscriptionEnd: null,
      isAdmin: true,
      openSubscription: true,
      mustChangePassword: false,
    });
    assert.equal(publicUser({ phoneNumber: "0934000000", mustChangePassword: true }).mustChangePassword, true);
  });
});

describe("daysLeft / extendByDays", () => {
  it("daysLeft بيقرّب لفوق", () => {
    assert.equal(daysLeft(inDays(0.2), NOW), 1);
    assert.equal(daysLeft(inDays(7), NOW), 7);
    assert.equal(daysLeft(inDays(-3), NOW), 0);
    assert.equal(daysLeft(null, NOW), 0);
  });
  it("فعّال ← بيمدّد من النهاية", () => {
    assert.deepEqual(extendByDays(inDays(5), 30, NOW), inDays(35));
  });
  it("منتهي أو جديد ← من هلق", () => {
    assert.deepEqual(extendByDays(inDays(-5), 30, NOW), inDays(30));
    assert.deepEqual(extendByDays(null, 30, NOW), inDays(30));
  });
});

describe("buildDashboard", () => {
  const users = [
    { _id: "o", phoneNumber: PHONES.owner, role: "admin", isVerified: true, subscriptionEnd: null, createdAt: inDays(-100) },
    { _id: "l", phoneNumber: PHONES.linked, linkedTo: "o", isVerified: false, activationCode: "111111", subscriptionEnd: null, createdAt: inDays(-1) },
    { _id: "new", phoneNumber: "0911000001", isVerified: false, activationCode: "222222", subscriptionEnd: null, createdAt: inDays(-2) },
    { _id: "wait", phoneNumber: "0911000002", isVerified: false, activationCode: "333333", subscriptionEnd: inDays(30), createdAt: inDays(-3) },
    { _id: "soon", phoneNumber: "0911000003", isVerified: true, activationCode: "444444", subscriptionEnd: inDays(3), createdAt: inDays(-40) },
    { _id: "far", phoneNumber: "0911000004", isVerified: true, activationCode: "555555", subscriptionEnd: inDays(20), createdAt: inDays(-40) },
    { _id: "old", phoneNumber: "0911000005", isVerified: false, activationCode: null, subscriptionEnd: inDays(-10), createdAt: inDays(-60) },
    { _id: "older", phoneNumber: "0911000006", isVerified: false, activationCode: null, subscriptionEnd: inDays(-40), createdAt: inDays(-90) },
  ];
  const d = buildDashboard(users, { soon: 12, o: 300 }, NOW);

  it("الأرقام بلا حسابات المالك", () => {
    assert.deepEqual(d.stats, { users: 6, active: 2, expiringWeek: 1, pending: 3 });
  });
  it("الناطرين: الجديد، المفعّل بلا كود، والرقم المربوط أول مرة", () => {
    assert.deepEqual(d.pending.map((p) => p.phoneNumber), [PHONES.linked, "0911000001", "0911000002"]);
    const wait = d.pending.find((p) => p.phoneNumber === "0911000002");
    assert.equal(wait.activated, true);
    assert.equal(wait.activationCode, "333333");
    assert.equal(wait.daysLeft, 30);
    assert.equal(d.pending[0].owner, true);
    assert.equal(d.pending[1].activated, false);
  });
  it("المشتركين: الأقرب للخلصان أول، المنتهين آخر شي (الأحدث أول)", () => {
    assert.deepEqual(d.subscribers.map((s) => s.phoneNumber), ["0911000003", "0911000004", "0911000005", "0911000006"]);
    assert.equal(d.subscribers[0].productCount, 12);
    assert.equal(d.subscribers[1].productCount, 0);
    assert.equal(d.subscribers[2].active, false);
    assert.equal(d.subscribers[2].daysLeft, 0);
  });
  it("فاضي", () => {
    assert.deepEqual(buildDashboard([], {}, NOW), {
      stats: { users: 0, active: 0, expiringWeek: 0, pending: 0 },
      pending: [],
      subscribers: [],
    });
  });
});
