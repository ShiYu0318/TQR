import { describe, expect, it } from "vitest";
import { contentTitle, encodeContent } from "./content";

describe("encodeContent", () => {
  it("adds https:// to a bare host and keeps other schemes", () => {
    expect(encodeContent("url", { url: "s.gd/aaa1" })).toBe("https://s.gd/aaa1");
    expect(encodeContent("url", { url: "mailto:a@b.c" })).toBe("mailto:a@b.c");
  });
  it("escapes Wi-Fi fields and drops the password when open", () => {
    expect(encodeContent("wifi", { ssid: "TQR;Lab", enc: "WPA", pass: "p:w", hidden: true })).toBe("WIFI:T:WPA;S:TQR\\;Lab;P:p\\:w;H:true;;");
    expect(encodeContent("wifi", { ssid: "Open", enc: "nopass" })).toBe("WIFI:T:nopass;S:Open;;");
    expect(encodeContent("wifi", {})).toBe("");
  });
  it("writes a vCard with a family-name-first CJK name", () => {
    const v = encodeContent("vcard", { last: "黃", first: "士育", org: "NCU", mobile: "0912", city: "桃園" });
    expect(v.split("\n")).toEqual([
      "BEGIN:VCARD", "VERSION:3.0", "N:黃;士育;;;", "FN:黃士育", "ORG:NCU", "TEL;TYPE=CELL:0912", "ADR:;;;;桃園;;", "END:VCARD",
    ]);
  });
  it("writes timed and all-day events", () => {
    expect(encodeContent("event", { title: "Demo", d0: "2026-10-01", t0: "09:30" }).split("\n")).toEqual([
      "BEGIN:VEVENT", "SUMMARY:Demo", "DTSTART:20261001T093000", "DTEND:20261001T093000", "END:VEVENT",
    ]);
    expect(encodeContent("event", { title: "Trip", allday: true, d0: "2026-10-01", d1: "2026-10-03" })).toContain("DTEND;VALUE=DATE:20261003");
  });
  it("builds mailto, sms, tel, geo, messaging, social and call links", () => {
    expect(encodeContent("email", { to: "a@b.c", subject: "Hi there", body: "x&y" })).toBe("mailto:a@b.c?subject=Hi%20there&body=x%26y");
    expect(encodeContent("sms", { num: "0912", msg: "hi" })).toBe("SMSTO:0912:hi");
    expect(encodeContent("tel", { num: "0912 345 678" })).toBe("tel:0912345678");
    expect(encodeContent("geo", { lat: "24.97", lng: "121.19" })).toBe("geo:24.97,121.19");
    expect(encodeContent("im", { app: "whatsapp", id: "+886 912", msg: "hi" })).toBe("https://wa.me/886912?text=hi");
    expect(encodeContent("im", { app: "line", id: "@tqr" })).toBe("https://line.me/R/ti/p/~tqr");
    expect(encodeContent("social", { site: "youtube", user: "@tqr" })).toBe("https://www.youtube.com/@tqr");
    expect(encodeContent("video", { app: "skype", id: "tqr" })).toBe("skype:tqr?call");
  });
});

describe("contentTitle", () => {
  it("names the type and its most telling field", () => {
    expect(contentTitle("vcard", { first: "士育", last: "黃" })).toBe("名片 · 黃士育");
    expect(contentTitle("wifi", { ssid: "TQR Lab", enc: "WPA" })).toBe("Wi‑Fi 連線 · TQR Lab");
    expect(contentTitle("tel", {})).toBe("撥打電話");
  });
});
