import { describe, it, expect, vi } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Ball, Trophy, TeamRing } from "./Scene";
import { Group, Mesh, Vector3, PerspectiveCamera } from "three";
import { fitSceneDistance } from "./sceneConfig";
import raw from "./data/tournament.json";
// Parse shipped geometry using the real Three GLTFLoader. Textures are validated
// separately; this renderer has no GPU/image decoder and exercises scene events.
const assets = await vi.hoisted(async () => {
  const { readFile } = await import("node:fs/promises");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const entries = await Promise.all(
    ["trophy", "football", "basketball", "volleyball"].map(async (key) => {
      const data = await readFile(
        new URL(`../public/models/${key}.glb`, import.meta.url),
      );
      const loader = new GLTFLoader().register((parser) => ({
        name: "terminal-geometry",
        beforeRoot() {
          for (const material of parser.json.materials || [])
            delete material.normalTexture;
          return null;
        },
      }));
      const gltf = await loader.parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        "",
      );
      return [key, gltf] as const;
    }),
  );
  return Object.fromEntries(entries);
});
vi.mock("@react-three/drei", async () => {
  const actual =
    await vi.importActual<typeof import("@react-three/drei")>(
      "@react-three/drei",
    );
  return {
    ...actual,
    useGLTF: (url: string) => assets[url.split("/").pop()!.replace(".glb", "")],
  };
});
// Renderizador Three en terminal: objetos reales, eventos y avance de fotogramas.
vi.hoisted(() => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    self: globalThis,
    requestAnimationFrame: (callback: (time: number) => void) =>
      setTimeout(() => callback(performance.now()), 16),
    cancelAnimationFrame: clearTimeout,
  });
});
describe("Escena tridimensional real", () => {
  it.each([0.6, 0.8, 1, 1.5, 2])(
    "encuadra los GLB completos con proporción %s, selección y giro",
    (aspect) => {
      const camera = new PerspectiveCamera(40, aspect, 0.1, 100);
      camera.position.set(0, 0.8, fitSceneDistance(aspect, true));
      camera.lookAt(0, 0.35, 0);
      camera.updateMatrixWorld();
      const layout = [
        ["trophy", [0, -1.05, 0], 1],
        ["football", [-1.65, -0.45, 0.35], 0.75 * 1.08],
        ["basketball", [1.7, -0.3, 0.05], 0.76 * 1.08],
        ["volleyball", [1.15, 1.45, -0.65], 0.58 * 1.08],
      ] as const;
      for (const [kind, position, scale] of layout) {
        const model = assets[kind].scene.clone(true);

        for (let spin = 0; spin < 16; spin++) {
          const orbit = new Group();
          orbit.rotation.set(0.06, 0.16, 0);
          const holder = new Group();
          holder.position.set(position[0], position[1], position[2]);
          holder.scale.setScalar(scale);
          holder.rotation.y = (spin * Math.PI) / 8;
          orbit.add(holder);
          orbit.updateMatrixWorld(true);
          holder.add(model);
          orbit.updateMatrixWorld(true);
          let maxX = 0,
            maxY = 0;
          model.traverse((node) => {
            if (!(node instanceof Mesh)) return;
            const positions = node.geometry.getAttribute("position");
            for (let i = 0; i < positions.count; i++) {
              const point = new Vector3()
                .fromBufferAttribute(positions, i)
                .applyMatrix4(node.matrixWorld)
                .project(camera);
              maxX = Math.max(maxX, Math.abs(point.x));
              maxY = Math.max(maxY, Math.abs(point.y));
            }
          });
          expect(maxX, `${kind}: recorte horizontal`).toBeLessThan(0.98);
          expect(maxY, `${kind}: recorte vertical`).toBeLessThan(0.98);
        }
      }
    },
  );

  it("construye un trofeo con geometría volumétrica y gira al avanzar fotogramas", async () => {
    const r = await ReactThreeTestRenderer.create(<Trophy />);
    const trophy = r.scene.findByProps({ name: "championship-trophy" });
    const g = trophy.instance as Group;
    const initial = g.rotation.y;
    expect(trophy.children.length).toBeGreaterThan(0);
    const asset = r.scene.findByProps({ name: "asset-trophy" });
    expect((asset.instance as Group).children.length).toBeGreaterThan(0);
    await r.advanceFrames(8, 0.1);
    expect(g.rotation.y).toBeGreaterThan(initial);
    await r.unmount();
  });
  it("respeta movimiento reducido", async () => {
    const r = await ReactThreeTestRenderer.create(<Trophy reduced />);
    const g = r.scene.findByProps({ name: "championship-trophy" })
      .instance as Group;
    await r.advanceFrames(8, 0.1);
    expect(g.rotation.y).toBe(0);
    await r.unmount();
  });
  it.each(["football", "volleyball", "basketball"] as const)(
    "el balón %s reacciona a selección y animación",
    async (sport) => {
      const select = vi.fn();
      const r = await ReactThreeTestRenderer.create(
        <Ball sport={sport} position={[0, 0, 0]} onSelect={select} />,
      );
      const ball = r.scene.findByProps({ name: `ball-${sport}` });
      const g = ball.instance as Group;
      expect(ball.children.length).toBeGreaterThan(0);
      await r.fireEvent(ball, "click", { stopPropagation() {} });
      expect(select).toHaveBeenCalledWith(sport);
      await r.advanceFrames(8, 0.1);
      expect(g.rotation.y).toBeGreaterThan(0);
      await r.unmount();
    },
  );
  it("el carrusel usa 15 objetos 3D, gira de verdad y comunica la selección", async () => {
    const select = vi.fn();
    const r = await ReactThreeTestRenderer.create(
      <TeamRing
        grades={raw.grades}
        index={0}
        reduced={false}
        labels={false}
        onSelect={select}
      />,
    );
    const ring = r.scene.findByProps({ name: "team-carousel-ring" });
    expect(ring.children).toHaveLength(15);
    const visible = ring.children.filter((c) => (c.instance as Group).visible);
    expect(visible).toHaveLength(3);
    const first = visible[0].instance as Group;
    for (const card of visible.slice(1)) {
      expect(
        first.position.distanceTo((card.instance as Group).position),
      ).toBeGreaterThan(1.9);
    }
    await r.update(
      <TeamRing
        grades={raw.grades}
        index={3}
        reduced={false}
        labels={false}
        onSelect={select}
      />,
    );
    await r.advanceFrames(20, 0.05);
    expect((ring.instance as Group).rotation.y).toBeLessThan(-0.5);
    await r.fireEvent(
      r.scene.findByProps({ name: "team-card-cuarto-primaria" }),
      "click",
      { stopPropagation() {} },
    );
    expect(select).toHaveBeenCalledWith(6);
    await r.unmount();
  });
});
