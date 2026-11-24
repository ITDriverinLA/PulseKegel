import {
  legacyOfferingsErrorCode,
  legacyPurchaseErrorCode,
  legacyRestoreErrorCode,
  parseRcCode,
  purchaseErrorPayload,
  sanitizeErrorMessage,
  toPurchaseError,
} from "../purchaseErrors";

describe("P9a.2 toPurchaseError", () => {
  it("reads a RevenueCat-shaped error", () => {
    expect(
      toPurchaseError({
        code: "3",
        message: "The device or user is not allowed to make the purchase.",
        userCancelled: false,
        userInfo: { readableErrorCode: "PURCHASE_NOT_ALLOWED" },
      }),
    ).toEqual({
      rcCode: 3,
      readableErrorCode: "PURCHASE_NOT_ALLOWED",
      errorMessage: "The device or user is not allowed to make the purchase.",
      userCancelled: false,
    });
  });

  it("handles a plain Error", () => {
    expect(toPurchaseError(new Error("network down"))).toEqual({
      errorMessage: "network down",
      userCancelled: false,
    });
  });

  it("handles numeric, odd and missing codes", () => {
    expect(parseRcCode(20)).toBe(20);
    expect(parseRcCode("23")).toBe(23);
    expect(parseRcCode(" 7 ")).toBe(7);
    expect(parseRcCode("100")).toBeUndefined();
    expect(parseRcCode(-1)).toBeUndefined();
    expect(parseRcCode(3.5)).toBeUndefined();
    expect(parseRcCode("E_FOO")).toBeUndefined();
    expect(parseRcCode(undefined)).toBeUndefined();
    expect(toPurchaseError(null)).toEqual({ userCancelled: false });
    expect(toPurchaseError("just a string")).toEqual({
      errorMessage: "just a string",
      userCancelled: false,
    });
  });

  it("truncates and strips ids and emails", () => {
    const long = "x".repeat(300);
    expect(toPurchaseError({ message: long }).errorMessage).toHaveLength(100);
    expect(
      sanitizeErrorMessage(
        "User a.b@example.com order GPA.3312-4455-6677-88990 id 0123456789abcdef0123",
      ),
    ).toBe("User [email] order [id] id [id]");
    expect(sanitizeErrorMessage("   ")).toBeUndefined();
    expect(
      toPurchaseError({ userInfo: { readableErrorCode: "R".repeat(80) } })
        .readableErrorCode,
    ).toHaveLength(64);
  });

  it("payload drops userCancelled:false and keeps true", () => {
    expect(purchaseErrorPayload({ code: "1", userCancelled: true })).toEqual({
      rcCode: 1,
      userCancelled: true,
    });
    expect(purchaseErrorPayload({ code: "2" })).toEqual({ rcCode: 2 });
  });
});

describe("P9a.2 legacy errorCode formats are unchanged", () => {
  it("purchase: raw string code only", () => {
    expect(legacyPurchaseErrorCode({ code: "3" })).toBe("3");
    expect(legacyPurchaseErrorCode({ code: 3 })).toBeUndefined();
  });
  it("restore: String(code) or unknown", () => {
    expect(legacyRestoreErrorCode({ code: 3 })).toBe("3");
    expect(legacyRestoreErrorCode({})).toBe("unknown");
    expect(legacyRestoreErrorCode({ code: "" })).toBe("unknown");
  });
  it("offerings: rc_<code> or offerings_fetch_error", () => {
    expect(legacyOfferingsErrorCode({ code: "3" })).toBe("rc_3");
    expect(legacyOfferingsErrorCode(new Error("x"))).toBe(
      "offerings_fetch_error",
    );
  });
});
