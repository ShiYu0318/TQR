import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useStudio } from "./store";
import { scanNow } from "./lib/scan";
import * as scanner from "./three/Scanner";
import "./index.css";

// browser tests drive the app through the store, scan the view and grab the frame the scanner reads
Object.assign(window, { __studio: useStudio, __scan: scanNow, __capture: () => scanner.captureScan?.() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
