// My designs: named snapshots of the settings, with a thumbnail and, when available, the generated sculpture so that
// opening one needs no new solve. Records use the same checked settings format as share links.
import { useStudio } from "@/store";
import { t } from "@/i18n";
import { captureView } from "@/three/Scanner";
import { contentTitle } from "./content";
import { getState, setState, type SavedState } from "./share";
import { generate, showResult } from "./actions";
import { indexedDbStore, memoryStore, type DesignRecord, type DesignStore } from "./designStore";

export type { DesignRecord } from "./designStore";

const OLD_LIST = "tqr.saved"; // the plain list of earlier versions, moved over once
const CURRENT = "tqr.current";

let storeReady: Promise<DesignStore> | null = null;

/** tests (and a browser without IndexedDB) use a store in memory */
export function useStore(store: DesignStore) {
  storeReady = moveOldList(store).then(() => store);
}

export function designStore(): Promise<DesignStore> {
  storeReady ??= (typeof indexedDB === "undefined" ? Promise.resolve(memoryStore()) : indexedDbStore().catch(() => memoryStore())).then(
    async (store) => {
      await moveOldList(store);
      return store;
    },
  );
  return storeReady;
}

async function moveOldList(store: DesignStore) {
  try {
    const list = JSON.parse(localStorage.getItem(OLD_LIST) || "[]");
    if (!Array.isArray(list)) return;
    const now = Date.now();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item?.state) await store.put({ id: newId(), name: String(item.name || t("未命名")), state: item.state, thumb: null, result: null, created: now - i, updated: now - i });
    }
    localStorage.removeItem(OLD_LIST);
  } catch {
    /* nothing to move */
  }
}

export const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

// ---- which record is open, so it can be updated in place
export function currentId(): string | null {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}
function setCurrent(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT, id);
    else localStorage.removeItem(CURRENT);
  } catch {
    /* storage unavailable */
  }
}

/** newest first */
export async function listDesigns(): Promise<DesignRecord[]> {
  return (await (await designStore()).all()).sort((a, b) => b.updated - a.updated);
}

function defaultName(): string {
  const c = useStudio.getState().design.content[0];
  return contentTitle(c.type, c.fields);
}

/** the sculpture on screen, when it was generated from exactly the design on screen */
function currentResult(): DesignRecord["result"] {
  const s = useStudio.getState();
  if (s.model !== "sil" || !s.result || JSON.stringify(s.generatedWith) !== JSON.stringify(s.design)) return null;
  return { result: s.result, links: s.links };
}

/** a 240 px wide picture of the view, or null where there is no view (tests) */
async function thumbnail(): Promise<string | null> {
  if (!captureView || typeof document === "undefined") return null;
  try {
    const picture = await createImageBitmap(await captureView());
    const w = 240, h = Math.round((w * picture.height) / picture.width), cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d")!.drawImage(picture, 0, 0, w, h);
    return cv.toDataURL("image/webp", 0.8);
  } catch {
    return null;
  }
}

export async function saveNew(name?: string): Promise<DesignRecord> {
  const now = Date.now();
  const record: DesignRecord = { id: newId(), name: name?.trim() || defaultName(), state: getState(), thumb: await thumbnail(), result: currentResult(), created: now, updated: now };
  await (await designStore()).put(record);
  setCurrent(record.id);
  return record;
}

/** write the design on screen over an existing record, keeping its name */
export async function updateDesign(id: string): Promise<DesignRecord | null> {
  const store = await designStore(), old = await store.get(id);
  if (!old) return null;
  const record = { ...old, state: getState(), thumb: (await thumbnail()) ?? old.thumb, result: currentResult(), updated: Date.now() };
  await store.put(record);
  setCurrent(id);
  return record;
}

export async function renameDesign(id: string, name: string) {
  const store = await designStore(), old = await store.get(id);
  if (old && name.trim()) await store.put({ ...old, name: name.trim(), updated: Date.now() });
}

export async function duplicateDesign(id: string): Promise<DesignRecord | null> {
  const store = await designStore(), old = await store.get(id);
  if (!old) return null;
  const now = Date.now(), copy = { ...old, id: newId(), name: t("{n}（副本）", { n: old.name }), created: now, updated: now };
  await store.put(copy);
  return copy;
}

export async function deleteDesign(id: string) {
  await (await designStore()).remove(id);
  if (currentId() === id) setCurrent(null);
}

/** open a record: its settings, then its saved sculpture, or a new solve when none was kept */
export async function loadDesign(id: string): Promise<boolean> {
  const record = await (await designStore()).get(id);
  if (!record) return false;
  setState(record.state);
  setCurrent(id);
  const s = useStudio.getState();
  if (s.model === "sil") {
    if (record.result) showResult(record.result.result, record.result.links);
    else void generate();
  }
  return true;
}

// ---- moving designs between browsers: one file for all of them (models are left out: they can be solved again)
export const BUNDLE = "tqr-designs";

export async function exportAll(): Promise<{ text: string; count: number }> {
  const designs = (await listDesigns()).map(({ name, state, thumb, created, updated }) => ({ name, state, thumb, created, updated }));
  return { text: JSON.stringify({ format: BUNDLE, v: 1, exported: new Date().toISOString(), designs }, null, 1), count: designs.length };
}

const looksLikeSettings = (s: unknown): s is SavedState => !!s && typeof s === "object" && (s as SavedState).v === 1 && Array.isArray((s as SavedState).content);

/**
 * Add the designs of a file: a bundle from exportAll, or a single settings file (a share-link payload saved as JSON).
 * Designs already here with the same name and settings are skipped. Returns how many were added; throws on a file
 * that is neither.
 */
export async function importText(text: string, fileName = ""): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(text);
  const incoming: { name: string; state: SavedState; thumb: string | null; created: number; updated: number }[] = [];
  const now = Date.now();
  if (data?.format === BUNDLE && Array.isArray(data.designs)) {
    for (const d of data.designs)
      if (looksLikeSettings(d?.state))
        incoming.push({ name: String(d.name || t("未命名")), state: d.state, thumb: typeof d.thumb === "string" && d.thumb.startsWith("data:image/") ? d.thumb : null, created: +d.created || now, updated: +d.updated || now });
  } else if (looksLikeSettings(data)) {
    incoming.push({ name: fileName.replace(/\.json$/i, "") || t("匯入的設計"), state: data, thumb: null, created: now, updated: now });
  } else throw new Error("not a TQR designs file");

  const store = await designStore(), have = new Set((await store.all()).map((d) => d.name + "\n" + JSON.stringify(d.state)));
  let added = 0;
  for (const d of incoming) {
    const key = d.name + "\n" + JSON.stringify(d.state);
    if (have.has(key)) continue;
    have.add(key);
    await store.put({ id: newId(), result: null, ...d });
    added++;
  }
  return { added, skipped: incoming.length - added };
}

/** start over from the default design, keeping the viewer's backdrop and language */
export function newDesign() {
  const s = useStudio.getState(), start = useStudio.getInitialState();
  useStudio.setState({
    model: "sil",
    design: start.design,
    look: { ...start.look, backdrop: s.look.backdrop, floor: s.look.floor },
    moduleMm: start.moduleMm,
  });
  setCurrent(null);
  void generate();
}
