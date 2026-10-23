import type { Entry, Match, Tournament } from "./types";
import { gradeFor, participantLabel } from "./lib";
export function tournamentGroups(data: Tournament, sport: string) {
  const games = data.matches.filter(
    (m) =>
      m.sport === sport && m.kind === "OFICIAL" && m.phase.startsWith("GRUPO "),
  );
  return [...new Set(games.map((m) => m.phase))].sort().map((phase) => {
    const matches = games.filter((m) => m.phase === phase);
    const ids = new Set(
      matches
        .flatMap((m) => [m.home_id, m.away_id])
        .filter((id): id is string => !!id),
    );
    const entries = data.entries
      .filter((e) => e.sport === sport && ids.has(e.id))
      .sort(
        (a, b) =>
          (gradeFor(data, a.id)?.display_order ?? 0) -
          (gradeFor(data, b.id)?.display_order ?? 0),
      );
    return {
      phase,
      entries,
      matches,
      played: matches.filter(
        (m) => m.home_score !== null && m.away_score !== null,
      ).length,
    };
  });
}
export function bracketMatches(data: Tournament, sport: string) {
  const games = data.matches.filter(
    (m) => m.sport === sport && m.kind === "OFICIAL",
  );
  return {
    semis: games
      .filter((m) => m.phase.startsWith("SEMIFINAL"))
      .sort((a, b) => a.phase.localeCompare(b.phase)),
    final: games.find((m) => m.phase === "FINAL 2"),
    bronze: games.find((m) => m.phase === "FINAL 1"),
  };
}
export function entryName(
  data: Tournament,
  id: string | null,
  fallback: string,
) {
  return gradeFor(data, id)?.name || participantLabel(fallback);
}
export function championId(match?: Match): string | null {
  if (
    !match ||
    match.home_score === null ||
    match.away_score === null ||
    match.home_score === match.away_score
  )
    return null;
  return match.home_score > match.away_score ? match.home_id : match.away_id;
}
export type TournamentGroup = {
  phase: string;
  entries: Entry[];
  matches: Match[];
  played: number;
};
