import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, ContactShadows, RoundedBox } from "@react-three/drei";
import {
  CanvasTexture,
  TextureLoader,
  Group,
  MathUtils,
  PointLight,
  SRGBColorSpace,
} from "three";
import type { Grade } from "./types";
import { COLOR } from "./types";
import { getTeamArt } from "./teamArt";
import { SportsAsset } from "./SportsAssets";
import { fitSceneDistance } from "./sceneConfig";

export type SportScene = "all" | "football" | "volleyball" | "basketball";
export function Ball({
  sport,
  position,
  scale = 1,
  onSelect,
  reduced = false,
}: {
  sport: SportScene;
  position: [number, number, number];
  scale?: number;
  onSelect?: (sport: SportScene) => void;
  reduced?: boolean;
}) {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame((state, delta) => {
    if (!group.current) return;
    if (!reduced) {
      group.current.rotation.y += delta * (hovered ? 0.45 : 0.1);
      group.current.position.y =
        position[1] +
        Math.sin(state.clock.elapsedTime * 0.75 + position[0]) * 0.07;
    }
    const target = scale * (hovered ? 1.08 : 1);
    group.current.scale.setScalar(
      MathUtils.damp(group.current.scale.x, target, 7, delta),
    );
  });
  return (
    <group
      ref={group}
      name={`ball-${sport}`}
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(sport);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <SportsAsset kind={sport === "all" ? "football" : sport} />
    </group>
  );
}
export function Trophy({ reduced = false }: { reduced?: boolean }) {
  const group = useRef<Group>(null);
  const spin = useRef(0);
  useFrame((_, delta) => {
    if (group.current && !reduced) {
      group.current.rotation.y += delta * (0.1 + spin.current);
      spin.current = MathUtils.damp(spin.current, 0, 2, delta);
    }
  });
  return (
    <group
      ref={group}
      name="championship-trophy"
      position={[0, -1.05, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (!reduced) spin.current = 1.5;
      }}
    >
      <SportsAsset kind="trophy" />
    </group>
  );
}

export function StageWorld({
  selected = "all",
  onSelect,
  reduced = false,
}: {
  selected?: SportScene;
  onSelect?: (sport: SportScene) => void;
  reduced?: boolean;
}) {
  const root = useRef<Group>(null);
  const accentLight = useRef<PointLight>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const particles = useMemo(
    () =>
      Float32Array.from(
        Array.from(
          { length: 210 },
          (_, i) => Math.sin(i * 127.1) * (i % 3 === 1 ? 2.6 : 5),
        ),
      ),
    [],
  );
  useFrame((state, delta) => {
    if (!root.current) return;
    const t = reduced ? 0 : state.clock.elapsedTime;
    if (accentLight.current) {
      accentLight.current.position.x = -4 + Math.sin(t * 0.3) * 0.6;
      accentLight.current.intensity = 6 + Math.sin(t * 0.6) * 0.5;
    }
    root.current.rotation.y = MathUtils.damp(
      root.current.rotation.y,
      reduced ? 0 : state.pointer.x * 0.16,
      3,
      delta,
    );
    root.current.rotation.x = MathUtils.damp(
      root.current.rotation.x,
      reduced ? 0 : state.pointer.y * 0.06,
      3,
      delta,
    );
    const target = fitSceneDistance(
      state.size.width / state.size.height,
      selectedRef.current !== "all",
    );
    state.camera.position.z = MathUtils.damp(
      state.camera.position.z,
      target,
      2,
      delta,
    );
    state.camera.lookAt(0, 0.35, 0);
    root.current.position.y = Math.sin(t * 0.5) * 0.025;
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <spotLight
        position={[2, 6, 5]}
        intensity={38}
        angle={0.4}
        penumbra={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight
        ref={accentLight}
        position={[-4, 1, 2]}
        color="#ff6b61"
        intensity={6}
      />
      <pointLight position={[3, 2, -3]} color="#a7c9ff" intensity={8} />
      <group ref={root}>
        <Trophy reduced={reduced} />
        <Ball
          sport="football"
          position={[-1.65, -0.45, 0.35]}
          scale={selected === "football" ? 0.75 : 0.62}
          onSelect={onSelect}
          reduced={reduced}
        />
        <Ball
          sport="basketball"
          position={[1.7, -0.3, 0.05]}
          scale={selected === "basketball" ? 0.76 : 0.64}
          onSelect={onSelect}
          reduced={reduced}
        />
        <Ball
          sport="volleyball"
          position={[1.15, 1.45, -0.65]}
          scale={selected === "volleyball" ? 0.58 : 0.48}
          onSelect={onSelect}
          reduced={reduced}
        />
        <points name="coral-particles">
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.025}
            color="#ffb3a8"
            transparent
            opacity={0.65}
          />
        </points>
        <mesh position={[0, -1.15, 0]} receiveShadow>
          <cylinderGeometry args={[3, 3, 0.08, 96]} />
          <meshStandardMaterial
            color="#182025"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        {[2.35, 2.7, 3.05].map((r) => (
          <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.13, 0]}>
            <torusGeometry args={[r, 0.012, 8, 128]} />
            <meshBasicMaterial color="#ff6b61" transparent opacity={0.45} />
          </mesh>
        ))}
      </group>
      <Environment
        files={`${import.meta.env.BASE_URL}environments/studio_small_09_1k.hdr`}
        environmentIntensity={0.85}
        environmentRotation={[0, 0.5, 0]}
        background={false}
      />

      <ContactShadows
        position={[0, -1.25, 0]}
        opacity={0.45}
        scale={14}
        blur={2}
        far={6}
        frames={reduced ? 1 : Infinity}
      />
    </>
  );
}

