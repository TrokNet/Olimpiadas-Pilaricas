import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Search,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { COLOR } from "./types";
import type { Tournament } from "./types";
import { delegationData, filterDelegations } from "./delegationData";
import DelegationImage from "./AtlasMedia";
import { AtlasCinematicHero, AtlasJourney } from "./AtlasJourney";
import { motion, useReducedMotion } from "motion/react";
import "./delegations.css";

export default function Delegations({
  data,
  selectedId = "",
}: {
  data: Tournament;
  selectedId?: string;
}) {
  const reduced = Boolean(useReducedMotion());
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [country, setCountry] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const items = delegationData(data);
  const filtered = filterDelegations(items, query, level, country);
  const selected = items.find((item) => item.id === selectedId);
  useEffect(() => {
    if (selectedId) heading.current?.focus();
  }, [selectedId]);
  if (selectedId && !selected)
    return (
      <section className="page-content empty-state">
        <h1>Delegación no encontrada</h1>
        <a className="button coral" href="#delegaciones">
          Volver a las delegaciones
        </a>
      </section>
    );
  if (selected) {
    const sequence = filtered.some((item) => item.id === selected.id)
      ? filtered
      : items;
    const index = sequence.findIndex((item) => item.id === selected.id);
    const previous = sequence[(index - 1 + sequence.length) % sequence.length],
      next = sequence[(index + 1) % sequence.length];
    return (
      <article
        className="franciscan-atlas atlas-detail"
        style={
          {
            "--house-color":
              COLOR[selected.grade.color] || selected.suggestedColor,
          } as CSSProperties
        }
      >
        <nav className="atlas-detail-nav" aria-label="Navegar delegaciones">
          <a href="#delegaciones">
            <ArrowLeft size={17} />
            Todas las delegaciones
          </a>
          <span>
            {index + 1} / {sequence.length}
          </span>
        </nav>
        <div className="atlas-detail-cover">
          <DelegationImage item={selected} eager />
          <span className="atlas-image-caption">
            {selected.photo
              ? selected.photo.place
              : "Ilustración editorial · No representa un lugar confirmado"}
          </span>
          <div className="atlas-detail-title">
            <span>{selected.family}</span>
            <h1 ref={heading} tabIndex={-1}>
              {selected.grade.name}
            </h1>
            <p>
              <MapPin size={15} />
              {selected.location || "Lugar geográfico no indicado"}
            </p>
          </div>
        </div>
        <div className="atlas-detail-body">
          <aside className="atlas-identity">
            <span className="atlas-color-mark" />
            <h2>En nuestras Olimpiadas</h2>
            <strong>{selected.grade.label}</strong>
            <span>Color {selected.grade.color}</span>
            <a href={`#equipo/${selected.id}`}>
              Ver sus partidos <ArrowRight size={15} />
            </a>
            <dl>
              <dt>Lugar de referencia</dt>
              <dd>{selected.country ? selected.placeName : "Por confirmar"}</dd>
              <dt>En la historia</dt>
              <dd>{selected.reference}</dd>
            </dl>
          </aside>
          <section className="atlas-story">
            <span className="atlas-story-family">{selected.family}</span>
            <h2>{selected.title}</h2>
            <p className="atlas-story-lead">{selected.summary}</p>
            <p>{selected.history}</p>
            {selected.id === "cuarto-secundaria" && (
              <p className="atlas-pending">
                Su vínculo con un acontecimiento franciscano particular está
                pendiente de confirmar.
              </p>
            )}
            <div className="atlas-tags">
              {selected.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <figure className="atlas-illustration">
              <DelegationImage item={selected} illustration />
              <figcaption>
                Ilustración editorial del documento aportado. No es una
                fotografía documental.
              </figcaption>
            </figure>
            <details className="atlas-sources">
              <summary>
                <BookOpen size={17} />
                Fuentes y créditos
              </summary>
              <div>
                <p>
                  Guía documental: Delegaciones Franciscanas NSP 2026. Las
                  identidades de grado, casa y color corresponden al calendario
                  vigente.
                </p>
                {selected.sources.map((url) => (
                  <a href={url} key={url} target="_blank" rel="noreferrer">
                    Fuente histórica · {new URL(url).hostname}
                    <ExternalLink size={13} />
                  </a>
                ))}
                {selected.photo && (
                  <>
                    <p>
                      Fotografía: {selected.photo.author} ·{" "}
                      {selected.photo.license}. Referencia del lugar; no es un
                      emblema oficial.
                    </p>
                    <a
                      href={selected.photo.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Fotografía original <ExternalLink size={13} />
                    </a>
                    <a
                      href={selected.photo.licenseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Licencia de uso <ExternalLink size={13} />
                    </a>
                  </>
                )}
                <p>
                  Ilustración extraída del Word proporcionado. Las referencias
                  de fotografías externas del documento no se han copiado sin
                  licencia.
                </p>
              </div>
            </details>
          </section>
        </div>
        {sequence.length > 1 && (
          <nav className="atlas-next" aria-label="Otra delegación">
            <a href={`#delegaciones/${previous.id}`}>
              <ArrowLeft />
              <span>
                <small>Anterior</small>
                {previous.grade.name}
              </span>
            </a>
            <a href={`#delegaciones/${next.id}`}>
              <span>
                <small>Siguiente</small>
                {next.grade.name}
              </span>
              <ArrowRight />
            </a>
          </nav>
        )}
      </article>
    );
  }
  return (
    <section
      className={`franciscan-atlas atlas-scrollytelling ${reduced ? "atlas-motion-reduced" : ""}`}
    >
      <AtlasCinematicHero items={items} reduced={reduced} />
      <div className="atlas-context">
        <span>Dos historias conectadas</span>
        <p>
          La huella de San Francisco de Asís y las raíces de las Franciscanas de
          Montpellier. Cada lugar conserva su propia historia.
        </p>
      </div>
      <AtlasJourney items={items} reduced={reduced} />
      <section
        className="atlas-collection"
        id="atlas-gallery"
        aria-label="Galería de delegaciones"
      >
        <div className="atlas-collection-heading">
          <h2>Encuentra tu historia</h2>
          <span aria-live="polite">{filtered.length} de 15 delegaciones</span>
        </div>
        <div className="atlas-filters">
          <label className="atlas-search">
            <Search size={18} />
            <span className="sr-only">Buscar delegación</span>
            <input
              type="search"
              value={query}
              placeholder="Busca una casa o un grado"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por país</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Todos los países</option>
              {["Italia", "Francia", "Egipto", "Sin ubicación"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="atlas-levels" role="group" aria-label="Nivel escolar">
            {["", "Inicial", "Primaria", "Secundaria", "Exalumnas"].map((l) => (
              <button
                key={l}
                aria-pressed={level === l}
                onClick={() => setLevel(l)}
              >
                {l || "Todas"}
              </button>
            ))}
          </div>
        </div>
        <div className="atlas-gallery">
          {filtered.map((item, index) => (
            <motion.a
              className="atlas-card"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.35, delay: (index % 3) * 0.05 }}
              href={`#delegaciones/${item.id}`}
              key={item.id}
              style={
                {
                  "--house-color":
                    COLOR[item.grade.color] || item.suggestedColor,
                } as CSSProperties
              }
            >
              <div className="atlas-card-image">
                <DelegationImage item={item} />
                <span className="atlas-card-country">
                  <MapPin size={12} />
                  {item.country || "Comunidad escolar"}
                </span>
                {!item.photo && (
                  <span className="atlas-illustration-label">Ilustración</span>
                )}
              </div>
              <div className="atlas-card-content">
                <div className="atlas-card-grade">
                  <span>{item.grade.label}</span>
                  <span>
                    <i />
                    {item.grade.color}
                  </span>
                </div>
                <h3>{item.grade.name}</h3>
                <p>{item.summary}</p>
                <span className="atlas-card-action">
                  Descubrir su historia <ArrowRight size={17} />
                </span>
              </div>
            </motion.a>
          ))}
        </div>
        {!filtered.length && (
          <div className="atlas-empty">
            <h3>No encontramos esa delegación</h3>
            <p>Prueba otro nombre o cambia los filtros.</p>
            <button
              onClick={() => {
                setQuery("");
                setCountry("");
                setLevel("");
              }}
            >
              Ver las 15 delegaciones
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
