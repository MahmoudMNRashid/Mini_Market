import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INVALID_PHONE_MSG, normalizePhoneBody, toSyrianPhone } from "../phone.js";

describe("toSyrianPhone", () => {
  const valid = [
    ["0968935347", "0968935347"],
    ["968935347", "0968935347"],
    ["+963968935347", "0968935347"],
    ["00963968935347", "0968935347"],
    ["963968935347", "0968935347"],
    ["00963 968 935 347", "0968935347"],
    ["+963-968-935-347", "0968935347"],
    ["(0968) 935.347", "0968935347"],
    ["٠٩٦٨٩٣٥٣٤٧", "0968935347"],
    ["۰۹۶۸۹۳۵۳۴۷", "0968935347"],
  ];
  for (const [input, expected] of valid) {
    it(`بيقبل ${input}`, () => assert.equal(toSyrianPhone(input), expected));
  }

  const invalid = [
    ["", "فاضي"],
    [null, "null"],
    [undefined, "undefined"],
    ["096893534", "ناقص رقم"],
    ["09689353477", "زايد رقم"],
    ["0118935347", "أرضي مو موبايل"],
    ["+9610968935347", "رقم مو سوري"],
    ["09689a5347", "فيه حرف"],
  ];
  for (const [input, why] of invalid) {
    it(`بيرفض ${input} (${why})`, () => assert.equal(toSyrianPhone(input), null));
  }
});

describe("normalizePhoneBody", () => {
  const run = (body) => {
    const req = { body };
    let passed;
    normalizePhoneBody(req, {}, (err) => (passed = err));
    return { req, err: passed };
  };

  it("بيوحّد الرقم بالـ body وبيكمّل", () => {
    const { req, err } = run({ phoneNumber: "+963 968 935 347" });
    assert.equal(err, undefined);
    assert.equal(req.body.phoneNumber, "0968935347");
  });

  it("رقم غلط ← 422 مع field", () => {
    const { err } = run({ phoneNumber: "12345" });
    assert.equal(err.statusCode, 422);
    assert.equal(err.message, INVALID_PHONE_MSG);
    assert.deepEqual(err.data, [{ field: "phoneNumber", message: INVALID_PHONE_MSG }]);
  });

  it("الرقم ناقص أو فاضي ← بيكمّل بلا غلط (الـ controller بيرد)", () => {
    for (const body of [{}, { phoneNumber: "" }, { phoneNumber: null }, undefined]) {
      const { err } = run(body);
      assert.equal(err, undefined);
    }
  });
});
