import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useStudio } from "./store";
import "./index.css";

// browser tests drive the app through the store
(window as unknown as { __studio: typeof useStudio }).__studio = useStudio;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
