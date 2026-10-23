import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh } from "three";
export const MODEL_PATHS = {
  trophy: "models/trophy.glb",
  football: "models/football.glb",
  basketball: "models/basketball.glb",
  volleyball: "models/volleyball.glb",
} as const;
export type AssetKind = keyof typeof MODEL_PATHS;
export function SportsAsset({ kind }: { kind: AssetKind }) {
  const { scene } = useGLTF(
    `${import.meta.env.BASE_URL}${MODEL_PATHS[kind]}`,
    false,
    false,
  );
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={object} name={`asset-${kind}`} dispose={null} />;
}
