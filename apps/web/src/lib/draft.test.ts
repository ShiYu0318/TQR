// The draft follows the design as it changes and brings it back after a reload.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudio } from "@/store";
import { clearDraft, keepDraft, restoreDraft } from "./draft";
import { getState } from "./share";

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });
  vi.useFakeTimers();
  useStudio.setState(useStudio.getInitialState());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("draft", () => {
  it("is written shortly after a change and restored into a fresh store", () => {
    const stop = keepDraft();
    useStudio.getState().setDesign({ level: "Q", strut: 25 });
    useStudio.getState().setLook({ look: "pieces" });
    expect(memory.has("tqr.draft")).toBe(false); // waits for the edits to settle
    vi.advanceTimersByTime(500);
    const saved = getState();
    expect(JSON.parse(memory.get("tqr.draft")!)).toEqual(saved);
    stop();

    useStudio.setState(useStudio.getInitialState());
    expect(getState()).not.toEqual(saved);
    expect(restoreDraft()).toBe(true);
    expect(getState()).toEqual(saved);
  });
  it("ignores changes that are not part of the design", () => {
    const stop = keepDraft();
    useStudio.getState().setCamera({ distanceCm: 300 });
    useStudio.getState().setPanel("share", false);
    vi.advanceTimersByTime(500);
    expect(memory.has("tqr.draft")).toBe(false);
    stop();
  });
  it("copes with a missing, broken or cleared draft", () => {
    expect(restoreDraft()).toBe(false);
    memory.set("tqr.draft", "{not json");
    expect(restoreDraft()).toBe(false);
    memory.set("tqr.draft", JSON.stringify(getState()));
    clearDraft();
    expect(restoreDraft()).toBe(false);
  });
});
