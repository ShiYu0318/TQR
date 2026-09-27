// The solver's single source is src/js/tri_core.js, kept in step with src/tqr/tri.py. Bundlers need the triCore()
// plugin from "@tqr/tri-core/vite" so that this import resolves to the TRI object.
import TRI from "../../src/js/tri_core.js";
import tables from "../../src/js/qr_tables.json";

TRI.setTables(tables);

export default TRI;
