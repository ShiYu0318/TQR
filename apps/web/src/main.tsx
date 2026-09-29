import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useStudio } from "./store";
import { scanNow } from "./lib/scan";
import * as scanner from "./three/Scanner";
import { applySharedHash } from "./lib/share";
import { keepDraft, restoreDraft } from "./lib/draft";
import { sharedNote } from "./panels/SharePanel";
import "./index.css";

// browser tests drive the app through the store, scan the view and grab the frame the scanner reads
Object.assign(window, { __studio: useStudio, __scan: scanNow, __capture: () => scanner.captureScan?.() });

// the last draft comes back first, then a shared link overrides it; both before the first generation
restoreDraft();
sharedNote.text = applySharedHash();
keepDraft();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
