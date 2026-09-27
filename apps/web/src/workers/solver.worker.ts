// Runs the TQR solver off the main thread, so the page stays responsive while a sculpture is being carved.
import * as Comlink from "comlink";
import TRI, { type Result, type Spec } from "@tqr/tri-core";

const api = {
  generate(spec: Spec): { ok: true; result: Result } | { ok: false; error: string } {
    try {
      return { ok: true, result: TRI.generate(spec) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export type SolverApi = typeof api;
Comlink.expose(api);
