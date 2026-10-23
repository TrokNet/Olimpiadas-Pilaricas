import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { COLOR } from "./types";
import type { Delegation } from "./delegationData";
import DelegationImage from "./AtlasMedia";

function jumpTo(id: string, reduced: boolean) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
}
export function AtlasCinematicHero({ reduced }: { items: Delegation[]; reduced: boolean }) {
  return <header className="atlas-cinema-hero" aria-label="Portada del viaje franciscano">
    <div><span className="atlas-edition">HERENCIA FRANCISCANA · NSP 2026</span>
      <h1>Un viaje. <em>Quince historias.</em></h1>
      <p>Descubre los lugares y las raíces que dan nombre a nuestras delegaciones.</p>
    </div>
    <button className="atlas-directory-link" onClick={() => jumpTo("atlas-gallery", reduced)}>Ir al directorio <ArrowDown size={17} /></button>
  </header>;
}
function MovingPhoto({ item }: { item: Delegation }) {
  const target = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-3%", "3%"]);
  return <div ref={target} className="atlas-stage-photo"><motion.div className="atlas-photo-layer" style={{ y }}><DelegationImage item={item} eager /></motion.div></div>;
}
export function AtlasJourney({ items, reduced }: { items: Delegation[]; reduced: boolean }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const item = items[index];
  function select(next: number) {
    setDirection(next >= index ? 1 : -1);
    setIndex((next + items.length) % items.length);
  }
  const transition = { duration: reduced ? 0 : 0.48, ease: "easeInOut" as const };
  return <section id="atlas-journey" className="atlas-journey" aria-label="Recorrido narrativo de las 15 delegaciones" style={{ "--house-color": COLOR[item.grade.color] || item.suggestedColor } as CSSProperties}>
    <div className="atlas-stage">
      <div className="atlas-stage-images">
        <AnimatePresence initial={false}>
          <motion.div key={item.id} className="atlas-stage-image" initial={{ opacity: 0, scale: reduced ? 1 : 1.035 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={transition}>
            {reduced ? <div className="atlas-stage-photo"><DelegationImage item={item} eager /></div> : <MovingPhoto item={item} />}
          </motion.div>
        </AnimatePresence>
        <span className="atlas-stage-location"><MapPin size={13} />{item.location || "Comunidad de exalumnas"}</span>
        <span className="atlas-stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="atlas-stage-editorial">
        <div className="atlas-stage-top"><span>EL ATLAS PILARICO</span><span>{String(index + 1).padStart(2, "0")} / {items.length}</span></div>
        <AnimatePresence initial={false} mode="wait">
          <motion.div key={item.id} className="atlas-stage-story" initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : direction * 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : direction * -12 }} transition={{ ...transition, duration: reduced ? 0 : 0.22 }}>
            <span className="atlas-stage-grade"><i />{item.grade.label} · {item.grade.color}</span>
            <h2>{item.grade.name}</h2>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <a href={`#delegaciones/${item.id}`}>Descubrir su historia <ArrowRight size={16} /></a>
          </motion.div>
        </AnimatePresence>
        <div className="atlas-stage-bottom"><span>{item.family}</span><div><button aria-label="Delegación anterior" onClick={() => select(index - 1)}><ArrowLeft size={19} /></button><button aria-label="Delegación siguiente" onClick={() => select(index + 1)}><ArrowRight size={19} /></button></div></div>
      </div>
    </div>
    <div className="atlas-filmstrip" aria-label="Elegir delegación">
      {items.map((entry, position) => <button key={entry.id} aria-pressed={position === index} onClick={(event) => { select(position); event.currentTarget.scrollIntoView?.({ behavior: reduced ? "instant" : "smooth", block: "nearest", inline: "nearest" }); }}>
        <DelegationImage item={entry} /><span><small>{entry.grade.label}</small>{entry.grade.name}</span>
      </button>)}
    </div>
  </section>;
}
