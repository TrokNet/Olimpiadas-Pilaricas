import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import type { Match, Tournament } from "./types";
import { SPORTS } from "./types";
import { dayLabel, gradeFor } from "./lib";
import { calculateStandings } from "./Standings";
import { getTeamArt } from "./teamArt";
import { entryName, tournamentGroups } from "./tournamentLayout";

export default function GroupsStage({
  data,
  sport,
  onMatch,
  onGroup,
  renderGame,
  expandGames = false,
}: {
  data: Tournament;
  sport: string;
  onMatch: (match: Match) => void;
  onGroup?: (phase: string) => void;
  renderGame?: (match: Match) => ReactNode;
  expandGames?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const groups = tournamentGroups(data, sport);
  const visible = groups.filter((g) => !selected || g.phase === selected);
  const played = groups.reduce((sum, g) => sum + g.played, 0);
  const total = groups.reduce((sum, g) => sum + g.matches.length, 0);
  return (
    <section className="groups-stage" aria-label="Fase de grupos">
      <header className="groups-stage-cover">
        <div>
          <span>{SPORTS.find((s) => s.id === sport)?.label}</span>
          <h2>Cada punto cuenta.</h2>
          <p>Equipos, posiciones y encuentros de la fase de grupos.</p>
        </div>
        <div className="group-progress">
          <strong>
            {played}
            <span> / {total}</span>
          </strong>
          <span>partidos jugados</span>
          <progress
            value={played}
            max={total || 1}
            aria-label="Progreso de la fase de grupos"
          />
        </div>
      </header>
      <div className="group-selector" role="group" aria-label="Filtrar grupos">
        <button aria-pressed={!selected} onClick={() => setSelected("")}>
          Todos los grupos
        </button>
        {groups.map((g) => (
          <button
            key={g.phase}
            aria-pressed={selected === g.phase}
            onClick={() => setSelected(g.phase)}
          >
            Grupo {g.phase.replace("GRUPO ", "")}
          </button>
        ))}
      </div>
      <div className="groups-stage-grid">
        {visible.map((group) => {
          const table = calculateStandings(data, sport, group.phase);
          const rows = table && !table.error ? table.rows : [];
          const entries = rows.length
            ? rows
                .map((r) => data.entries.find((e) => e.id === r.id)!)
                .filter(Boolean)
            : group.entries;
          const games = [...group.matches].sort((a, b) =>
            (a.date + a.start + a.id).localeCompare(b.date + b.start + b.id),
          );
          return (
            <article className="group-scorecard" key={group.phase}>
              <header>
                <div className="group-letter" aria-hidden="true">
                  {group.phase.replace("GRUPO ", "")}
                </div>
                <div>
                  <h3>Grupo {group.phase.replace("GRUPO ", "")}</h3>
                  <p>
                    {entries.length} equipos <span>•</span> {group.played} de{" "}
                    {games.length} partidos jugados
                  </p>
                </div>
              </header>
              <div
                className="group-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={`Posiciones de ${group.phase}`}
              >
                <table className="group-score-table">
                  <caption className="sr-only">
                    Posiciones de {group.phase}
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        title="Los equipos sin resultados no tienen posición; los empatados comparten puesto"
                      >
                        Pos.
                      </th>
                      <th scope="col">Equipo</th>
                      {["PJ", "PG", "PE", "PP", "PF", "PC", "DIF", "PTS"].map(
                        (label) => (
                          <th scope="col" key={label}>
                            <abbr
                              title={
                                {
                                  PJ: "Partidos jugados",
                                  PG: "Partidos ganados",
                                  PE: "Partidos empatados",
                                  PP: "Partidos perdidos",
                                  PF: sport.startsWith("voley")
                                    ? "Tantos a favor; el ganador se determina por sets"
                                    : "Goles o puntos a favor",
                                  PC: sport.startsWith("voley")
                                    ? "Tantos en contra"
                                    : "Goles o puntos en contra",
                                  DIF: "Diferencia a favor menos en contra",
                                  PTS: "Puntos de clasificación",
                                }[label]
                              }
                            >
                              {label}
                            </abbr>
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const grade = gradeFor(data, entry.id),
                        art = grade ? getTeamArt(grade.id) : undefined;
                      const row = rows.find((r) => r.id === entry.id);
                      return (
                        <tr key={entry.id}>
                          <td className="group-position">
                            {row?.played ? row.rank : "–"}
                          </td>
                          <th scope="row">
                            <span className="group-team-identity">
                              {art ? (
                                <img
                                  src={`${import.meta.env.BASE_URL}${art.image}`}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : (
                                <Users size={24} />
                              )}
                              <span>
                                <strong>{grade?.name || entry.id}</strong>
                                <small>
                                  {grade?.label} · TEAM {entry.team_number}
                                </small>
                              </span>
                            </span>
                          </th>
                          {[
                            row?.played,
                            row?.wins,
                            row?.draws,
                            row?.losses,
                            row?.for,
                            row?.against,
                            row?.difference,
                            row?.points,
                          ].map((value, index) => (
                            <td
                              key={index}
                              className={index === 7 ? "group-points" : ""}
                            >
                              {value ?? "–"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {table?.error && (
                <details className="group-data-warning">
                  <summary>Posiciones por revisar</summary>
                  <p>{table.error}</p>
                </details>
              )}
              <details
                className="group-schedule"
                open={expandGames || undefined}
              >
                <summary>
                  <CalendarDays size={18} /> Partidos del grupo{" "}
                  <span>{games.length}</span>
                </summary>
                <div>
                  {games.map((game) =>
                    renderGame ? (
                      <div key={game.id}>{renderGame(game)}</div>
                    ) : (
                      <button
                        className="group-schedule-game"
                        key={game.id}
                        onClick={() => onMatch(game)}
                      >
                        <span className="group-game-date">
                          {dayLabel(game.date)}
                          <small>
                            {game.start}–{game.end} · {game.court}
                          </small>
                        </span>
                        <span className="group-game-teams">
                          <span>
                            {entryName(data, game.home_id, game.home_label)}
                            <b>{game.home_score ?? "–"}</b>
                          </span>
                          <span>
                            {entryName(data, game.away_id, game.away_label)}
                            <b>{game.away_score ?? "–"}</b>
                          </span>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    ),
                  )}
                </div>
              </details>
              {onGroup && (
                <button
                  className="group-calendar-link"
                  onClick={() => onGroup(group.phase)}
                  aria-label={`Ver partidos de ${group.phase}`}
                >
                  Abrir en el calendario <ArrowRight size={16} />
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!groups.length && (
        <p className="empty-state">
          Todavía no hay grupos programados para esta disciplina.
        </p>
      )}
    </section>
  );
}
