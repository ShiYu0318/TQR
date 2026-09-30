// My designs, on the in-memory store: save, update, rename, duplicate, delete, open, the old list moved over.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "@tqr/tri-core";
import { useStudio } from "@/store";
import { memoryStore } from "./designStore";
import { currentId, deleteDesign, duplicateDesign, exportAll, importText, listDesigns, loadDesign, newDesign, renameDesign, saveNew, updateDesign, useStore } from "./designs";
import { getState } from "./share";

vi.mock("./actions", () => ({
  generate: vi.fn(async () => {}),
  showResult: vi.fn((result: Result, links: string[]) => useStudio.getState().setResult(result, links, useStudio.getState().design)),
}));
import { generate } from "./actions";

const memory = new Map<string, string>();
const fakeResult = { n: 21, version: 1, V: new Uint8Array(21 ** 3) } as unknown as Result;

beforeEach(() => {
  memory.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });
  useStudio.setState(useStudio.getInitialState());
  useStore(memoryStore());
  vi.mocked(generate).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const url = (u: string) => ({ type: "url", fields: { url: u } });

describe("my designs", () => {
  it("saves, lists newest first and remembers the open one", async () => {
    useStudio.getState().setContent(0, url("https://s.gd/one"));
    const a = await saveNew();
    useStudio.getState().setContent(0, url("https://s.gd/two"));
    const b = await saveNew("second");
    expect(a.name).toContain("https://s.gd/one");
    expect((await listDesigns()).map((d) => d.id)).toEqual([b.id, a.id]);
    expect(currentId()).toBe(b.id);
  });
  it("keeps the sculpture only when it matches the design on screen", async () => {
    const s = useStudio.getState();
    s.setResult(fakeResult, ["x"], s.design);
    expect((await saveNew()).result?.result.n).toBe(21);
    s.setDesign({ level: "L" }); // edited after generating: the model no longer matches
    expect((await saveNew()).result).toBeNull();
  });
  it("updates in place, renames, duplicates and deletes", async () => {
    const a = await saveNew("mine");
    useStudio.getState().setDesign({ strut: 30 });
    await updateDesign(a.id);
    await renameDesign(a.id, "  renamed  ");
    const copy = (await duplicateDesign(a.id))!;
    let list = await listDesigns();
    expect(list).toHaveLength(2);
    const back = list.find((d) => d.id === a.id)!;
    expect(back.name).toBe("renamed");
    expect(back.state.strut).toBe(30);
    expect(copy.name).toContain("renamed");
    expect(copy.id).not.toBe(a.id);
    await deleteDesign(a.id);
    list = await listDesigns();
    expect(list.map((d) => d.id)).toEqual([copy.id]);
    expect(currentId()).toBeNull();
  });
  it("opens a design with its saved sculpture, or solves again without one", async () => {
    const s = useStudio.getState();
    s.setContent(0, url("https://s.gd/kept"));
    s.setResult(fakeResult, ["https://s.gd/kept"], useStudio.getState().design);
    const kept = await saveNew();
    s.setContent(0, url("https://s.gd/plain"));
    const plain = await saveNew();

    useStudio.setState(useStudio.getInitialState());
    await loadDesign(kept.id);
    expect(useStudio.getState().design.content[0].fields.url).toBe("https://s.gd/kept");
    expect(useStudio.getState().result?.n).toBe(21);
    expect(generate).not.toHaveBeenCalled();

    await loadDesign(plain.id);
    expect(useStudio.getState().design.content[0].fields.url).toBe("https://s.gd/plain");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("moves the old plain list over once", async () => {
    memory.set("tqr.saved", JSON.stringify([{ name: "old one", state: getState() }]));
    useStore(memoryStore()); // a fresh store runs the move on first use
    const { designStore } = await import("./designs");
    await designStore();
    const list = await listDesigns();
    expect(list.map((d) => d.name)).toContain("old one");
    expect(memory.has("tqr.saved")).toBe(false);
  });
  it("exports every design to one file and imports it into another browser", async () => {
    const s = useStudio.getState();
    s.setContent(0, url("https://s.gd/a"));
    s.setResult(fakeResult, ["https://s.gd/a"], useStudio.getState().design);
    await saveNew("first");
    useStudio.getState().setContent(0, url("https://s.gd/b"));
    await saveNew("second");
    const { text, count } = await exportAll();
    expect(count).toBe(2);
    expect(text).not.toContain('"result"'); // models stay out of the file

    useStore(memoryStore()); // another browser
    expect(await importText(text)).toEqual({ added: 2, skipped: 0 });
    expect(await importText(text)).toEqual({ added: 0, skipped: 2 }); // same file twice adds nothing
    const list = await listDesigns();
    expect(list.map((d) => d.name).sort()).toEqual(["first", "second"]);
    expect(list.find((d) => d.name === "second")!.state.content[0].f.url).toBe("https://s.gd/b");
  });
  it("imports a single settings file under the file's name and rejects anything else", async () => {
    useStudio.getState().setContent(0, url("https://s.gd/single"));
    expect(await importText(JSON.stringify(getState()), "poster.json")).toEqual({ added: 1, skipped: 0 });
    expect((await listDesigns())[0].name).toBe("poster");
    await expect(importText('{"hello": 1}')).rejects.toThrow();
    await expect(importText("not json")).rejects.toThrow();
  });
  it("starts a new design from the defaults and forgets the open record", async () => {
    await saveNew("keep");
    useStudio.getState().setDesign({ level: "L" });
    newDesign();
    expect(useStudio.getState().design).toEqual(useStudio.getInitialState().design);
    expect(currentId()).toBeNull();
  });
});
