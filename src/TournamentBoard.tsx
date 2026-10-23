import { ArrowRight, Medal, Users } from "lucide-react";
import type { Match, Tournament } from "./types";
import { SPORTS } from "./types";
import { dayLabel, gradeFor } from "./lib";
import GroupsStage from "./GroupsStage";
import { getTeamArt } from "./teamArt";
import { bracketMatches, championId, entryName } from "./tournamentLayout";
function KnockoutGame({
  game,
  data,
  label,
  onOpen,
}: {
  game?: Match;
  data: Tournament;
  label: string;
  onOpen: (m: Match) => void;
}) {
  if (!game)
    return (
      <div className="knockout-empty">
        <h3>{label}</h3>Partido pendiente de programación
      </div>
    );
  return (
    <button
      className="knockout-game"
      onClick={() => onOpen(game)}
      aria-label={`Ver ${label}: ${entryName(data, game.home_id, game.home_label)} contra ${entryName(data, game.away_id, game.away_label)}`}
    >
      <span className="knockout-round">
        <b>{label}</b>
        <small className="knockout-match-state">
          {game.home_score !== null && game.away_score !== null
            ? "Finalizado"
            : "Por jugar"}
        </small>
      </span>
      {(
        [
          ["home", game.home_id, game.home_label, game.home_score],
          ["away", game.away_id, game.away_label, game.away_score],
        ] as const
      ).map(([side, id, fallback, score]) => {
        const grade = gradeFor(data, id),
          photo = grade ? getTeamArt(grade.id) : undefined;
        const winner =
          score !== null &&
          game.home_score !== null &&
          game.away_score !== null &&
          score > (side === "home" ? game.away_score : game.home_score);
        return (
          <span
            key={side}
            className={`knockout-team ${winner ? "winner" : ""}`}
          >
            <span className="knockout-avatar">
              {photo ? (
                <img
                  loading="lazy"
                  src={`${import.meta.env.BASE_URL}${photo.image}`}
                  alt=""
                />
              ) : (
                <Users size={17} aria-hidden="true" />
              )}
            </span>
            <span>
              <strong>{entryName(data, id, fallback)}</strong>
              <small>{grade?.label || "Clasificado por confirmar"}</small>
            </span>
            <b className="knockout-score">{score ?? "–"}</b>
          </span>
        );
      })}
      <span className="knockout-time">
        {dayLabel(game.date)}
        <br />
        {game.start}–{game.end} · {game.court}
      </span>
      <span className="knockout-detail">
        Ver partido <ArrowRight size={13} />
      </span>
    </button>
  );
}
export default function TournamentBoard({
  data,
  sport,
  onMatch,
  onGroup,
  simulation = false,
  mode = "all",
}: {
  data: Tournament;
  sport: string;
  onMatch: (m: Match) => void;
  onGroup?: (phase: string) => void;
  simulation?: boolean;
  mode?: "all" | "knockout";
}) {
  const bracket = bracketMatches(data, sport),
    champion = championId(bracket.final),
    winner = gradeFor(data, champion);
  return (
    <div
      className="tournament-board worldcup-board"
      aria-label={
        mode === "all"
          ? "Torneo: grupos, semifinales y final"
          : "Eliminatorias: semifinales y final"
      }
    >
      <div className="tournament-board-heading">
        <div className="tournament-brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <span>OLIMPIADAS PILARICAS 2026</span>
          <h2>Eliminatorias</h2>
          <div className="tournament-discipline">
            {SPORTS.find((s) => s.id === sport)?.label}
          </div>
        </div>
        <p>
          {simulation
            ? "Escenario simulado · No publica clasificados"
            : "Cruces del torneo · Clasificados por confirmar"}
        </p>
      </div>
      <div className="tournament-board-layout">
        <section
          className="knockout-panel"
          aria-label="Llaves de semifinales y final"
        >
          <div className="board-stage-heading">
            <h3>Todos quieren levantarla.</h3>
            <span>
              {bracket.final ? dayLabel(bracket.final.date) : "Fase final"}
            </span>
          </div>
          <div className="knockout-layout">
            <svg
              className="worldcup-paths"
              viewBox="0 0 1000 800"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`cup-path-${sport}`} x1="0" x2="1">
                  <stop stopColor="#ff786c" />
                  <stop offset=".5" stopColor="#ecc77c" />
                  <stop offset="1" stopColor="#ff786c" />
                </linearGradient>
              </defs>
              <path
                className="cup-path-halo"
                d="M290 205 H306 Q320 205 320 221 V574 Q320 590 336 590 H350 M710 205 H694 Q680 205 680 221 V574 Q680 590 664 590 H650"
              />
              <path
                stroke={`url(#cup-path-${sport})`}
                d="M290 205 H306 Q320 205 320 221 V574 Q320 590 336 590 H350 M710 205 H694 Q680 205 680 221 V574 Q680 590 664 590 H650"
              />
              <circle cx="290" cy="205" r="5" />
              <circle cx="710" cy="205" r="5" />
            </svg>
            <div className="semifinal-column semifinal-first">
              <div className="cup-route-label">
                Camino a la final <span>01</span>
              </div>
              <KnockoutGame
                data={data}
                game={bracket.semis[0]}
                label="Semifinal 1"
                onOpen={onMatch}
              />
              <span className="bracket-connector" aria-hidden="true" />
            </div>
            <div className="semifinal-column semifinal-second">
              <div className="cup-route-label">
                Camino a la final <span>02</span>
              </div>
              <KnockoutGame
                data={data}
                game={bracket.semis[1]}
                label="Semifinal 2"
                onOpen={onMatch}
              />
              <span className="bracket-connector" aria-hidden="true" />
            </div>
            <div className="championship-column">
              <div className="champion-display">
                <img
                  className="tournament-cup-image"
                  src={`${import.meta.env.BASE_URL}images/tournament-cup.webp`}
                  alt="Copa dorada del torneo"
                  width={800}
                  height={800}
                  loading="lazy"
                />
                <span>
                  {winner ? "Campeón del torneo" : "Una copa. Un solo campeón."}
                </span>
                <strong>{winner?.name || "Campeón por definir"}</strong>
                {winner && <small>{winner.label}</small>}
              </div>
              <div className="championship-game">
                <div className="cup-final-caption">La cita por la gloria</div>
                <KnockoutGame
                  data={data}
                  game={bracket.final}
                  label="Gran final"
                  onOpen={onMatch}
                />
              </div>
            </div>
          </div>
          <div className="bronze-podium">
            <Medal size={24} />
            <div>
              <h3>También se juega el podio</h3>
              <p>Un encuentro más para conquistar el podio.</p>
            </div>
            <KnockoutGame
              data={data}
              game={bracket.bronze}
              label="Tercer puesto"
              onOpen={onMatch}
            />
          </div>
          <p className="board-qualification-note">
            Los clasificados se mostrarán cuando estén confirmados. Cada
            disciplina conserva sus propios grupos y cruces.
          </p>
        </section>
        {mode === "all" && (
          <GroupsStage
            key={sport}
            data={data}
            sport={sport}
            onMatch={onMatch}
            onGroup={onGroup}
          />
        )}
      </div>
    </div>
  );
}
