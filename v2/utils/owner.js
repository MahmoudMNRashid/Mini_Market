import User from "../models/user.js";
import { ownerPatch, ownerPhones } from "./account.js";

// بيطابق دور المستخدم وربطه مع الـ env (OWNER_PHONE / OWNER_LINKED_PHONE) وبيحفظ إذا تغيّر شي
// بيرجع نفس الـ user (معدّل). الـ DB بتنلمس بس إذا في تغيير، أو للرقم التاني قبل ما ينربط
export const syncOwner = async (user) => {
  const phones = ownerPhones();
  let ownerId = null;
  if (phones.linked && user.phoneNumber === phones.linked) {
    ownerId = user.linkedTo ?? (await User.findOne({ phoneNumber: phones.owner }).select("_id").lean())?._id ?? null;
  }

  const patch = ownerPatch(user, phones, ownerId);
  if (patch) {
    Object.assign(user, patch);
    await user.save();
  }
  return user;
};
