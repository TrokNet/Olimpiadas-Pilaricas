import type { Match, RecordedResult, ScoringRule, Tournament } from "./types";
export const SIM_KEY = "pilaricas-result-simulator-v1";
export function defaultRule(sport: string): ScoringRule {
  return {
    win: 3,
    draw: 1,
    loss: 0,
    allow_draw: sport.startsWith("futbol"),
    wo_win: 3,
    wo_loss: 0,
    wo_score_for: sport.startsWith("futbol")
      ? 3
      : sport.startsWith("voley")
        ? 2
        : 20,
    wo_score_against: 0,
    wo_set_points: 25,
    tiebreakers: ["points", "difference", "for"],
  };
}
export function emptyResult(): RecordedResult {
  return {
    home_score: 0,
    away_score: 0,
    home_points: 0,
    away_points: 0,
    home_yellow: 0,
    away_yellow: 0,
    home_red: 0,
    away_red: 0,
    walkover: "none",
    sets: [],
  };
}
export function normalizeResult(
  match: Match,
  input: RecordedResult,
  rule: ScoringRule,
): RecordedResult {
  if (match.kind !== "OFICIAL" || !match.home_id || !match.away_id)
    throw new Error("El partido necesita ambos equipos definidos.");
  const r = structuredClone(input);
  delete r.updated_at;
  for (const key of [
    "home_score",
    "away_score",
    "home_points",
    "away_points",
    "home_yellow",
    "away_yellow",
    "home_red",
    "away_red",
  ] as const)
    if (!Number.isSafeInteger(r[key]) || r[key] < 0 || r[key] > 10000)
      throw new Error("Los valores deben ser enteros entre 0 y 10000.");
  if (!["none", "home", "away", "both"].includes(r.walkover))
    throw new Error("Walkover inválido.");
  const volley = match.sport.startsWith("voley");
  if (r.walkover === "both") {
    r.home_score = r.away_score = r.home_points = r.away_points = 0;
    r.sets = [];
  } else if (r.walkover !== "none" && rule.wo_score_for != null) {
    const homeWins = r.walkover === "away",
      forScore = rule.wo_score_for,
      against = rule.wo_score_against ?? 0;
    r.home_score = homeWins ? forScore : against;
    r.away_score = homeWins ? against : forScore;
    r.home_points = volley
      ? r.home_score * (rule.wo_set_points ?? 25)
      : r.home_score;
    r.away_points = volley
      ? r.away_score * (rule.wo_set_points ?? 25)
      : r.away_score;
    r.sets = volley
      ? Array.from({ length: forScore + against }, (_, i) => ({
          home: i < forScore === homeWins ? (rule.wo_set_points ?? 25) : 0,
          away: i < forScore === homeWins ? 0 : (rule.wo_set_points ?? 25),
        }))
      : [];
  } else if (volley && r.walkover === "none") {
    if (!r.sets.length || r.sets.length > 5)
      throw new Error("Registra entre 1 y 5 sets.");
    for (const set of r.sets)
      if (
        !Number.isSafeInteger(set.home) ||
        !Number.isSafeInteger(set.away) ||
        set.home < 0 ||
        set.away < 0 ||
        set.home > 10000 ||
        set.away > 10000 ||
        set.home === set.away
      )
        throw new Error("Cada set necesita puntos enteros y un ganador.");
    r.home_score = r.sets.filter((s) => s.home > s.away).length;
    r.away_score = r.sets.filter((s) => s.away > s.home).length;
    r.home_points = r.sets.reduce((n, s) => n + s.home, 0);
    r.away_points = r.sets.reduce((n, s) => n + s.away, 0);
  } else if (!volley) {
    r.home_points = r.home_score;
    r.away_points = r.away_score;
    r.sets = [];
  }
  if (
    (r.walkover === "home" && r.home_score >= r.away_score) ||
    (r.walkover === "away" && r.away_score >= r.home_score)
  )
    throw new Error(
      "Indica un marcador administrativo ganador para el equipo que se presenta.",
    );
  if (match.phase.includes("FINAL") && r.walkover === "both")
    throw new Error("Una eliminatoria necesita un ganador.");
  if (
    r.walkover === "none" &&
    r.home_score === r.away_score &&
    (!rule.allow_draw || volley || match.phase.includes("FINAL"))
  )
    throw new Error("Este partido requiere un ganador.");
  return r;
}
export function withResults(
  data: Tournament,
  results: Record<string, RecordedResult>,
  rules: Record<string, ScoringRule>,
): Tournament {
  return {
    ...data,
    rules: { ...data.rules, ...rules },
    matches: data.matches.map((m) =>
      results[m.id]
        ? {
            ...m,
            home_score: results[m.id].home_score,
            away_score: results[m.id].away_score,
            result: results[m.id],
          }
        : m,
    ),
  };
}
export function randomResult(match: Match, rule: ScoringRule): RecordedResult {
  const r = emptyResult(),
    rand = (max: number) => Math.floor(Math.random() * max);
  if (match.sport.startsWith("voley")) {
    const home = rand(2) === 0;
    r.sets = Array.from({ length: 2 }, () => ({
      home: home ? 25 : rand(24),
      away: home ? rand(24) : 25,
    }));
  } else {
    r.home_score = match.sport.startsWith("futbol") ? rand(6) : 40 + rand(61);
    r.away_score = match.sport.startsWith("futbol") ? rand(6) : 40 + rand(61);
    if (
      (!rule.allow_draw || match.phase.includes("FINAL")) &&
      r.home_score === r.away_score
    )
      r.home_score++;
  }
  return normalizeResult(match, r, rule);
}
