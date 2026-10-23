import { useState } from "react";
import type { Match, RecordedResult, Tournament } from "./types";
import { SPORTS } from "./types";
import GroupsStage from "./GroupsStage";
import { ResultEditor } from "./ResultManager";
import { Modal } from "./ui";
import { dayLabel, matchName } from "./lib";
import {
  defaultRule,
  emptyResult,
  normalizeResult,
  withResults,
} from "./results";
import { RotateCcw, FlaskConical } from "lucide-react";

function SimulationGame({
  game,
  data,
  simulated,
  onApply,
  onEdit,
  onReset,
}: {
  game: Match;
  data: Tournament;
  simulated: boolean;
  onApply: (result: RecordedResult) => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const [home, setHome] = useState(game.home_score?.toString() ?? "");
  const [away, setAway] = useState(game.away_score?.toString() ?? "");
  const [error, setError] = useState("");
  const volley = game.sport.startsWith("voley");
  const homeName = matchName(data, game.home_id, game.home_label);
  const awayName = matchName(data, game.away_id, game.away_label);
  return (
    <form
      className="simulation-game"
      aria-label={`Simular ${homeName} contra ${awayName}`}
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!home.trim() || !away.trim())
            throw new Error("Completa ambos marcadores.");
          const result = normalizeResult(
            game,
            {
              ...emptyResult(),
              ...game.result,
              home_score: Number(home),
              away_score: Number(away),
              walkover: "none",
            },
            data.rules?.[game.sport] || defaultRule(game.sport),
          );
          onApply(result);
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Revisa el marcador.");
        }
      }}
    >
      <div className="simulation-game-top">
        <span>
          {dayLabel(game.date)} · {game.start} · {game.court}
        </span>
        <b className={simulated ? "is-simulated" : ""}>
          {simulated
            ? "Simulado"
            : game.home_score === null
              ? "Pendiente"
              : "Real"}
        </b>
      </div>
      <div className="simulation-score-row">
        <label htmlFor={`sim-home-${game.id}`}>{homeName}</label>
        {volley ? (
          <b>{game.home_score ?? "–"}</b>
        ) : (
          <input
            id={`sim-home-${game.id}`}
            aria-label={`Marcador de ${homeName}`}
            type="number"
            min="0"
            max="10000"
            step="1"
            value={home}
            placeholder="–"
            onChange={(e) => setHome(e.target.value)}
          />
        )}
      </div>
      <div className="simulation-score-row">
        <label htmlFor={`sim-away-${game.id}`}>{awayName}</label>
        {volley ? (
          <b>{game.away_score ?? "–"}</b>
        ) : (
          <input
            id={`sim-away-${game.id}`}
            aria-label={`Marcador de ${awayName}`}
            type="number"
            min="0"
            max="10000"
            step="1"
            value={away}
            placeholder="–"
            onChange={(e) => setAway(e.target.value)}
          />
        )}
      </div>
      <div className="simulation-game-actions">
        {volley ? (
          <button type="button" className="simulation-apply" onClick={onEdit}>
            Editar puntos por set
          </button>
        ) : (
          <>
            <button className="simulation-apply" type="submit">
              Aplicar marcador
            </button>
            <button type="button" onClick={onEdit}>
              Tarjetas y W.O.
            </button>
          </>
        )}
        {simulated && (
          <button type="button" onClick={onReset}>
            Volver al real
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}

export default function SimulationPage({
  data,
  initialMatchId = "",
}: {
  data: Tournament;
  initialMatchId?: string;
}) {
  const [sport, setSport] = useState(
    () =>
      data.matches.find((m) => m.id === initialMatchId)?.sport ||
      SPORTS.find(
        (s) => s.id === new URLSearchParams(location.search).get("sport"),
      )?.id ||
      SPORTS[0].id,
  );
  // Every visit starts from official data. Drafts are local to this view, never sent to the API.
  const [drafts, setDrafts] = useState<Record<string, RecordedResult>>({});
  const [editing, setEditing] = useState(initialMatchId);
  const [revision, setRevision] = useState(0);
  const rules = Object.fromEntries(
    SPORTS.map((s) => [s.id, data.rules?.[s.id] || defaultRule(s.id)]),
  );
  const effective = withResults(data, drafts, rules);
  const match = effective.matches.find((m) => m.id === editing);
  const changes = Object.keys(drafts).length;
  const reset = (id: string) => {
    setDrafts((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== id),
      ),
    );
    setRevision((n) => n + 1);
  };
  return (
    <section className="page-content simulation-page">
      <header className="page-heading simulation-heading">
        <div>
          <h1>
            Simulación<span className="coral-dot">.</span>
          </h1>
          <p>
            Parte de los resultados reales. Cambia los marcadores y descubre
            cómo se mueven las posiciones.
          </p>
        </div>
        <button
          className="button outline"
          disabled={!changes}
          onClick={() => {
            setDrafts({});
            setRevision((n) => n + 1);
          }}
        >
          <RotateCcw size={16} />
          Restablecer resultados reales
        </button>
      </header>
      <div className="simulation-safety">
        <FlaskConical size={20} />
        <span>
          <strong>
            {changes
              ? `${changes} ${changes === 1 ? "partido modificado" : "partidos modificados"}`
              : "Resultados reales como punto de partida"}
          </strong>
          <small>
            Los cambios solo afectan esta simulación y no publican resultados
            oficiales.
          </small>
        </span>
      </div>
      <div
        className="sport-tabs"
        role="group"
        aria-label="Disciplina de simulación"
      >
        {SPORTS.map((s) => (
          <button
            key={s.id}
            aria-pressed={sport === s.id}
            className={sport === s.id ? "active" : ""}
            onClick={() => {
              setSport(s.id);
              setEditing("");
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {!data.rules?.[sport] && (
        <p className="simulation-rule-note">
          Reglas de prueba: victoria {rules[sport].win} puntos, empate{" "}
          {rules[sport].draw}, derrota {rules[sport].loss}. Puntuación oficial
          pendiente de configurar.
        </p>
      )}
      <GroupsStage
        key={sport}
        data={effective}
        sport={sport}
        expandGames
        onMatch={(m) => setEditing(m.id)}
        renderGame={(game) => (
          <SimulationGame
            key={`${game.id}-${revision}-${JSON.stringify(drafts[game.id] || game.result || [game.home_score, game.away_score])}`}
            game={game}
            data={effective}
            simulated={!!drafts[game.id]}
            onApply={(result) =>
              setDrafts((previous) => ({ ...previous, [game.id]: result }))
            }
            onEdit={() => setEditing(game.id)}
            onReset={() => reset(game.id)}
          />
        )}
      />
      {match && (
        <Modal
          open
          onClose={() => setEditing("")}
          title="Editar simulación"
          description="Cambia este partido para recalcular las posiciones. El resultado oficial se conserva."
          className="simulation-editor-modal"
        >
          <ResultEditor
            key={match.id}
            match={match}
            data={effective}
            rule={rules[match.sport]}
            initial={
              match.result ||
              (match.home_score !== null
                ? {
                    ...emptyResult(),
                    home_score: match.home_score,
                    away_score: match.away_score ?? 0,
                  }
                : undefined)
            }
            disabled={false}
            mode="simulation"
            onSave={async (result) => {
              setDrafts((previous) => ({ ...previous, [match.id]: result }));
              setEditing("");
            }}
          />
        </Modal>
      )}
    </section>
  );
}
