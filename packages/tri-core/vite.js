// src/js/tri_core.js is a classic script (it defines `var TRI`, and sets module.exports under Node) so that the
// reference app page and tests/jstest.js can load it as is. For ES-module builds this plugin appends
// `export default TRI;` when the file is loaded: no copy of the solver, and no eval at run time. A local `module` is
// declared first so the file's own `module.exports = TRI` stays inert even where a runner provides a `module` object.
import { fileURLToPath } from "node:url";

const CORE = fileURLToPath(new URL("../../src/js/tri_core.js", import.meta.url));

/** @returns {import("vite").Plugin} */
export function triCore() {
  return {
    name: "tqr-tri-core",
    enforce: "pre",
    transform(code, id) {
      if (id.split("?")[0] !== CORE) return null;
      return { code: "var module = undefined;\n" + code + "\nexport default TRI;\n", map: null };
    },
  };
}
