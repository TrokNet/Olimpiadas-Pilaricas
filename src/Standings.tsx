import type { Tournament } from "./types";
import { gradeFor } from "./lib";

export interface Standing {
  yellow: number;
  red: number;
  woFor: number;
  woAgainst: number;
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  for: number;
  against: number;
  difference: number;
  points: number;
  rank: number;
}
export function calculateStandings(
  data: Tournament,
  sport: string,
  group: string,
): { rows: Standing[]; error?: string } | null {
  const rule = data.rules?.[sport];
  if (!rule) return null;
  const matches = data.matches.filter(
    (m) => m.sport === sport && m.phase === group && m.kind === "OFICIAL",
  );
  const rows = new Map<string, Standing>();
  for (const m of matches) {
    for (const id of [m.home_id, m.away_id])
      if (id && !rows.has(id))
        rows.set(id, {
          id,
          name: gradeFor(data, id)
            ? `${gradeFor(data, id)!.name} · ${gradeFor(data, id)!.label}`
            : id,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          for: 0,
          against: 0,
          difference: 0,
          points: 0,
          rank: 0,
          yellow: 0,
          red: 0,
          woFor: 0,
          woAgainst: 0,
        });
    if (
      m.home_score === null ||
      m.away_score === null ||
      !m.home_id ||
      !m.away_id
    )
      continue;
    if (
      !rule.allow_draw &&
      m.home_score === m.away_score &&
      m.result?.walkover !== "both"
    )
      return {
        rows: [],
        error:
          "La tabla está pendiente de confirmación: hay un resultado empatado en una categoría que requiere ganador.",
      };
    const home = rows.get(m.home_id)!,
      away = rows.get(m.away_id)!;
    for (const [team, a, b] of [
      [home, m.home_score, m.away_score],
      [away, m.away_score, m.home_score],
    ] as const) {
      team.played++;
      const isHome = team === home;
      const result = m.result;
      team.for += result
        ? isHome
          ? result.home_points
          : result.away_points
        : a;
      team.against += result
        ? isHome
          ? result.away_points
          : result.home_points
        : b;
      team.yellow += result
        ? isHome
          ? result.home_yellow
          : result.away_yellow
        : 0;
      team.red += result ? (isHome ? result.home_red : result.away_red) : 0;
      const absent =
        result?.walkover === "both" ||
        result?.walkover === (isHome ? "home" : "away");
      const wonWO = result?.walkover === (isHome ? "away" : "home");
      if (absent) team.woAgainst++;
      if (wonWO) team.woFor++;
      team.difference = team.for - team.against;
      if (absent) {
        team.losses++;
        team.points += rule.wo_loss ?? rule.loss;
      } else if (wonWO) {
        team.wins++;
        team.points += rule.wo_win ?? rule.win;
      } else if (a > b) {
        team.wins++;
        team.points += rule.win;
      } else if (a === b) {
        team.draws++;
        team.points += rule.draw;
      } else {
        team.losses++;
        team.points += rule.loss;
      }
    }
  }
  const sorted = [...rows.values()].sort((a, b) => {
    for (const key of rule.tiebreakers) {
      const difference = b[key] - a[key];
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name, "es");
  });
  sorted.forEach((row, i) => {
    row.rank =
      i === 0
        ? 1
        : rule.tiebreakers.every((k) => row[k] === sorted[i - 1][k])
          ? sorted[i - 1].rank
          : i + 1;
  });
  return { rows: sorted };
}
export default function Standings({ data }: { data: Tournament }) {
  const sports = [
    ...new Set(
      data.matches
        .filter((m) => m.home_score !== null && m.phase.startsWith("GRUPO"))
        .map((m) => m.sport),
    ),
  ];
  if (!sports.length) return null;
  if (!sports.some((s) => data.rules?.[s]))
    return (
      <div className="classification-note">
        <p>
          Las tablas de posiciones se publicarán cuando se confirmen las reglas
          de cada disciplina.
        </p>
      </div>
    );
  return (
    <section className="standings-section">
      <h2>Tablas de posiciones</h2>
      <p className="standings-legend">
        PTS: puntos de clasificación · DIF: a favor menos en contra · TA/TR:
        amarillas/rojas · WO+/WO−: ganados/perdidos por inasistencia. En vóley,
        a favor y en contra cuentan tantos; el ganador se determina por sets.
        Las tarjetas no descuentan puntos automáticamente. Equipos igualados en
        los criterios comparten posición.
      </p>
      {sports.flatMap((sport) =>
        [
          ...new Set(
            data.matches
              .filter((m) => m.sport === sport && m.phase.startsWith("GRUPO"))
              .map((m) => m.phase),
          ),
        ].map((group) => {
          const table = calculateStandings(data, sport, group);
          if (!table) return null;
          return (
            <div className="standings-table" key={sport + group}>
              <h3>
                {sport.replaceAll("-", " ")} · {group}
              </h3>
              {table.error ? (
                <p>{table.error}</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "#",
                          "Equipo",
                          "PJ",
                          "PG",
                          "PE",
                          "PP",
                          "A favor",
                          "En contra",
                          "DIF",
                          "PTS",
                          "TA",
                          "TR",
                          "WO+",
                          "WO−",
                        ].map((s) => (
                          <th key={s}>{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.rank}</td>
                          <th scope="row">{r.name}</th>
                          <td>{r.played}</td>
                          <td>{r.wins}</td>
                          <td>{r.draws}</td>
                          <td>{r.losses}</td>
                          <td>{r.for}</td>
                          <td>{r.against}</td>
                          <td>{r.difference}</td>
                          <td>{r.points}</td>
                          <td>{r.yellow}</td>
                          <td>{r.red}</td>
                          <td>{r.woFor}</td>
                          <td>{r.woAgainst}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }),
      )}
    </section>
  );
}
