// What each QR view encodes: a content type and its fields, turned into the standard payload scanners understand.
// Tested in content.test.ts.
import { t } from "@/i18n";

export type FieldKind = "text" | "area" | "select" | "check" | "date" | "time";
export type Values = Record<string, string | boolean>;

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: [value: string, label: string][];
}

export interface ContentType {
  label: string;
  fields: FieldDef[];
  note?: string;
}

const f = (key: string, label: string, kind: FieldKind = "text", extra?: string | [string, string][]): FieldDef =>
  typeof extra === "string" ? { key, label, kind, placeholder: extra } : { key, label, kind, options: extra };

export const CONTENT_TYPES: Record<string, ContentType> = {
  url: { label: "網址", fields: [f("url", "網址", "text", "https://")] },
  text: { label: "純文字", fields: [f("text", "文字", "area")] },
  copy: { label: "掃碼複製", fields: [f("text", "要複製的文字", "area")], note: "掃描後顯示這段文字，可以直接複製。" },
  wifi: {
    label: "Wi‑Fi 連線",
    fields: [f("ssid", "Wi‑Fi 名稱"), f("enc", "加密方式", "select", [["WPA", "WPA / WPA2 / WPA3"], ["WEP", "WEP"], ["nopass", "不加密"]]),
             f("pass", "密碼"), f("hidden", "隱藏網路", "check")],
  },
  vcard: {
    label: "名片",
    fields: [f("last", "姓氏"), f("first", "名字"), f("org", "公司名稱"), f("email", "E-Mail"), f("mobile", "行動電話"), f("phone", "電話"),
             f("fax", "傳真"), f("addr", "地址"), f("zip", "郵遞區號"), f("district", "鄉/鎮/區"), f("city", "縣/市"), f("country", "國家"),
             f("web", "網站網址"), f("note", "備註", "area")],
  },
  event: {
    label: "行事曆",
    fields: [f("title", "事件"), f("allday", "全天", "check"), f("d0", "開始日期", "date"), f("t0", "開始時間", "time"),
             f("d1", "結束日期", "date"), f("t1", "結束時間", "time"), f("place", "地點"), f("desc", "說明", "area")],
  },
  email: { label: "傳送電子郵件", fields: [f("to", "收件人"), f("subject", "主旨"), f("body", "內容", "area")] },
  sms: { label: "傳送簡訊", fields: [f("num", "電話號碼"), f("msg", "簡訊內容", "area")] },
  tel: { label: "撥打電話", fields: [f("num", "電話號碼")] },
  geo: { label: "地圖座標", fields: [f("lat", "緯度"), f("lng", "經度")] },
  im: {
    label: "即時通訊",
    fields: [f("app", "應用程式", "select", [["whatsapp", "WhatsApp"], ["line", "LINE"]]), f("id", "電話號碼 / ID"), f("msg", "預設訊息")],
  },
  social: {
    label: "社群媒體",
    fields: [f("site", "社群平台", "select", [["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X (Twitter)"], ["youtube", "YouTube"], ["tiktok", "TikTok"]]),
             f("user", "使用者名稱 / 帳號")],
  },
  video: { label: "視訊通話", fields: [f("app", "應用程式", "select", [["facetime", "FaceTime"], ["skype", "Skype"]]), f("id", "帳號 / 電話號碼")] },
};

