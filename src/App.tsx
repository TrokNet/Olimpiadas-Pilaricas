import { lazy, Suspense, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  House,
  GitBranch,
  ChartNoAxesColumnIncreasing,
  Church,
  MessagesSquare,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Heart,
  LayoutGrid,
  List,
  MapPin,
  Menu,
  Moon,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sun,
  Trophy,
  Users,
  Volleyball,
  X,
  Goal,
  CircleDot,
  Printer,
  ChevronDown,
} from "lucide-react";
import rawData from "./data/tournament.json";
import OpeningCountdown from "./OpeningCountdown";
import TeamIdentity from "./TeamIdentity";
import Voting from "./Voting";
import useAudience, { audienceVisitorId } from "./useAudience";
import type {
  Entry,
  Filters,
  Grade,
  Match,
  Preferences,
  Tournament,
} from "./types";
import { teamPalette } from "./teamPalette";
import { COLOR, SPORTS } from "./types";
import AttendanceButton from "./AttendanceButton";
import TeamShare from "./TeamShare";
import FanHighlights from "./FanHighlights";
import {
  calendarFile,
  csvFile,
  dayLabel,
  DEFAULT_FILTERS,
  download,
  filterMatches,
  forGrade,
  gradeFor,
  matchName,
  participantLabel,
  restorePreferences,
  status,
  STORAGE_KEY,
  timestamp,
  toggleFavorite,
} from "./lib";
import { Modal } from "./ui";
import Standings from "./Standings";
import SimulationPage from "./SimulationPage";
import ResultManager from "./ResultManager";
import TournamentBoard from "./TournamentBoard";
import GroupsStage from "./GroupsStage";
import { getTeamArt, imageCredits } from "./teamArt";
import type { SportScene } from "./Scene";
const Scene = lazy(() => import("./Scene"));
const Fans = lazy(() => import("./Fans"));
const Delegations = lazy(() => import("./Delegations"));
const data = rawData as Tournament;
const dates = [...new Set(data.matches.map((m) => m.date))];
const sportName = (id: string) =>
  SPORTS.find((s) => s.id === id)?.label || "Reserva de básquet";
function SportIcon({ sport, size = 20 }: { sport: string; size?: number }) {
  return sport.includes("voley") ? (
    <Volleyball size={size} />
  ) : sport.includes("futbol") ? (
    <Goal size={size} />
  ) : (
    <CircleDot size={size} />
  );
}
function Badge({ grade, size = "normal" }: { grade?: Grade; size?: string }) {
  const art = grade ? getTeamArt(grade.id) : undefined;
  return (
    <span
      className={`team-badge ${size} ${art ? "photo-badge" : ""}`}
      title={art ? `${art.place} · Referencia visual` : undefined}
      style={
        {
          "--team-color": COLOR[grade?.color || ""] || "#b9bfc2",
        } as CSSProperties
      }
    >
      {art ? (
        <img
          loading="lazy"
          src={`${import.meta.env.BASE_URL}${art.image}`}
          alt=""
        />
      ) : grade ? (
        grade.name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
      ) : (
        "?"
      )}
    </span>
  );
}
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "inicio");
  useEffect(() => {
    const update = () => setRoute(location.hash.slice(1) || "inicio");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
function initialFilters(): Filters {
  const p = new URLSearchParams(location.search);
  return Object.fromEntries(
    Object.entries(DEFAULT_FILTERS).map(([k, v]) => [k, p.get(k) || v]),
  ) as unknown as Filters;
}
function loadPreferences() {
  try {
    return restorePreferences(localStorage.getItem(STORAGE_KEY), data);
  } catch {
    return restorePreferences(null, data);
  }
}

function MatchCard({
  match,
  compact = false,
  now,
  onOpen,
  order = 0,
}: {
  match: Match;
  compact?: boolean;
  now: number;
  onOpen: (m: Match) => void;
  order?: number;
}) {
  const reduced = useReducedMotion();
  const home = gradeFor(data, match.home_id),
    away = gradeFor(data, match.away_id);
  const isFinal = match.phase.startsWith("FINAL 2");
  return (
    <motion.div
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reduced ? 0 : 0.25,
        delay: reduced ? 0 : Math.min(order, 6) * 0.045,
      }}
    >
      <button
        data-sport={match.sport}
        className={`match-card ${compact ? "compact" : ""} ${isFinal ? "grand-final" : ""} ${match.kind === "RESERVA" ? "reserve" : ""}`}
        onClick={() => onOpen(match)}
        onPointerMove={(e) => {
          if (
            e.pointerType === "mouse" &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--rx",
              `${(e.clientY - r.top - r.height / 2) / -60}deg`,
            );
            e.currentTarget.style.setProperty(
              "--ry",
              `${(e.clientX - r.left - r.width / 2) / 100}deg`,
            );
          }
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.setProperty("--rx", "0deg");
          e.currentTarget.style.setProperty("--ry", "0deg");
        }}
        aria-label={`${sportName(match.sport)}, ${dayLabel(match.date)}, ${match.start}, ${home?.name || participantLabel(match.home_label)} contra ${away?.name || participantLabel(match.away_label)}`}
      >
        <span className="match-top">
          <span className="sport-label">
            <SportIcon sport={match.sport} size={14} />
            {sportName(match.sport)}
          </span>
          <span className="phase-label">
            {isFinal ? "GRAN FINAL" : match.phase}
          </span>
        </span>
        <span className="match-main">
          <span className="match-time">
            <strong>{match.start}</strong>
            <small>hasta {match.end}</small>
          </span>
          <span className="versus">
            <span className="contender">
              <Badge grade={home} />
              <span>
                <strong>
                  {home?.name || participantLabel(match.home_label)}
                </strong>
                <small>{home?.label || "Por definir"}</small>
              </span>
            </span>
            <span className="vs">
              {match.home_score !== null
                ? `${match.home_score} – ${match.away_score}`
                : "VS"}
            </span>
            <span className="contender away">
              <Badge grade={away} />
              <span>
                <strong>
                  {away?.name || participantLabel(match.away_label)}
                </strong>
                <small>{away?.label || "Por definir"}</small>
              </span>
            </span>
          </span>
          <ChevronRight size={20} className="match-arrow" />
        </span>
        <span className="match-bottom">
          <span>
            <MapPin size={12} />
            {match.court.replace(" – ", " · ")}
          </span>
          <span
            className={status(match, now) === "Programado" ? "scheduled" : ""}
          >
            {status(match, now) === "Programado" && <i />}
            {status(match, now)}
          </span>
        </span>
      </button>
    </motion.div>
  );
}

