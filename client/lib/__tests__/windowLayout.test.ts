import {
  displayClassForWindow,
  formatDeviceModel,
  heroResizeMode,
  windowWidthBucket,
} from "../windowLayout";

describe("P6 window layout", () => {
  it("classifies Duo outer as compact and inner as regular", () => {
    expect(displayClassForWindow(466, 678)).toBe("compact");
    expect(displayClassForWindow(626, 890)).toBe("regular");
    expect(displayClassForWindow(890, 626)).toBe("regular");
    expect(displayClassForWindow(390, 844)).toBe("compact");
  });

  it("buckets window width for Duo outer, inner, and wide landscape", () => {
    expect(windowWidthBucket(466)).toBe("<500");
    expect(windowWidthBucket(499)).toBe("<500");
    expect(windowWidthBucket(500)).toBe("500-800");
    expect(windowWidthBucket(626)).toBe("500-800");
    expect(windowWidthBucket(800)).toBe("500-800");
    expect(windowWidthBucket(890)).toBe(">800");
  });

  it("contains heroes on near-square and landscape windows", () => {
    expect(heroResizeMode(390, 844)).toBe("cover");
    expect(heroResizeMode(626, 890)).toBe("cover");
    expect(heroResizeMode(800, 800)).toBe("contain");
    expect(heroResizeMode(890, 626)).toBe("contain");
  });

  it("uses the model id and never a blank or oversized value", () => {
    expect(formatDeviceModel("iPhone18,1", "iPhone Duo")).toBe("iPhone18,1");
    expect(formatDeviceModel(null, "Pixel 8")).toBe("Pixel 8");
    expect(formatDeviceModel(null, null)).toBe("unknown");
    expect(formatDeviceModel("  ", "  ")).toBe("unknown");
    expect(formatDeviceModel("x".repeat(65), null)).toBe("unknown");
  });
});
