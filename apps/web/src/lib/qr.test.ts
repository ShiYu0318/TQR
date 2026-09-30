// The share QR: level M when the link fits, L when only that fits, none when nothing does.
import { describe, expect, it } from "vitest";
import { qrSvg, qrVersion } from "./qr";

describe("share QR", () => {
  it("draws a link with a quiet zone at level M", () => {
    const link = "https://example.com/#s2." + "a".repeat(600);
    const qr = qrSvg(link)!;
    expect(qr.level).toBe("M");
    expect(qr.version).toBe(qrVersion(link, "M"));
    const size = 17 + 4 * qr.version + 4;
    expect(qr.svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    expect(qr.svg).toContain('fill="#fff"');
  });
  it("falls back to level L, then gives up", () => {
    const mOnlyTooLong = "x".repeat(2400); // over version 40 at M (2331 bytes), within L (2953)
    expect(qrSvg(mOnlyTooLong)?.level).toBe("L");
    expect(qrSvg("x".repeat(3100))).toBeNull();
  });
});