function TeamPicker({
  open,
  onClose,
  mode,
  initial,
  onConfirm,
  reduced,
}: {
  open: boolean;
  onClose: () => void;
  mode: string;
  initial: string | null;
  onConfirm: (id: string) => void;
  reduced: boolean;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      data.grades.findIndex((g) => g.id === initial),
    ),
  );
  const [drag, setDrag] = useState(0);
  const pointer = useRef<number | null>(null);
  const grade =
    data.grades[
      ((index % data.grades.length) + data.grades.length) % data.grades.length
    ];
  useEffect(() => {
    if (open)
      setIndex(
        Math.max(
          0,
          data.grades.findIndex((g) => g.id === initial),
        ),
      );
  }, [open, initial]);
  const move = (delta: number) => setIndex((i) => i + delta);
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "other" ? "Explora otro equipo" : "Tu equipo. Tu emoción."
      }
      description={
        mode === "other"
          ? "Consulta sus partidos sin cambiar tu equipo principal."
          : "Elige tu grado y encuentra todos los encuentros para ir a alentar."
      }
      className="picker-modal"
    >
      <div className="picker-eyebrow">
        <span className="tiny-dot" /> OLIMPIADAS PILARICAS 2026
      </div>
      <div
        className="carousel-stage"
        tabIndex={0}
        role="region"
        aria-label="Selector de equipos. Usa las flechas izquierda y derecha"
        onKeyDown={keyboard}
        onPointerDown={(e) => {
          pointer.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (pointer.current !== null)
            setDrag((pointer.current - e.clientX) / 110);
        }}
        onPointerUp={(e) => {
          if (pointer.current !== null) {
            const offset = (pointer.current - e.clientX) / 110;
            if (Math.abs(offset) > 0.3)
              move(Math.round(offset) || Math.sign(offset));
          }
          pointer.current = null;
          setDrag(0);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(0);
        }}
        onPointerLeave={() => {
          pointer.current = null;
          setDrag(0);
        }}
      >
        <Suspense
          fallback={<div className="scene-loading">Cargando tus equipos…</div>}
        >
          <Scene
            grades={data.grades}
            index={index + drag}
            onGrade={(i) =>
              setIndex(
                (current) =>
                  current +
                  ((((i - current) % data.grades.length) + data.grades.length) %
                    data.grades.length >
                  data.grades.length / 2
                    ? ((((i - current) % data.grades.length) +
                        data.grades.length) %
                        data.grades.length) -
                      data.grades.length
                    : (((i - current) % data.grades.length) +
                        data.grades.length) %
                      data.grades.length),
              )
            }
            reduced={reduced}
          />
        </Suspense>
      </div>
      <div className="picker-navigation">
        <button
          className="icon-button"
          onClick={() => move(-1)}
          aria-label="Equipo anterior"
        >
          <ChevronLeft />
        </button>
        <div aria-live="polite">
          <strong>{grade.name}</strong>
          <span>
            {grade.label} · {grade.color}
          </span>
        </div>
        <button
          className="icon-button"
          onClick={() => move(1)}
          aria-label="Equipo siguiente"
        >
          <ChevronRight />
        </button>
      </div>
      {getTeamArt(grade.id) && (
        <p className="team-place-caption">
          {getTeamArt(grade.id)!.place}
          <span> · {getTeamArt(grade.id)!.country}</span>
        </p>
      )}
      <label className="sr-only" htmlFor="team-list">
        Seleccionar equipo en lista
      </label>
      <select
        id="team-list"
        className="team-list"
        value={grade.id}
        onChange={(e) =>
          setIndex(data.grades.findIndex((g) => g.id === e.target.value))
        }
      >
        {data.grades.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label} · {g.name}
          </option>
        ))}
      </select>
      <button
        className="button coral picker-confirm"
        onClick={() => onConfirm(grade.id)}
      >
        {mode === "other" ? "Ver sus partidos" : "Este es mi equipo"}
        <ArrowRight size={18} />
      </button>
      <p className="picker-note">
        {mode === "other"
          ? "Podrás volver a tu equipo cuando quieras."
          : "Tu elección quedará guardada en este dispositivo."}
      </p>
    </Modal>
  );
}

const Audience = lazy(() => import("./Audience"));

