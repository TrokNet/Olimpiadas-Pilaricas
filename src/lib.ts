import type {
  Tournament,
  Match,
  Filters,
  Preferences,
  Favorites,
} from "./types";
export const DEFAULT_FILTERS: Filters = {
  sport: "",
  date: "",
  grade: "",
  group: "",
  court: "",
  phase: "",
  query: "",
  period: "all",
  hour: "",
};
export const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  primary: null,
  favorites: {},
  theme: "dark",
};
export const STORAGE_KEY = "pilaricas-2026-v1";
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function gradeFor(data: Tournament, id: string | null) {
  const entry = data.entries.find((e) => e.id === id);
  return data.grades.find((g) => g.id === entry?.grade_id);
}
export function participantLabel(label: string) {
  return label.replace(
    /^Perdedor Semifinal\s*(\d+)$/i,
    "Tercer puesto \u00b7 Semifinal $1",
  );
}
export function matchName(
  data: Tournament,
  id: string | null,
  fallback: string,
) {
  const g = gradeFor(data, id);
  return g ? g.name : participantLabel(fallback);
}
export function forGrade(data: Tournament, m: Match, grade: string) {
  return [m.home_id, m.away_id].some((id) => gradeFor(data, id)?.id === grade);
}
export function limaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function timestamp(m: Match, end = false) {
  return new Date(`${m.date}T${end ? m.end : m.start}:00-05:00`).getTime();
}
export function status(m: Match, now = Date.now()) {
  if (m.home_score !== null && m.away_score !== null) return "Resultado";
  if (m.superseded_by?.length) return "Horario ocupado";
  if (m.kind === "RESERVA") return "Reserva";
  return timestamp(m, true) < now ? "Resultado pendiente" : "Programado";
}
export function filterMatches(
  data: Tournament,
  filters: Filters,
  matches = data.matches,
  now = new Date(),
) {
  const today = limaDate(now);
  return matches.filter((m) => {
    if (m.superseded_by?.length) return false;
    const names = [gradeFor(data, m.home_id), gradeFor(data, m.away_id)];
    const text = [
      ...names.flatMap((g) => (g ? [g.name, g.label] : [])),
      m.home_label,
      m.away_label,
      m.phase,
      m.court,
    ].join(" ");
    return (
      (!filters.sport || m.sport === filters.sport) &&
      (!filters.date || m.date === filters.date) &&
      (!filters.grade || forGrade(data, m, filters.grade)) &&
      (!filters.group || m.phase === filters.group) &&
      (!filters.court || m.court === filters.court) &&
      (!filters.phase || m.phase.startsWith(filters.phase)) &&
      (!filters.query || fold(text).includes(fold(filters.query))) &&
      (!filters.hour || m.start >= filters.hour) &&
      (filters.period === "all" ||
        (filters.period === "today"
          ? m.date === today
          : timestamp(m, true) >= now.getTime()))
    );
  });
}
export function toggleFavorite(
  favorites: Favorites,
  sport: string,
  id: string,
) {
  const list = favorites[sport] || [];
  if (list.includes(id))
    return {
      favorites: { ...favorites, [sport]: list.filter((x) => x !== id) },
      limited: false,
    };
  if (list.length >= 3) return { favorites, limited: true };
  return {
    favorites: { ...favorites, [sport]: [...list, id] },
    limited: false,
  };
}
export function restorePreferences(
  raw: string | null,
  data: Tournament,
): Preferences {
  try {
    const value = JSON.parse(raw || "{}");
    if (value.version !== 1) return { ...DEFAULT_PREFERENCES };
    const ids = new Set(data.entries.map((e) => e.id));
    const favorites: Favorites = {};
    for (const [sport, list] of Object.entries(value.favorites || {}))
      if (Array.isArray(list))
        favorites[sport] = [
          ...new Set(
            list.filter(
              (id): id is string =>
                typeof id === "string" &&
                ids.has(id) &&
                data.entries.find((e) => e.id === id)?.sport === sport,
            ),
          ),
        ].slice(0, 3);
    return {
      version: 1,
      primary: data.grades.some((g) => g.id === value.primary)
        ? value.primary
        : null,
      favorites,
      theme: value.theme === "light" ? "light" : "dark",
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
export function dayLabel(date: string, long = true) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  }).format(new Date(`${date}T12:00:00-05:00`));
}
function escapeICS(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function calendarFile(
  data: Tournament,
  matches: Match[],
  now = new Date(),
) {
  const utc = (value: number) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pilaricas//Olimpiadas 2026//ES",
    "CALSCALE:GREGORIAN",
    ...matches.flatMap((m) => [
      "BEGIN:VEVENT",
      `UID:${m.id}@pilaricas2026`,
      `DTSTAMP:${utc(now.getTime())}`,
      `DTSTART:${utc(timestamp(m))}`,
      `DTEND:${utc(timestamp(m, true))}`,
      `SUMMARY:${escapeICS(`${matchName(data, m.home_id, m.home_label)} vs ${matchName(data, m.away_id, m.away_label)}`)}`,
      `LOCATION:${escapeICS(m.court)}`,
      `DESCRIPTION:${escapeICS(`${m.sport} · ${m.phase}`)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
}
export function csvFile(data: Tournament, matches: Match[]) {
  return (
    "\ufeff" +
    [
      [
        "Fecha",
        "Inicio",
        "Fin",
        "Disciplina",
        "Fase",
        "Cancha",
        "Local",
        "Visita",
      ],
      ...matches.map((m) => [
        m.date,
        m.start,
        m.end,
        m.sport,
        m.phase,
        m.court,
        matchName(data, m.home_id, m.home_label),
        matchName(data, m.away_id, m.away_label),
      ]),
    ]
      .map((r) => r.map((s) => `"${s.replaceAll('"', '""')}"`).join(","))
      .join("\r\n")
  );
}
export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
