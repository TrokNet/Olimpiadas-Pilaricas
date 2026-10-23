import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
const seen = new Set();
function walk(key) {
  if (seen.has(key)) return;
  seen.add(key);
  for (const child of manifest[key]?.imports || []) walk(child);
}
walk("index.html");
if ([...seen].some((key) => /three-core|three-react/.test(key)))
  throw new Error(
    "El 3D se está cargando antes de pedir la escena. Revisar partición de paquetes.",
  );
if (!manifest["src/Scene.tsx"]?.isDynamicEntry)
  throw new Error("Falta carga diferida de la escena WebGL.");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? files(join(dir, f.name)) : [join(dir, f.name)],
  );
}
if (files("dist").some((f) => /\.(db|xlsx|env)$/i.test(f)))
  throw new Error("No publicar la BD, Excel ni credenciales dentro de dist.");
console.log(
  "Build validado: escena WebGL diferida; archivos de BD y fuente fuera de dist.",
);
