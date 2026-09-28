// Every string the app translates must have an English entry, and placeholders must survive in both languages.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import en from "./en.json";
import { setLanguage, t } from ".";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });

// written as-is in every language (the language switch names itself)
const AS_IS = new Set(["中文"]);
const CJK = /[\u4e00-\u9fff]/;

/** every string literal with Chinese in it, and Chinese written straight into JSX (which the switch cannot reach) */
function scan() {
  const literals = new Map<string, string>(), bare: string[] = [];
  const lit = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g, jsxText = />([^<>{}();="]*[\u4e00-\u9fff][^<>{}();="]*)</g;
  for (const f of files(SRC)) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1"), name = f.slice(SRC.length);
    for (const m of src.matchAll(lit)) if (CJK.test(m[2])) literals.set(m[1] === '"' ? JSON.parse('"' + m[2] + '"') : m[2], name);
    if (f.endsWith(".tsx")) for (const m of src.matchAll(jsxText)) bare.push(`${name}: ${m[1].trim()}`);
  }
  return { literals, bare };
}

describe("i18n", () => {
  afterAll(() => setLanguage("zh"));
  it("Chinese is the key itself, with placeholders filled", () => {
    setLanguage("zh");
    expect(t("已下載 {f}。", { f: "a.stl" })).toBe("已下載 a.stl。");
    expect(t("沒有翻譯的句子：a.b")).toBe("沒有翻譯的句子：a.b");
  });
  it("English comes from the table, with placeholders filled", () => {
    setLanguage("en");
    expect(t("已下載 {f}。", { f: "a.stl" })).toBe((en as Record<string, string>)["已下載 {f}。"].replace("{f}", "a.stl"));
    expect(t("沒有翻譯的句子：a.b")).toBe("沒有翻譯的句子：a.b");
  });
  it("every Chinese string in the source has an English entry", () => {
    const missing = [...scan().literals].filter(([k]) => !AS_IS.has(k) && !(k in en)).map(([k, f]) => `${f}: ${k}`);
    expect(missing).toEqual([]);
  });
  it("no Chinese is written straight into JSX", () => {
    expect(scan().bare).toEqual([]);
  });
  it("English keeps the placeholders of the Chinese", () => {
    const bad = Object.entries(en as Record<string, string>).filter(([zh, e]) => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      return ph(zh) !== ph(e);
    });
    expect(bad).toEqual([]);
  });
});
