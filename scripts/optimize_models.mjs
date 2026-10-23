import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  textureCompress,
  tangents,
  unweld,
} from "@gltf-transform/functions";
import sharp from "sharp";
import { generateTangents } from "mikktspace";
import fs from "node:fs/promises";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await fs.mkdir("public/models", { recursive: true });
for (const key of ["trophy", "football", "basketball", "volleyball"]) {
  const doc = await io.read(`tmp/prepared-models/${key}.glb`);
  if (key !== "trophy") {
    const image = await sharp("assets/source-textures/leather_white_nor_gl.png")
      .resize(512, 512)
      .png()
      .toBuffer();
    const normal = doc
      .createTexture("Fine leather grain - Rob Tuytel CC0")
      .setImage(image)
      .setMimeType("image/png");
    for (const material of doc.getRoot().listMaterials()) {
      if (Math.max(...material.getBaseColorFactor().slice(0, 3)) > 0.02)
        material
          .setNormalTexture(normal)
          .setNormalScale(key === "basketball" ? 0.24 : 0.12);
    }
  }
  await doc.transform(
    dedup(),
    unweld(),
    tangents({ generateTangents }),
    weld(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [512, 512],
      quality: 90,
    }),
  );
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "KHR_materials_specular") ext.dispose();
  await io.write(`public/models/${key}.glb`, doc);
  console.log(key, (await fs.stat(`public/models/${key}.glb`)).size);
}