function TeamPhotoCard({ grade, active }: { grade: Grade; active: boolean }) {
  const art = getTeamArt(grade.id);
  if (!art) return null;
  return (
    <PhotoSurface
      grade={grade}
      active={active}
      image={`${import.meta.env.BASE_URL}${art.image}`}
      country={art.country}
    />
  );
}
function PhotoSurface({
  grade,
  active,
  image,
  country,
}: {
  grade: Grade;
  active: boolean;
  image: string;
  country: string;
}) {
  const photo = useLoader(TextureLoader, image);
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 880;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.roundRect(0, 0, 640, 880, 22);
    ctx.clip();
    const source = photo.image as HTMLImageElement;
    const scale = Math.max(640 / source.width, 880 / source.height);
    const width = source.width * scale,
      height = source.height * scale;
    ctx.drawImage(source, (640 - width) / 2, (880 - height) / 2, width, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, 880);
    gradient.addColorStop(0, "rgba(7,16,20,.25)");
    gradient.addColorStop(0.35, "rgba(7,16,20,0)");
    gradient.addColorStop(0.6, "rgba(7,16,20,.18)");
    gradient.addColorStop(1, "rgba(7,16,20,.97)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 880);
    ctx.fillStyle = COLOR[grade.color] || "#ff6b61";
    ctx.fillRect(38, 647, 56, 4);
    ctx.fillStyle = "#fff";
    ctx.font = "500 19px Arial";
    ctx.fillText(country.toUpperCase(), 38, 53);
    ctx.font = "bold 46px Georgia";
    const words = grade.name.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 565 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const first = lines.length > 1 ? 711 : 740;
    lines.forEach((text, i) => ctx.fillText(text, 38, first + i * 51));
    ctx.font = "22px Arial";
    ctx.fillStyle = "#e8e4dd";
    ctx.fillText(grade.label, 38, 830);
    ctx.strokeStyle = active ? "#ff6b61" : "rgba(255,255,255,.32)";
    ctx.lineWidth = active ? 7 : 3;
    ctx.beginPath();
    ctx.roundRect(3, 3, 634, 874, 21);
    ctx.stroke();
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [photo, grade, active, country]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={[0, 0, 0.073]} name={`team-photo-${grade.id}`}>
      <planeGeometry args={[1.87, 2.57]} />
      <meshBasicMaterial
        map={map}
        transparent
        toneMapped={false}
        color={active ? "#ffffff" : "#dadfe1"}
      />
    </mesh>
  );
}

