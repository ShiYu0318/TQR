// The design being edited is kept in this browser as it changes, so a reload or a closed tab loses nothing. It uses the
// same checked settings format as share links and saved designs.
import { useStudio } from "@/store";
import { getState, setState } from "./share";

const KEY = "tqr.draft";
const WAIT_MS = 400;

/** put the last draft back; false when there is none or it cannot be read */
export function restoreDraft(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    setState(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** save the draft shortly after every change to the design, look, model or module size; returns a stop function */
export function keepDraft(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined, last = "";
  const write = () => {
    timer = undefined;
    try {
      const text = JSON.stringify(getState());
      if (text !== last) localStorage.setItem(KEY, text);
      last = text;
    } catch {
      /* storage full or unavailable: the draft is a convenience */
    }
  };
  const stop = useStudio.subscribe((s, prev) => {
    if (s.design === prev.design && s.look === prev.look && s.model === prev.model && s.moduleMm === prev.moduleMm) return;
    clearTimeout(timer);
    timer = setTimeout(write, WAIT_MS);
  });
  const flush = () => timer !== undefined && (clearTimeout(timer), write());
  globalThis.addEventListener?.("pagehide", flush);
  return () => {
    stop();
    flush();
    globalThis.removeEventListener?.("pagehide", flush);
  };
}