export default function App() {
  useAudience();
  const [data, setData] = useState<Tournament>(rawData as Tournament);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tournament", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          return;
        const live = await response.json();
        if (
          Array.isArray(live.matches) &&
          Array.isArray(live.entries) &&
          Array.isArray(live.grades)
        )
          setData(live);
      })
      .catch(() => {
        /* GitHub Pages conserva el fixture exportado; el simulador funciona sin API. */
      });
    return () => controller.abort();
  }, []);
  const route = useRoute();
  const now = useClock();
  const reduced = Boolean(useReducedMotion());
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [picker, setPicker] = useState(() =>
    !loadPreferences().primary && !location.hash.startsWith("#partido/") && !location.hash.startsWith("#administracion")
      ? "welcome"
      : "",
  );
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("day");
  const [favoriteSport, setFavoriteSport] = useState(SPORTS[0].id);
  const [finalSport, setFinalSport] = useState(() => {
    const requested = new URLSearchParams(location.search).get("sport");
    return SPORTS.find((s) => s.id === requested)?.id || SPORTS[0].id;
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* La consulta sigue disponible sin almacenamiento. */
    }
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs]);
  useEffect(() => {
    if (!prefs.primary) return;
    const controller = new AbortController();
    void fetch("/api/analytics/team-selection", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_id: audienceVisitorId(),
        grade_id: prefs.primary,
      }),
    }).catch(() => {
      /* Team popularity tracking never interrupts the sports experience. */
    });
    return () => controller.abort();
  }, [prefs.primary]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== DEFAULT_FILTERS[k as keyof Filters]) params.set(k, v);
    });
    history.replaceState(
      null,
      "",
      `${location.pathname}${params.size ? "?" + params : ""}${location.hash}`,
    );
  }, [filters]);
  useEffect(() => {
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  }, [route, reduced]);
  const primary = data.grades.find((g) => g.id === prefs.primary);
  const temporary = route.startsWith("equipo/")
    ? data.grades.find((g) => g.id === route.slice(7))
    : undefined;
  const displayed = temporary || primary;
  const delegationGrade = route.startsWith("delegaciones/")
    ? data.grades.find((g) => g.id === route.slice(13)) : undefined;
  const paletteGrade = delegationGrade || displayed;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const palette = teamPalette(paletteGrade, prefs.theme);
    root.dataset.house = paletteGrade?.id || "default";
    Object.entries(palette).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => {
      Object.keys(palette).forEach((key) => root.style.removeProperty(key));
      delete root.dataset.house;
    };
  }, [paletteGrade, prefs.theme]);
  const activeRoute = route.startsWith("partido/")
    ? "partido"
    : route.startsWith("delegaciones/")
      ? "delegaciones"
      : route.startsWith("resultados/")
        ? "resultados"
        : route.startsWith("gestion/")
          ? "gestion"
          : route.startsWith("equipo/")
            ? "inicio"
            : route === "finales"
              ? "eliminatorio"
              : route;
  const selectedMatch = route.startsWith("partido/")
    ? data.matches.find((m) => m.id === route.slice(8))
    : undefined;
  const selectedEntries = displayed
    ? data.entries.filter((e) => e.grade_id === displayed.id)
    : [];
  const teamMatches = displayed
    ? data.matches.filter((m) => forGrade(data, m, displayed.id))
    : [];
  const future = teamMatches.filter(
    (m) => m.kind === "OFICIAL" && timestamp(m, true) >= now,
  );
  const next = future[0];
  const favoriteIds = new Set(Object.values(prefs.favorites).flat());
  const favoriteMatches = data.matches.filter(
    (m) => favoriteIds.has(m.home_id || "") || favoriteIds.has(m.away_id || ""),
  );
  const filtered = useMemo(
    () => filterMatches(data, filters, data.matches, new Date(now)),
    [filters, now],
  );
  const openMatch = (m: Match) => {
    location.hash = `partido/${m.id}`;
  };
  const addFavorite = (entry: Entry) => {
    const result = toggleFavorite(prefs.favorites, entry.sport, entry.id);
    if (result.limited)
      setToast(
        "Puedes guardar hasta 3 favoritos en esta disciplina. Quita uno para añadir otro.",
      );
    else setPrefs((p) => ({ ...p, favorites: result.favorites }));
  };
  const changeFilter = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const selectSport = (sport: SportScene) => {
    setFilters({
      ...DEFAULT_FILTERS,
      sport:
        sport === "football"
          ? "futbol-masculino"
          : sport === "volleyball"
            ? "voley-masculino"
            : sport === "basketball"
              ? "basquet-masculino"
              : "",
    });
    location.hash = "fixture";
  };
  const share = async (m: Match) => {
    const url = new URL(location.href);
    url.hash = `partido/${m.id}`;
    url.search = "";
    try {
      if (navigator.share)
        await navigator.share({
          title: `${matchName(data, m.home_id, m.home_label)} vs ${matchName(data, m.away_id, m.away_label)}`,
          url: url.href,
        });
      else {
        await navigator.clipboard.writeText(url.href);
        setToast("Enlace del partido copiado.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setToast(
          "Copia el enlace desde la barra de direcciones para compartirlo.",
        );
    }
  };
  const pageMatches =
    activeRoute === "favoritos"
      ? favoriteMatches
      : activeRoute === "inicio"
        ? teamMatches
        : filtered;
  const grouped = new Map<string, Match[]>();
  pageMatches.forEach((m) => {
    const key = view === "court" ? m.court : m.date;
    grouped.set(key, [...(grouped.get(key) || []), m]);
  });
  const controls = (
    <div className="filter-fields">
      <label>
        Disciplina
        <select
          value={filters.sport}
          onChange={(e) => changeFilter("sport", e.target.value)}
        >
          <option value="">Todas las disciplinas</option>
          {SPORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value="basquet-reserva">Básquet · reservas</option>
        </select>
      </label>
      <label>
        Equipo / grado
        <select
          value={filters.grade}
          onChange={(e) => changeFilter("grade", e.target.value)}
        >
          <option value="">Todos los equipos</option>
          {data.grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Grupo
        <select
          value={filters.group}
          onChange={(e) => changeFilter("group", e.target.value)}
        >
          <option value="">Todos los grupos</option>
          {["A", "B", "C", "D", "X"].map((g) => (
            <option key={g} value={`GRUPO ${g}`}>
              {g === "X" ? "Reservas" : `Grupo ${g}`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cancha
        <select
          value={filters.court}
          onChange={(e) => changeFilter("court", e.target.value)}
        >
          <option value="">Todas las canchas</option>
          {[...new Set(data.matches.map((m) => m.court))].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fase
        <select
          value={filters.phase}
          onChange={(e) => changeFilter("phase", e.target.value)}
        >
          <option value="">Todas las fases</option>
          <option value="GRUPO">Grupos</option>
          <option value="SEMIFINAL">Semifinales</option>
          <option value="FINAL">Finales</option>
        </select>
      </label>
      <label>
        Desde las
        <input
          type="time"
          value={filters.hour}
          onChange={(e) => changeFilter("hour", e.target.value)}
        />
      </label>
    </div>
  );
  const listMatches = (matches: Match[], compact = false) =>
    matches.length ? (
      <AnimatePresence initial={false}>
        {matches.map((m, order) => (
          <MatchCard
            key={m.id}
            match={m}
            compact={compact}
            now={now}
            onOpen={openMatch}
            order={order}
          />
        ))}
      </AnimatePresence>
    ) : (
      <div className="empty-state">
        <CalendarDays />
        <h3>No hay partidos con esta selección</h3>
        <p>
          Prueba otra fecha o cambia los filtros para explorar más encuentros.
        </p>
      </div>
    );

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("contenido")?.focus();
        }}
      >
        Ir al contenido
      </a>
      <header className="site-header">
        <a href="#inicio" className="brand" aria-label="Pilaricas 2026 inicio">
          <span className="brand-icon">
            <Trophy size={23} />
          </span>
          <span>
            PILARICAS
            <span className="brand-year">
              2026
              <span className="brand-line" />
            </span>
          </span>
        </a>
        <nav
          id="main-navigation"
          className={mobileMenu ? "open" : ""}
          aria-label="Navegación principal"
        >
          {([
            ["inicio", "Mi equipo", House],
            ["fixture", "Calendario de partidos", CalendarDays],
            ["favoritos", "Favoritos", Heart],
            ["grupos", "Grupos", Users],
            ["eliminatorio", "Eliminatorias", GitBranch],
            ["resultados", "Resultados", ChartNoAxesColumnIncreasing],
            ["gestion", "Simulación", SlidersHorizontal],
            ["delegaciones", "Delegaciones Franciscanas", Church],
            ["fans", "Fans", MessagesSquare],
          ] as const).map(([id, label, Icon]) => (
            <a
              key={id}
              className={activeRoute === id ? "active" : ""}
              href={`#${id}`}
              aria-current={activeRoute === id ? "page" : undefined}
            >
              <Icon className="navigation-icon" size={21} strokeWidth={1.65} aria-hidden="true" />
              <span>{label}</span>
              {id === "favoritos" && favoriteIds.size > 0 && (
                <small>{favoriteIds.size}</small>
              )}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button theme-toggle"
            aria-label={
              prefs.theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"
            }
            onClick={() =>
              setPrefs((p) => ({
                ...p,
                theme: p.theme === "dark" ? "light" : "dark",
              }))
            }
          >
            {prefs.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="header-team"
            onClick={() => setPicker("primary")}
            aria-label="Cambiar mi equipo principal"
          >
            <Badge grade={primary} size="small" />
            <span>{primary?.name || "Mi equipo"}</span>
            <ChevronDown size={13} />
          </button>
          <button
            className="icon-button mobile-nav"
            onClick={() => setMobileMenu((v) => !v)}
            aria-label="Abrir navegación"
            aria-controls="main-navigation"
            aria-expanded={mobileMenu}
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <Voting data={data} />
      <main id="contenido" tabIndex={-1}>
        {activeRoute === "inicio" && (
          <>
            {temporary && (
              <div className="exploring-bar">
                <span>
                  <Users size={16} />
                  Explorando {temporary.name} · {temporary.label}
                </span>
                <a href="#inicio">
                  <ArrowLeft size={14} />
                  Volver a mi equipo
                </a>
              </div>
            )}
            <section className={`hero ${displayed?.id === "tercero-secundaria" ? "hero-mailhac" : ""}`}>
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-dot" /> 31 OCT — 08 NOV · LIMA, PERÚ
                </div>
                <h1>
                  {displayed ? (
                    <>
                      {displayed.name
                        .split(" ")
                        .slice(
                          0,
                          Math.ceil(displayed.name.split(" ").length / 2),
                        )
                        .join(" ")}
                      <br />
                      <em>
                        {displayed.name
                          .split(" ")
                          .slice(
                            Math.ceil(displayed.name.split(" ").length / 2),
                          )
                          .join(" ") || "2026"}
                        <span className="coral-dot">.</span>
                      </em>
                    </>
                  ) : (
                    <>
                      UN COLEGIO.
                      <br />
                      <em>MIL MOTIVOS</em>
                      <br />
                      PARA ALENTAR<span className="coral-dot">.</span>
                    </>
                  )}
                </h1>
                <p className="hero-subtitle">
                  {displayed ? (
                    <>
                      <strong>{displayed.label}</strong>
                      <span className="subtitle-line" />
                      Todos tus partidos. Una sola pasión.
                    </>
                  ) : (
                    "Elige tu equipo, encuentra sus partidos y vive cada encuentro de las Olimpiadas Pilaricas."
                  )}
                </p>
                <div className="hero-buttons">
                  <button
                    className="button coral"
                    onClick={() =>
                      displayed
                        ? document
                            .getElementById("calendario-equipo")
                            ?.scrollIntoView({
                              behavior: reduced ? "instant" : "smooth",
                            })
                        : setPicker("primary")
                    }
                  >
                    {displayed ? "Ver mis partidos" : "Elige tu equipo"}
                    <ArrowDown size={17} />
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => setPicker("other")}
                  >
                    Ver otro equipo
                    <ArrowRight size={17} />
                  </button>
                </div>
                {displayed && <TeamIdentity data={data} teamId={displayed.id} />}
                <OpeningCountdown />
              </div>
              <div className="hero-visual">
                <img
                  className="hero-photo"
                  src={`${import.meta.env.BASE_URL}images/${displayed?.id === "tercero-secundaria" ? "mailhac-hero.webp" : "stadium-hero-v2.webp"}`}
                  srcSet={displayed?.id === "tercero-secundaria" ? undefined : `${import.meta.env.BASE_URL}images/stadium-hero-v2-small.webp 800w, ${import.meta.env.BASE_URL}images/stadium-hero-v2.webp 1448w`}
                  sizes="(max-width: 640px) 100vw, 50vw"
                  width={1448}
                  height={1086}
                  fetchPriority="high"
                  alt="Trofeo dorado con balones de fútbol, vóley y básquet en una cancha iluminada"
                />
                <div className="scene-sports">
                  {[
                    ["football", "Fútbol"],
                    ["volleyball", "Vóley"],
                    ["basketball", "Básquet"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => selectSport(id as SportScene)}
                    >
                      <SportIcon
                        sport={
                          id === "football"
                            ? "futbol"
                            : id === "volleyball"
                              ? "voley"
                              : "basquet"
                        }
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="stat-strip" aria-label="El torneo en números">
              <div>
                <span className="stat-icon" aria-hidden="true"><Trophy size={21} /></span>
                <b>03</b>
                <span>
                  Deportes que
                  <br />
                  nos mueven
                </span>
              </div>
              <div>
                <span className="stat-icon" aria-hidden="true"><Users size={21} /></span>
                <b>{String(data.grades.length).padStart(2, "0")}</b>
                <span>
                  Equipos.
                  <br />
                  Una comunidad.
                </span>
              </div>
              <div>
                <span className="stat-icon" aria-hidden="true"><CalendarDays size={21} /></span>
                <b>
                  {displayed
                    ? teamMatches.length
                    : data.matches.filter((m) => m.kind === "OFICIAL").length}
                </b>
                <span>
                  {displayed ? "Partidos para" : "Encuentros para"}
                  <br />
                  alentar juntos
                </span>
              </div>
              <div className="stat-message">
                <span className="stat-icon" aria-hidden="true"><Heart size={21} /></span>
                <span>
                  Tu voz también
                  <br />
                  <strong>juega en la cancha.</strong>
                </span>
              </div>
            </section>
            {next && (
              <section className="next-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow coral-text">
                      QUE NO SE TE PASE
                    </span>
                    <h2>La próxima cita.</h2>
                  </div>
                  <span className="countdown">
                    {Math.ceil(Math.max(0, timestamp(next) - now) / 86400000)}{" "}
                    días para alentar
                  </span>
                </div>
                <div className="next-match">
                  <div className="next-date">
                    <b>{new Date(`${next.date}T12:00:00`).getDate()}</b>
                    <span>
                      {next.date.slice(5, 7) === "10" ? "OCTUBRE" : "NOVIEMBRE"}
                    </span>
                  </div>
                  <div className="next-info">
                    <span className="sport-label">
                      <SportIcon sport={next.sport} />
                      {sportName(next.sport)} · {next.phase}
                    </span>
                    <h3>
                      {matchName(data, next.home_id, next.home_label)}{" "}
                      <em>vs</em>{" "}
                      {matchName(data, next.away_id, next.away_label)}
                    </h3>
                    <p>
                      <Clock3 size={15} />
                      {next.start}–{next.end}
                      <MapPin size={15} />
                      {next.court}
                    </p>
                  </div>
                  <button
                    className="button outline"
                    onClick={() => openMatch(next)}
                  >
                    Ver partido
                    <ArrowRight size={18} />
                  </button>
                  <AttendanceButton matchId={next.id} />
                </div>
              </section>
            )}
            {displayed && !temporary && (
              <section className="team-share-section">
                <div>
                  <span className="eyebrow coral-text">LLENA LA TRIBUNA</span>
                  <h2>Que nadie se pierda un partido.</h2>
                  <p>Comparte el fixture de {displayed.name} y lleva sus fechas en tu calendario.</p>
                </div>
                <div className="team-share-actions">
                  <TeamShare grade={displayed} matches={teamMatches} data={data} onNotice={setToast} />
                  <button className="button outline" onClick={() => download(calendarFile(data, teamMatches), `calendario-${displayed.id}.ics`, "text/calendar")}>
                    <CalendarDays size={17} /> Añadir a mi calendario
                  </button>
                </div>
              </section>
            )}
            <section className="schedule-section" id="calendario-equipo">
              <div className="section-heading">
                <div>
                  <span className="eyebrow coral-text">
                    EN LAS BUENAS Y EN TODAS
                  </span>
                  <h2>
                    {displayed
                      ? "Tu calendario para alentar."
                      : "Todos los encuentros."}
                  </h2>
                  <p>
                    {displayed
                      ? `${displayed.name} · ${displayed.label} · ${selectedEntries.length} categorías`
                      : "Encuentra los partidos de tu equipo o explora el calendario completo."}
                  </p>
                </div>
                <div className="heading-actions">
                  <button
                    className="icon-button"
                    aria-label="Cambiar equipo principal"
                    onClick={() => setPicker("primary")}
                  >
                    <Settings2 size={20} />
                  </button>
                  <button
                    className="button outline"
                    onClick={() =>
                      download(
                        calendarFile(data, teamMatches),
                        "mi-equipo.ics",
                        "text/calendar",
                      )
                    }
                  >
                    Calendario
                    <Download size={16} />
                  </button>
                </div>
              </div>
              {displayed ? (
                <>
                  <div className="participation-chips">
                    {selectedEntries.map((entry) => (
                      <span key={entry.id}>
                        <SportIcon sport={entry.sport} size={15} />
                        {sportName(entry.sport)}
                        <small>TEAM {entry.team_number}</small>
                      </span>
                    ))}
                  </div>
                  {dates.map((date) => {
                    const matches = teamMatches.filter((m) => m.date === date);
                    return matches.length > 0 ? (
                      <div className="match-day" key={date}>
                        <h3>
                          {dayLabel(date)}
                          <span>{matches.length} partidos</span>
                        </h3>
                        {listMatches(matches)}
                      </div>
                    ) : null;
                  })}
                </>
              ) : (
                <div className="empty-state">
                  <Users />
                  <h3>Tu hinchada empieza aquí</h3>
                  <p>
                    Selecciona un equipo para ver todos sus partidos
                    personalizados.
                  </p>
                  <button
                    className="button coral"
                    onClick={() => setPicker("primary")}
                  >
                    Elegir mi equipo
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
            <FanHighlights grades={data.grades} />
          </>
        )}

        {activeRoute === "fixture" && (
          <section className="page-content">
            <div className="page-heading">
              <span className="eyebrow coral-text">CADA PARTIDO CUENTA</span>
              <h1>
                Calendario de partidos<span className="coral-dot">.</span>
              </h1>
              <p>Todos los encuentros. Encuentra dónde y cuándo alentar.</p>
            </div>
            <div className="fixture-toolbar">
              <div className="search-input">
                <Search size={18} />
                <input
                  aria-label="Buscar equipo, grado o cancha"
                  placeholder="Busca un equipo, grado o cancha…"
                  value={filters.query}
                  onChange={(e) => changeFilter("query", e.target.value)}
                />
                {filters.query && (
                  <button
                    className="icon-button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => changeFilter("query", "")}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                className="button outline filter-button"
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={16} />
                Filtros
              </button>
              <button
                className="icon-button"
                aria-label="Imprimir calendario de partidos"
                onClick={() => window.print()}
              >
                <Printer size={19} />
              </button>
            </div>
            <div className={`filter-panel ${showFilters ? "visible" : ""}`}>
              <div className="filter-mobile-heading">
                <h3>Filtra los partidos</h3>
                <button
                  className="icon-button"
                  onClick={() => setShowFilters(false)}
                  aria-label="Cerrar filtros"
                >
                  <X />
                </button>
              </div>
              {controls}
              <div className="filter-bottom">
                <button
                  className="text-button"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                >
                  Limpiar filtros
                </button>
                <button
                  className="button coral mobile-apply"
                  onClick={() => setShowFilters(false)}
                >
                  Ver {filtered.length}{" "}
                  {filtered.length === 1 ? "encuentro" : "encuentros"}
                </button>
              </div>
            </div>
            <div className="date-tabs" aria-label="Filtrar fecha">
              <button
                className={!filters.date ? "active" : ""}
                onClick={() => changeFilter("date", "")}
              >
                Todas las
                <br />
                <strong>fechas</strong>
              </button>
              {dates.map((date) => (
                <button
                  key={date}
                  onClick={() => changeFilter("date", date)}
                  className={filters.date === date ? "active" : ""}
                >
                  <span>{dayLabel(date, false).split(",")[0]}</span>
                  <strong>
                    {date.slice(8)} {date.slice(5, 7) === "10" ? "OCT" : "NOV"}
                  </strong>
                </button>
              ))}
            </div>
            <div className="results-toolbar">
              <div className="quick-filters">
                {[
                  ["all", "Todos"],
                  ["today", "Hoy"],
                  ["upcoming", "Próximos"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={filters.period === value ? "active" : ""}
                    onClick={() => changeFilter("period", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "encuentro" : "encuentros"}
              </span>
              <div className="view-switch">
                <button
                  className={view === "day" ? "active" : ""}
                  aria-label="Por día"
                  onClick={() => setView("day")}
                >
                  <CalendarDays size={17} />
                </button>
                <button
                  className={view === "list" ? "active" : ""}
                  aria-label="Lista compacta"
                  onClick={() => setView("list")}
                >
                  <List size={17} />
                </button>
                <button
                  className={view === "court" ? "active" : ""}
                  aria-label="Por cancha"
                  onClick={() => setView("court")}
                >
                  <LayoutGrid size={17} />
                </button>
              </div>
              <button
                className="icon-button"
                aria-label="Exportar CSV filtrado"
                onClick={() =>
                  download(
                    csvFile(data, filtered),
                    "calendario-de-partidos.csv",
                    "text/csv",
                  )
                }
              >
                <Download size={17} />
              </button>
            </div>
            {filtered.length === 0
              ? listMatches([])
              : view === "list"
                ? listMatches(filtered, true)
                : [...grouped].map(([key, matches]) => (
                    <div className="match-day" key={key}>
                      <h3>
                        {view === "court" ? key : dayLabel(key)}
                        <span>
                          {matches.length}{" "}
                          {matches.length === 1 ? "encuentro" : "encuentros"}
                        </span>
                      </h3>
                      {listMatches(matches)}
                    </div>
                  ))}
          </section>
        )}

        {activeRoute === "favoritos" && (
          <section className="page-content">
            <div className="page-heading">
              <span className="eyebrow coral-text">
                MÁS EQUIPOS, MÁS EMOCIÓN
              </span>
              <h1>
                Tu tribuna<span className="coral-dot">.</span>
              </h1>
              <p>
                Guarda hasta tres favoritos por categoría y sigue sus próximos
                encuentros.
              </p>
            </div>
            <div
              className="sport-tabs"
              role="group"
              aria-label="Categoría de favoritos"
            >
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  className={favoriteSport === s.id ? "active" : ""}
                  onClick={() => setFavoriteSport(s.id)}
                >
                  <SportIcon sport={s.id} size={17} />
                  {s.label}
                  <small>{(prefs.favorites[s.id] || []).length}/3</small>
                </button>
              ))}
            </div>
            <div className="favorite-heading">
              <h2>Elige a quién alentar</h2>
              <span>
                {(prefs.favorites[favoriteSport] || []).length} de 3 favoritos
              </span>
            </div>
            <div className="favorite-grid">
              {data.entries
                .filter((e) => e.sport === favoriteSport)
                .map((entry) => {
                  const grade = data.grades.find(
                    (g) => g.id === entry.grade_id,
                  )!;
                  const saved = (prefs.favorites[entry.sport] || []).includes(
                    entry.id,
                  );
                  return (
                    <button
                      key={entry.id}
                      className={`favorite-team ${saved ? "selected" : ""}`}
                      onClick={() => addFavorite(entry)}
                      aria-pressed={saved}
                    >
                      <Badge grade={grade} />
                      <span>
                        <strong>{grade.name}</strong>
                        <small>
                          {grade.label} · TEAM {entry.team_number}
                        </small>
                      </span>
                      <Heart size={19} fill={saved ? "currentColor" : "none"} />
                    </button>
                  );
                })}
            </div>
            <div className="section-heading favorite-calendar-title">
              <div>
                <span className="eyebrow coral-text">
                  TODOS EN LA MISMA TRIBUNA
                </span>
                <h2>Partidos de tus favoritos.</h2>
              </div>
              <button
                className="button outline"
                disabled={!favoriteMatches.length}
                onClick={() =>
                  download(
                    calendarFile(data, favoriteMatches),
                    "favoritos.ics",
                    "text/calendar",
                  )
                }
              >
                Calendario
                <Download size={16} />
              </button>
            </div>
            {favoriteMatches.length ? (
              dates.map((date) => {
                const matches = favoriteMatches.filter((m) => m.date === date);
                return matches.length > 0 ? (
                  <div className="match-day" key={date}>
                    <h3>
                      {dayLabel(date)}
                      <span>{matches.length} partidos</span>
                    </h3>
                    {listMatches(matches)}
                  </div>
                ) : null;
              })
            ) : (
              <div className="empty-state">
                <Heart />
                <h3>Tu tribuna está por llenarse</h3>
                <p>
                  Marca el corazón de un equipo para empezar a seguir sus
                  partidos.
                </p>
              </div>
            )}
          </section>
        )}

        {(activeRoute === "grupos" || activeRoute === "eliminatorio") && (
          <section className="page-content tournament-stage-page">
            <div className="page-heading stage-page-heading">
              <div>
                <h1>
                  {activeRoute === "grupos" ? "Grupos" : "Eliminatorias"}
                  <span className="coral-dot">.</span>
                </h1>
                <p>
                  {activeRoute === "grupos"
                    ? "Sigue las posiciones y cada encuentro de tu disciplina."
                    : "Dos semifinales. Una final. El camino hacia la copa."}
                </p>
              </div>
              <a
                className="stage-other-view"
                href={activeRoute === "grupos" ? "#eliminatorio" : "#grupos"}
              >
                {activeRoute === "grupos" ? "Ver eliminatorias" : "Ver grupos"}
                <ArrowRight size={18} />
              </a>
            </div>
            <div
              className="sport-tabs"
              role="group"
              aria-label="Disciplina del torneo"
            >
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={finalSport === s.id}
                  className={finalSport === s.id ? "active" : ""}
                  onClick={() => setFinalSport(s.id)}
                >
                  <SportIcon sport={s.id} size={16} />
                  {s.label}
                </button>
              ))}
            </div>
            {activeRoute === "grupos" ? (
              <GroupsStage
                key={finalSport}
                data={data}
                sport={finalSport}
                onMatch={openMatch}
                onGroup={(group) => {
                  setFilters({ ...DEFAULT_FILTERS, sport: finalSport, group });
                  location.hash = "fixture";
                }}
              />
            ) : (
              <TournamentBoard
                data={data}
                sport={finalSport}
                onMatch={openMatch}
                mode="knockout"
              />
            )}
          </section>
        )}

        {activeRoute === "delegaciones" && (
          <Suspense
            fallback={
              <section className="page-content" role="status">
                Cargando delegaciones…
              </section>
            }
          >
            <Delegations
              data={data}
              selectedId={
                route.startsWith("delegaciones/") ? route.slice(13) : ""
              }
            />
          </Suspense>
        )}
        {activeRoute === "administracion" && (
          <Suspense fallback={<section className="page-content" role="status">Cargando estadísticas…</section>}>
            <Audience data={data} onUpdate={setData} />
          </Suspense>
        )}
        {activeRoute === "fans" && (
          <Suspense
            fallback={
              <section className="page-content" role="status">
                Cargando Fans…
              </section>
            }
          >
            <Fans data={data} initialTeamId={prefs.primary || ""} />
          </Suspense>
        )}
        {activeRoute === "gestion" && (
          <SimulationPage
            data={data}
            initialMatchId={route.startsWith("gestion/") ? route.slice(8) : ""}
          />
        )}
        {activeRoute === "resultados" && (
          <section className="page-content">
            <div className="page-heading">
              <span className="eyebrow coral-text">
                LA HISTORIA DE CADA ENCUENTRO
              </span>
              <h1>
                {route === "resultados/registrar"
                  ? "Registrar resultados"
                  : "Resultados"}
                <span className="coral-dot">.</span>
              </h1>
              <p>
                {route === "resultados/registrar"
                  ? "Guarda los resultados de tu equipo y actualiza las posiciones."
                  : "Los marcadores se mostrarán cuando se confirmen."}
              </p>
            </div>
            <nav
              className="results-options"
              aria-label="Opciones de resultados"
            >
              <a
                href="#resultados"
                aria-current={
                  route !== "resultados/registrar" ? "page" : undefined
                }
              >
                Ver resultados
              </a>
              <a
                href="#resultados/registrar"
                aria-current={
                  route === "resultados/registrar" ? "page" : undefined
                }
              >
                Registrar resultados
              </a>
            </nav>
            {route === "resultados/registrar" ? (
              <ResultManager
                data={data}
                onUpdate={setData}
                initialTeamId={prefs.primary || ""}
                initialMode="register"
                embedded
              />
            ) : data.matches.some(
                (m) => m.home_score !== null && m.away_score !== null,
              ) ? (
              <>
                {listMatches(
                  data.matches.filter(
                    (m) => m.home_score !== null && m.away_score !== null,
                  ),
                )}
                <Standings data={data} />
              </>
            ) : (
              <div className="empty-state results-empty">
                <Trophy size={54} />
                <h2>La emoción está por comenzar.</h2>
                <p>
                  Resultados pendientes. Aquí encontrarás los marcadores
                  oficiales de cada partido cuando estén disponibles.
                </p>
                <a href="#fixture" className="button coral">
                  Explorar el calendario de partidos
                  <ArrowRight size={17} />
                </a>
              </div>
            )}
          </section>
        )}

        {activeRoute === "partido" && !selectedMatch && (
          <section className="page-content empty-state">
            <h1>Partido no encontrado</h1>
            <p>El encuentro pudo cambiar con la última actualización.</p>
            <a className="button coral" href="#fixture">
              Volver al calendario de partidos
            </a>
          </section>
        )}
        {selectedMatch && (
          <section className="page-content match-detail">
            <a href="#fixture" className="back-link">
              <ArrowLeft size={16} />
              Volver al calendario de partidos
            </a>
            <div className="detail-heading">
              <span className="eyebrow coral-text">
                <SportIcon sport={selectedMatch.sport} />
                {sportName(selectedMatch.sport)}
              </span>
              <h1>
                {selectedMatch.phase === "FINAL 2"
                  ? "La gran final"
                  : selectedMatch.phase}
              </h1>
              <span className="detail-status">
                {status(selectedMatch, now)}
              </span>
            </div>
            <div className="detail-versus">
              {[selectedMatch.home_id, selectedMatch.away_id].map((id, i) => {
                const grade = gradeFor(data, id);
                return (
                  <motion.div
                    className="detail-team"
                    key={`${selectedMatch.id}-${i}`}
                    initial={
                      reduced ? false : { opacity: 0, x: i === 0 ? -35 : 35 }
                    }
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: i * 0.1 }}
                  >
                    {grade && getTeamArt(grade.id) ? (
                      <div className="heritage-emblem">
                        <img
                          src={`${import.meta.env.BASE_URL}${getTeamArt(grade.id)!.image}`}
                          alt={getTeamArt(grade.id)!.place}
                        />
                        <span>OLIMPIADAS · 2026</span>
                      </div>
                    ) : (
                      <Badge grade={grade} size="huge" />
                    )}
                    <h2>
                      {grade?.name ||
                        (i === 0
                          ? participantLabel(selectedMatch.home_label)
                          : participantLabel(selectedMatch.away_label))}
                    </h2>
                    <p>{grade?.label || "Pendiente de clasificación"}</p>
                    {id && (
                      <button
                        className="text-button"
                        onClick={() => {
                          if (grade) location.hash = `equipo/${grade.id}`;
                        }}
                      >
                        Ver equipo
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
              <span className="detail-vs">
                {selectedMatch.home_score !== null
                  ? `${selectedMatch.home_score} – ${selectedMatch.away_score}`
                  : "VS"}
              </span>
            </div>
            <div className="detail-info">
              <div>
                <CalendarDays />
                <span>
                  Fecha<strong>{dayLabel(selectedMatch.date)}</strong>
                </span>
              </div>
              <div>
                <Clock3 />
                <span>
                  Horario
                  <strong>
                    {selectedMatch.start}–{selectedMatch.end}
                  </strong>
                </span>
              </div>
              <div>
                <MapPin />
                <span>
                  Cancha<strong>{selectedMatch.court}</strong>
                </span>
              </div>
            </div>
            <div className="detail-actions">
              <AttendanceButton matchId={selectedMatch.id} />
              <a
                className="button outline"
                href={`#gestion/${selectedMatch.id}`}
              >
                Simular resultado
              </a>
              <button
                className="button coral"
                onClick={() => share(selectedMatch)}
              >
                <Share2 size={18} />
                Compartir partido
              </button>
              <button
                className="button outline"
                onClick={() =>
                  download(
                    calendarFile(data, [selectedMatch]),
                    "partido.ics",
                    "text/calendar",
                  )
                }
              >
                <CalendarDays size={18} />
                Añadir al calendario
              </button>
            </div>
            <p className="detail-note">
              Horarios de Perú · Calendario preliminar de Olimpiadas Pilaricas
              2026
              <br />
              Imágenes del patrimonio que inspira los nombres · No son escudos
              oficiales
            </p>
          </section>
        )}
        {activeRoute === "imagenes" && (
          <section className="page-content image-credits">
            <span className="eyebrow coral-text">NUESTRA INSPIRACIÓN</span>
            <h1>
              Lugares con historia.
              <br />
              Equipos con identidad.
            </h1>
            <p>
              Referencias visuales del patrimonio religioso y de los lugares que
              dan nombre a los equipos. Las fotografías no representan escudos
              oficiales. Los nombres y las correspondencias del torneo se
              conservan.
            </p>
            <p>
              Imagen deportiva de portada creada con IA para Olimpiadas
              Pilaricas 2026.
            </p>
            <div className="credits-grid">
              {imageCredits().map(([id, art]) => (
                <article key={id}>
                  <img
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}${art.image}`}
                    alt={art.place}
                  />
                  <div>
                    <h2>{data.grades.find((g) => g.id === id)?.name}</h2>
                    <p>
                      {art.place} · {art.country}
                    </p>
                    <p>
                      {art.author} ·{" "}
                      <a href={art.licenseUrl} target="_blank" rel="noreferrer">
                        {art.license}
                      </a>
                    </p>
                    <a href={art.source} target="_blank" rel="noreferrer">
                      Ver fotografía original ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {![
          "inicio",
          "fixture",
          "favoritos",
          "grupos",
          "eliminatorio",
          "resultados",
          "gestion",
          "delegaciones",
          "fans",
          "partido",
          "imagenes",
          "administracion",
        ].includes(activeRoute) && (
          <section className="page-content empty-state">
            <h2>Página no encontrada</h2>
            <a href="#inicio" className="button coral">
              Volver a mi equipo
            </a>
          </section>
        )}
      </main>
      <footer>
        <div className="footer-cta">
          <Trophy size={34} />
          <p>
            La mejor jugada es
            <br />
            <strong>estar juntos.</strong>
          </p>
          <a href="#fixture" className="button coral">
            Nos vemos en la cancha
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="footer-bottom">
          <div className="footer-identity">
            <span className="footer-brand">
              OLIMPIADAS PILARICAS <strong>2026</strong>
            </span>
            <span className="footer-contact">
              Comentarios, sugerencias o errores al{" "}
              <a href="tel:+51961208028">+51 961-208-028</a>
            </span>
          </div>
          <p>
            Horarios de Perú · Actualizado{" "}
            {new Intl.DateTimeFormat("es-PE", {
              timeZone: "America/Lima",
              dateStyle: "short",
            }).format(new Date(data.metadata.imported_at))}
          </p>
          <a href="#administracion" className="text-button">
            <ChartNoAxesColumnIncreasing size={15} aria-hidden="true" /> Administración
          </a>
          <a href="#imagenes" className="text-button">
            Imágenes y créditos ↗
          </a>
          <button className="text-button" onClick={() => setPicker("primary")}>
            Cambiar mi equipo
          </button>
        </div>
      </footer>
      <TeamPicker
        open={!!picker}
        mode={picker}
        initial={picker === "other" ? displayed?.id || null : prefs.primary}
        onClose={() => setPicker("")}
        onConfirm={(id) => {
          if (picker === "other") location.hash = `equipo/${id}`;
          else {
            setPrefs((p) => ({ ...p, primary: id }));
            location.hash = "inicio";
          }
          setPicker("");
        }}
        reduced={reduced}
      />
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Check size={17} />
            {toast}
            <button onClick={() => setToast("")} aria-label="Cerrar aviso">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