export function TeamRing({
  grades,
  index,
  onSelect,
  reduced,
  labels = true,
}: {
  grades: Grade[];
  index: number;
  onSelect: (index: number) => void;
  reduced: boolean;
  labels?: boolean;
}) {
  const ring = useRef<Group>(null);
  const step = (Math.PI * 2) / grades.length;
  const radius = 5.8;
  useFrame((_, delta) => {
    if (ring.current)
      ring.current.rotation.y = reduced
        ? -index * step
        : MathUtils.damp(ring.current.rotation.y, -index * step, 6, delta);
  });
  return (
    <>
      <ambientLight intensity={2} />
      <directionalLight position={[0, 4, 8]} intensity={3} />
      <group ref={ring} position={[0, 0, -radius]} name="team-carousel-ring">
        {grades.map((grade, i) => {
          const angle = i * step;
          const active =
            ((Math.round(index) % grades.length) + grades.length) %
              grades.length ===
            i;
          const distance = Math.abs(
            ((((i - Math.round(index)) % grades.length) +
              grades.length +
              grades.length / 2) %
              grades.length) -
              grades.length / 2,
          );
          const nearFront = distance <= 1;
          return (
            <group
              key={grade.id}
              position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
              rotation={[0, angle, 0]}
              visible={nearFront}
              name={`team-card-${grade.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(i);
              }}
            >
              <RoundedBox castShadow args={[1.9, 2.6, 0.12]} radius={0.06}>
                <meshStandardMaterial
                  color={active ? "#e8d8c5" : "#788387"}
                  metalness={0.05}
                  roughness={0.65}
                />
              </RoundedBox>
              {active && (
                <pointLight
                  position={[0, 0, 1.2]}
                  color="#ff6b61"
                  intensity={5}
                  distance={4}
                />
              )}
              {labels && nearFront && (
                <Suspense fallback={null}>
                  <TeamPhotoCard grade={grade} active={active} />
                </Suspense>
              )}
            </group>
          );
        })}
      </group>
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
export default function Scene({
  selected = "all",
  onSelect,
  reduced = false,
  grades,
  index = 0,
  onGrade,
}: {
  selected?: SportScene;
  onSelect?: (sport: SportScene) => void;
  reduced?: boolean;
  grades?: Grade[];
  index?: number;
  onGrade?: (index: number) => void;
}) {
  const [available, setAvailable] = useState(supportsWebGL);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => setVisible(entry.isIntersecting),
            { rootMargin: "100px" },
          );
    if (host.current) observer?.observe(host.current);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [available]);
  const fallback = (
    <div className="scene-fallback" aria-label="Emblema deportivo">
      <span>✦</span>
      <b>2026</b>
      <p>JUNTOS HACEMOS HISTORIA</p>
    </div>
  );
  if (!available) return fallback;
  return (
    <div
      ref={host}
      className="scene-host"
      style={{ height: "100%", width: "100%" }}
    >
      <SceneBoundary fallback={fallback}>
        <Canvas
          aria-label={
            grades
              ? "Carrusel tridimensional de equipos"
              : "Escenario tridimensional con trofeo y balones interactivos"
          }
          shadows
          frameloop={reduced || !visible || !tabVisible ? "demand" : "always"}
          dpr={[1, window.matchMedia("(pointer: coarse)").matches ? 1.25 : 1.5]}
          camera={{ position: grades ? [0, 0.08, 4.6] : [0, 0.8, 9], fov: 40 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl, camera, size }) => {
            gl.setClearColor("#000000", 0);
            if (!grades) {
              camera.position.z = fitSceneDistance(size.width / size.height);
              camera.lookAt(0, 0.35, 0);
            }
            gl.domElement.addEventListener(
              "webglcontextlost",
              (e) => {
                e.preventDefault();
                setAvailable(false);
              },
              { once: true },
            );
          }}
        >
          {grades ? (
            <TeamRing
              grades={grades}
              index={index}
              onSelect={onGrade || (() => {})}
              reduced={reduced}
            />
          ) : (
            <StageWorld
              selected={selected}
              onSelect={onSelect}
              reduced={reduced}
            />
          )}
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
