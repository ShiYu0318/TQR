import { describe, expect, it } from "vitest";
import { filamentContrast, luminance } from "./colour";

describe("filament contrast", () => {
  it("measures luminance on the WCAG scale", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 6);
  });
  it("accepts the default black and white filaments", () => {
    const v = filamentContrast("#141615", "#eef0ee");
    expect(v.tone).toBe("ok");
    expect(v.message).toBe("對比 15.9:1，足夠。");
  });
  it("warns on low contrast and flags swapped filaments", () => {
    expect(filamentContrast("#777777", "#999999").tone).toBe("warn");
    expect(filamentContrast("#ffffff", "#000000").tone).toBe("bad");
  });
});