const escWifi = (s: unknown) => String(s ?? "").replace(/([\\;,:"])/g, "\\$1");
const escV = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const ymd = (d: unknown) => String(d ?? "").replace(/-/g, "");
const hms = (t: unknown) => (String(t || "00:00").replace(/:/g, "") + "00").slice(0, 6);
/** Chinese / Japanese / Korean names read family name first with no space; others "First Last" */
export const fullName = (first: string, last: string) =>
  /[぀-ヿ㐀-鿿가-힯]/.test(first + last) ? last + first : [first, last].filter(Boolean).join(" ");

/** the payload a view encodes; "" when a required field is missing */
export function encodeContent(type: string, fv: Values): string {
  const v = (k: string) => String(fv[k] ?? "").trim();
  switch (type) {
    case "url": {
      const u = v("url");
      return u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? "https://" + u : u;
    }
    case "text":
    case "copy":
      return String(fv.text ?? "");
    case "wifi":
      return v("ssid")
        ? "WIFI:T:" + (fv.enc || "WPA") + ";S:" + escWifi(fv.ssid) + ";" + (fv.enc === "nopass" ? "" : "P:" + escWifi(fv.pass) + ";") + (fv.hidden ? "H:true;" : "") + ";"
        : "";
    case "vcard": {
      if (!v("first") && !v("last") && !v("org")) return "";
      const L = ["BEGIN:VCARD", "VERSION:3.0", "N:" + escV(v("last")) + ";" + escV(v("first")) + ";;;", "FN:" + escV(fullName(v("first"), v("last")) || v("org"))];
      if (v("org")) L.push("ORG:" + escV(v("org")));
      if (v("mobile")) L.push("TEL;TYPE=CELL:" + v("mobile"));
      if (v("phone")) L.push("TEL;TYPE=WORK,VOICE:" + v("phone"));
      if (v("fax")) L.push("TEL;TYPE=FAX:" + v("fax"));
      if (v("email")) L.push("EMAIL:" + v("email"));
      if (v("addr") || v("city") || v("zip") || v("country") || v("district"))
        L.push("ADR:;;" + escV(v("addr")) + ";" + escV(v("district")) + ";" + escV(v("city")) + ";" + escV(v("zip")) + ";" + escV(v("country")));
      if (v("web")) L.push("URL:" + v("web"));
      if (v("note")) L.push("NOTE:" + escV(fv.note));
      L.push("END:VCARD");
      return L.join("\n");
    }
    case "event": {
      if (!v("title") || !v("d0")) return "";
      const L = ["BEGIN:VEVENT", "SUMMARY:" + escV(v("title"))];
      if (fv.allday) {
        L.push("DTSTART;VALUE=DATE:" + ymd(fv.d0));
        L.push("DTEND;VALUE=DATE:" + ymd(fv.d1 || fv.d0));
      } else {
        L.push("DTSTART:" + ymd(fv.d0) + "T" + hms(fv.t0));
        L.push("DTEND:" + ymd(fv.d1 || fv.d0) + "T" + hms(fv.t1 || fv.t0));
      }
      if (v("place")) L.push("LOCATION:" + escV(v("place")));
      if (v("desc")) L.push("DESCRIPTION:" + escV(fv.desc));
      L.push("END:VEVENT");
      return L.join("\n");
    }
    case "email": {
      if (!v("to")) return "";
      const q: string[] = [];
      if (v("subject")) q.push("subject=" + encodeURIComponent(v("subject")));
      if (fv.body) q.push("body=" + encodeURIComponent(String(fv.body)));
      return "mailto:" + v("to") + (q.length ? "?" + q.join("&") : "");
    }
    case "sms":
      return v("num") ? "SMSTO:" + v("num") + ":" + String(fv.msg ?? "") : "";
    case "tel":
      return v("num") ? "tel:" + v("num").replace(/\s+/g, "") : "";
    case "geo":
      return v("lat") && v("lng") ? "geo:" + v("lat") + "," + v("lng") : "";
    case "im": {
      if (!v("id")) return "";
      if ((fv.app || "whatsapp") === "whatsapp") return "https://wa.me/" + v("id").replace(/[^\d]/g, "") + (v("msg") ? "?text=" + encodeURIComponent(v("msg")) : "");
      return "https://line.me/R/ti/p/~" + encodeURIComponent(v("id").replace(/^@/, ""));
    }
    case "social": {
      const u = v("user").replace(/^@/, "");
      if (!u) return "";
      const base: Record<string, string> = {
        facebook: "https://www.facebook.com/", instagram: "https://www.instagram.com/", x: "https://x.com/",
        youtube: "https://www.youtube.com/@", tiktok: "https://www.tiktok.com/@",
      };
      return base[String(fv.site || "facebook")] + encodeURIComponent(u);
    }
    case "video":
      if (!v("id")) return "";
      return (fv.app || "facetime") === "facetime" ? "facetime:" + v("id").replace(/\s+/g, "") : "skype:" + v("id") + "?call";
  }
  return "";
}

/** "名片 · 黃士育", "Wi‑Fi 連線 · TQR Lab": the type plus its most telling field */
export function contentTitle(type: string, fv: Values): string {
  const def = CONTENT_TYPES[type];
  const main = type === "vcard"
    ? fullName(String(fv.first ?? ""), String(fv.last ?? "")) || fv.org
    : def.fields.map((d) => (d.kind === "select" || d.kind === "check" ? "" : fv[d.key])).find((x) => x && String(x).trim());
  return t(def.label) + (main ? " · " + String(main).trim().replace(/\s+/g, " ").slice(0, 24) : "");
}

/** one-line preview of a payload */
export const payloadPreview = (s: string) => s.replace(/\s*\n\s*/g, " ⏎ ").slice(0, 60) || t("（尚未填寫）");
