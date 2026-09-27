import TRI from "@tqr/tri-core";

// placeholder until the app shell lands: proves the solver loads, typed, in the browser build
const S = TRI.structure(3, "H");

export function App() {
  return (
    <main>
      <h1>TQR Studio</h1>
      <p>多視角 QR 設計工作室</p>
      <p>
        QR v{S.version} ({S.n}×{S.n}), {S.nec.length} blocks
      </p>
    </main>
  );
}
