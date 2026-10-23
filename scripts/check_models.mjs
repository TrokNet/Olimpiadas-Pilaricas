import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import validator from "gltf-validator";
import sharp from "sharp";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const report = [];
for (const key of ["trophy", "football", "basketball", "volleyball"]) {
  const data = await fs.readFile(`public/models/${key}.glb`);
  const result = await validator.validateBytes(new Uint8Array(data), {
    uri: `${key}.glb`,
    maxIssues: 20,
  });
  if (result.issues.numErrors)
    throw new Error(`${key}: ${JSON.stringify(result.issues)}`);
  const doc = await io.read(`public/models/${key}.glb`);
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives())
      triangles += (p.getIndices()?.getCount() || 0) / 3;
  if (triangles > 30000 || data.byteLength > 1_000_000)
    throw new Error(`${key}: presupuesto excedido`);
  const textures = doc.getRoot().listTextures();
  for (const tex of textures) {
    const info = await sharp(tex.getImage()).metadata();
    if (info.width > 512 || info.height > 512)
      throw new Error("Textura excesiva");
  }
  if (
    key !== "trophy" &&
    !doc
      .getRoot()
      .listMaterials()
      .some((m) => m.getNormalTexture())
  )
    throw new Error(`${key}: falta material normal`);
  if (
    key === "trophy" &&
    !doc
      .getRoot()
      .listMaterials()
      .some((m) => m.getMetallicFactor() > 0.8)
  )
    throw new Error("Falta material metálico");
  report.push({
    model: key,
    bytes: data.byteLength,
    triangles,
    textures: textures.length,
    errors: result.issues.numErrors,
    warnings: result.issues.numWarnings,
  });
}
const total = report.reduce((sum, a) => sum + a.bytes, 0);
if (total > 2_000_000) throw new Error("Presupuesto de escena excedido");
console.table(report);
console.log(
  "GLB válidos; total",
  total,
  "bytes. HDRI local",
  (await fs.stat("public/environments/studio_small_09_1k.hdr")).size,
  "bytes.",
);
await fs.mkdir("tmp", { recursive: true });
await fs.writeFile(
  "tmp/model-validation.json",
  JSON.stringify(report, null, 2),
);
