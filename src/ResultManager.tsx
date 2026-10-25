import { useEffect, useMemo, useState } from "react";
import type { Match, RecordedResult, ScoringRule, Tournament } from "./types";
import { SPORTS } from "./types";
import { dayLabel, download, gradeFor, participantLabel } from "./lib";
import Standings from "./Standings";
import ResultLogin from "./ResultLogin";
import { getTeamArt } from "./teamArt";
import { Users, CheckCircle2, ArrowRight } from "lucide-react";
import TournamentBoard from "./TournamentBoard";
import {
  defaultRule,
  emptyResult,
  normalizeResult,
  randomResult,
  SIM_KEY,
  withResults,
} from "./results";
type Simulation = {
  version: 1;
  results: Record<string, RecordedResult>;
  rules: Record<string, ScoringRule>;
};
function participant(data: Tournament, id: string | null, fallback: string) {
  const grade = gradeFor(data, id);
  return grade ? `${grade.name} (${grade.label})` : participantLabel(fallback);
}
function loadSimulation(): Simulation {
  try {
    const d = JSON.parse(localStorage.getItem(SIM_KEY) || "null");
    if (
      d?.version === 1 &&
      d.results &&
      d.rules &&
      !Array.isArray(d.results) &&
      !Array.isArray(d.rules)
    ) {
      const rules: Record<string, ScoringRule> = {};
      for (const sport of SPORTS.map((s) => s.id)) {
        const r = d.rules[sport];
        if (
          r &&
          typeof r.allow_draw === "boolean" &&
          ["win", "draw", "loss"].every(
            (k) => Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 10000,
          ) &&
          Array.isArray(r.tiebreakers) &&
          r.tiebreakers.length &&
          r.tiebreakers.every((v: string) =>
            ["points", "wins", "difference", "for"].includes(v),
          )
        )
          rules[sport] = { ...defaultRule(sport), ...r };
      }
      return {
        version: 1,
        results: typeof d.results === "object" ? d.results : {},
        rules,
      };
    }
  } catch {
    /* Datos locales no válidos: comenzar un escenario vacío. */
  }
  return { version: 1, results: {}, rules: {} };
}
function Numeric({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="result-number">
      {label}
      <input
        type="number"
        min="0"
        max="10000"
        step="1"
        required
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
async function send(path: string, body: unknown): Promise<Tournament> {
  const r = await fetch(`/api/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok)
    throw new Error(
      typeof d?.detail === "string"
        ? d.detail
        : "No se pudo guardar. Revisa los valores y la conexión al servidor local.",
    );
  if (!Array.isArray(d?.matches))
    throw new Error("El servidor no devolvió el resultado guardado.");
  return d;
}
export function ResultEditor({
  match,
  data,
  rule,
  initial,
  onSave,
  disabled,
  mode,
}: {
  match: Match;
  data: Tournament;
  rule: ScoringRule;
  initial?: RecordedResult;
  onSave: (r: RecordedResult) => Promise<void>;
  disabled: boolean;
  mode: string;
}) {
  const [input, setInput] = useState<RecordedResult>(() =>
    initial ? structuredClone(initial) : emptyResult(),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const volley = match.sport.startsWith("voley"),
    football = match.sport.startsWith("futbol");
  const change = (key: keyof RecordedResult, value: unknown) =>
    setInput((r) => ({ ...r, [key]: value }));
  let preview: RecordedResult | undefined;
  try {
    preview = normalizeResult(match, input, rule);
  } catch {
    /* Validar al guardar; evitar errores mientras se completa el marcador. */
  }
  return (
    <form
      className="result-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await onSave(normalizeResult(match, input, rule));
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo guardar.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="result-match-heading">
        <span>
          {dayLabel(match.date)} · {match.start} · {match.court}
        </span>
        <h2>
          {participant(data, match.home_id, match.home_label)} <em>vs</em>{" "}
          {participant(data, match.away_id, match.away_label)}
        </h2>
        <p>
          {match.phase} ·{" "}
          {volley
            ? "Marcador por sets; tantos calculados desde cada set."
            : football
              ? "Marcador en goles."
              : "Marcador en puntos."}
        </p>
      </div>
      <label className="result-select">
        Walkover (inasistencia)
        <select
          value={input.walkover}
          onChange={(e) => change("walkover", e.target.value)}
        >
          <option value="none">Partido jugado</option>
          <option value="home">No se presenta el equipo local</option>
          <option value="away">No se presenta el equipo visitante</option>
          <option value="both">No se presentan ambos equipos</option>
        </select>
      </label>
      {input.walkover === "none" && volley ? (
        <div className="set-editor">
          <h3>Puntos por set</h3>
          {input.sets.map((s, i) => (
            <div className="set-row" key={i}>
              <b>Set {i + 1}</b>
              <Numeric
                label={`Local · set ${i + 1}`}
                value={s.home}
                onChange={(n) =>
                  change(
                    "sets",
                    input.sets.map((v, j) => (j === i ? { ...v, home: n } : v)),
                  )
                }
              />
              <Numeric
                label={`Visitante · set ${i + 1}`}
                value={s.away}
                onChange={(n) =>
                  change(
                    "sets",
                    input.sets.map((v, j) => (j === i ? { ...v, away: n } : v)),
                  )
                }
              />
              <button
                type="button"
                className="text-button"
                aria-label={`Quitar set ${i + 1}`}
                onClick={() =>
                  change(
                    "sets",
                    input.sets.filter((_, j) => j !== i),
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button outline"
            disabled={input.sets.length >= 5}
            onClick={() =>
              change("sets", [...input.sets, { home: 0, away: 0 }])
            }
          >
            Añadir set
          </button>
        </div>
      ) : (
        <div className="result-score-inputs">
          <Numeric
            label={`Local · ${volley ? "sets" : football ? "goles" : "puntos"}`}
            value={
              input.walkover !== "none" && preview
                ? preview.home_score
                : input.home_score
            }
            disabled={input.walkover !== "none" && rule.wo_score_for != null}
            onChange={(n) => change("home_score", n)}
          />
          <Numeric
            label={`Visitante · ${volley ? "sets" : football ? "goles" : "puntos"}`}
            value={
              input.walkover !== "none" && preview
                ? preview.away_score
                : input.away_score
            }
            disabled={input.walkover !== "none" && rule.wo_score_for != null}
            onChange={(n) => change("away_score", n)}
          />
        </div>
      )}
      {input.walkover !== "none" && (
        <p className="result-hint">
          Marcador administrativo según las reglas configuradas. Ganador:{" "}
          {rule.wo_win ?? rule.win} puntos de clasificación.{" "}
          {volley &&
            preview &&
            `Sets administrativos: ${preview.sets.map((s) => `${s.home}–${s.away}`).join(", ")}.`}
        </p>
      )}
      <details className="discipline-events">
        <summary>Amarillas y rojas</summary>
        <div className="result-cards">
          <Numeric
            label="Amarillas local"
            value={input.home_yellow}
            onChange={(n) => change("home_yellow", n)}
          />
          <Numeric
            label="Amarillas visitante"
            value={input.away_yellow}
            onChange={(n) => change("away_yellow", n)}
          />
          <Numeric
            label="Rojas local"
            value={input.home_red}
            onChange={(n) => change("home_red", n)}
          />
          <Numeric
            label="Rojas visitante"
            value={input.away_red}
            onChange={(n) => change("away_red", n)}
          />
        </div>
        <p className="result-hint">
          Se contabilizan sin descuentos automáticos de puntos.
        </p>
      </details>
      {preview && (
        <div className="result-preview" aria-live="polite">
          <strong>
            {preview.home_score} – {preview.away_score}
            {volley ? " sets" : ""}
          </strong>
          <span>
            A favor / en contra: {preview.home_points} / {preview.away_points} ·
            Diferencia local: {preview.home_points - preview.away_points}
          </span>
          {input.walkover !== "none" && <b>W.O.</b>}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button coral" disabled={busy || disabled}>
        {busy
          ? "Guardando…"
          : mode === "simulation"
            ? "Guardar en simulación"
            : "Guardar resultado oficial"}
      </button>
    </form>
  );
}
export default function ResultManager({
  data,
  onUpdate,
  initialMatchId = "",
  initialMode = "simulation",
  embedded = false,
}: {
  data: Tournament;
  onUpdate: (data: Tournament) => void;
  initialMatchId?: string;
  initialMode?: "simulation" | "register";
  embedded?: boolean;
}) {
  const [mode, setMode] = useState<"simulation" | "register">(initialMode);
  const [simulation, setSimulation] = useState(loadSimulation);
  const [sport, setSport] = useState(
    () =>
      data.matches.find((m) => m.id === initialMatchId)?.sport || SPORTS[0].id,
  );
  const [selected, setSelected] = useState(initialMatchId);
  const account = data.auth_user;
  const scopedGrade =
    mode === "register" && account?.role === "team" ? account.grade_id : null;
  const canConfigure =
    !data.capabilities?.auth_required || account?.role === "admin";
  const [chosenTeamId, setTeam] = useState("");
  const team = scopedGrade || chosenTeamId;
  useEffect(() => {
    if (scopedGrade) {
      setSelected("");
      const available = SPORTS.filter((s) =>
        data.entries.some(
          (e) => e.grade_id === scopedGrade && e.sport === s.id,
        ),
      );
      setSport((previous) =>
        available.some((s) => s.id === previous)
          ? previous
          : available[0]?.id || previous,
      );
    }
  }, [scopedGrade, data.entries]);
  const chosenTeam = data.grades.find((g) => g.id === team);
  const chosenArt = chosenTeam ? getTeamArt(chosenTeam.id) : undefined;
  const availableSports = SPORTS.filter(
    (s) =>
      !embedded ||
      !team ||
      data.entries.some((e) => e.grade_id === team && e.sport === s.id),
  );
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [rule, setRule] = useState<ScoringRule>(() => ({
    ...defaultRule(sport),
    ...(simulation.rules[sport] || data.rules?.[sport]),
  }));
  useEffect(() => {
    try {
      localStorage.setItem(SIM_KEY, JSON.stringify(simulation));
    } catch {
      setNotice(
        "No se pudo guardar en el navegador. Exporta la simulación para conservarla.",
      );
    }
  }, [simulation]);
  useEffect(() => {
    setRule({
      ...defaultRule(sport),
      ...(mode === "simulation"
        ? simulation.rules[sport] || data.rules?.[sport]
        : data.rules?.[sport]),
    });
  }, [sport, mode, data.rules, simulation.rules]);
  const records = useMemo(() => {
    const valid: Record<string, RecordedResult> = {};
    for (const m of data.matches) {
      const value = simulation.results[m.id];
      if (value)
        try {
          valid[m.id] = normalizeResult(
            m,
            value,
            simulation.rules[m.sport] ||
              data.rules?.[m.sport] ||
              defaultRule(m.sport),
          );
        } catch {
          /* No usar registros locales que no pasan validación. */
        }
    }
    return valid;
  }, [data, simulation]);
  const effective =
    mode === "simulation"
      ? withResults(data, records, { ...simulation.rules, [sport]: rule })
      : data;
  const matches = effective.matches.filter(
    (m) =>
      (!scopedGrade ||
        [m.home_id, m.away_id].some(
          (id) =>
            data.entries.find((e) => e.id === id)?.grade_id === scopedGrade,
        )) &&
      m.sport === sport &&
      m.kind === "OFICIAL" &&
      m.home_id &&
      m.away_id &&
      (!embedded ||
        (!!team &&
          [m.home_id, m.away_id].some(
            (id) => data.entries.find((e) => e.id === id)?.grade_id === team,
          ))),
  );
  const match =
    matches.find((m) => m.id === selected) ||
    (embedded ? undefined : matches[0]);
  const connected = data.capabilities?.result_write === true;
  const writeRule = async () => {
    setSaving(true);
    setNotice("");
    try {
      if (
        [
          rule.win,
          rule.draw,
          rule.loss,
          rule.wo_win ?? 0,
          rule.wo_loss ?? 0,
          rule.wo_score_for ?? 0,
          rule.wo_score_against ?? 0,
          rule.wo_set_points ?? 0,
        ].some((v) => !Number.isInteger(v) || v < 0 || v > 10000)
      )
        throw new Error("Las reglas deben contener enteros no negativos.");
      if (
        rule.wo_score_for != null &&
        (rule.wo_score_for <= (rule.wo_score_against ?? 0) ||
          (sport.startsWith("voley") &&
            rule.wo_score_for + (rule.wo_score_against ?? 0) > 5))
      )
        throw new Error("Revisa el marcador administrativo de walkover.");
      if (mode === "simulation") {
        setSimulation((s) => ({ ...s, rules: { ...s.rules, [sport]: rule } }));
        setNotice("Reglas guardadas solo para esta simulación.");
      } else {
        onUpdate(
          await send(`rules/${sport}`, {
            ...rule,
            wo_win: rule.wo_win ?? 3,
            wo_loss: rule.wo_loss ?? 0,
          }),
        );
        setNotice("Reglas de esta disciplina guardadas.");
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };
  if (mode === "register" && data.capabilities?.auth_required && !account) {
    return <ResultLogin onUpdate={onUpdate} />;
  }
  return (
    <section
      className={
        embedded
          ? `result-management result-management-embedded ${selected ? "registration-focused" : ""}`
          : "page-content result-management"
      }
    >
      {mode === "register" && account && (
        <div className="result-session">
          <span>
            <strong>
              {account.role === "admin"
                ? "Administrador"
                : data.grades.find((g) => g.id === account.grade_id)?.name}
            </strong>{" "}
            · {account.username}
          </span>
          <button
            className="text-button"
            onClick={async () => {
              try {
                const response = await fetch("/api/auth/logout", {
                  method: "POST",
                  credentials: "same-origin",
                });
                if (!response.ok)
                  throw new Error("No se pudo cerrar la sesión.");
                onUpdate(await response.json());
                setTeam("");
                setSelected("");
              } catch {
                setNotice("No se pudo cerrar la sesión. Inténtalo de nuevo.");
              }
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
      {!embedded && (
        <>
          <span className="eyebrow coral-text">RESULTADOS POR DISCIPLINA</span>
          <h1>La cancha, en números.</h1>
        </>
      )}
      {embedded ? (
        <>
          <header className="registration-welcome">
            <div>
              <h2>Tu equipo. Su resultado.</h2>
              <p>
                Elige el equipo, la disciplina y el partido que quieres
                registrar.
              </p>
            </div>
            <span
              className={`registration-connection ${connected ? "connected" : ""}`}
            >
              <CheckCircle2 size={16} />
              {connected
                ? "Registro oficial disponible"
                : "Registro sin conexión"}
            </span>
          </header>
          <ol className="registration-steps" aria-label="Pasos para registrar">
            <li className={team ? "complete" : "current"}>
              <b>1</b> Equipo
            </li>
            <li className={team ? "current" : ""}>
              <b>2</b> Disciplina
            </li>
            <li className={selected ? "complete" : ""}>
              <b>3</b> Partido y marcador
            </li>
          </ol>
          <details
            className="registration-context"
            open={!selected || undefined}
          >
            <summary>
              {chosenTeam
                ? `${chosenTeam.name} · ${SPORTS.find((s) => s.id === sport)?.label}`
                : "Equipo y disciplina"}
              <span>Cambiar</span>
            </summary>
            <div className="registration-setup">
              <section className="registration-team">
                <label htmlFor="registration-team">
                  ¿De qué equipo quieres registrar un resultado?
                </label>
                <select
                  key={scopedGrade || "all-teams"}
                  id="registration-team"
                  value={team}
                  disabled={!!scopedGrade}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTeam(next);
                    setSelected("");
                    setNotice("");
                    const sports = SPORTS.filter((s) =>
                      data.entries.some(
                        (entry) =>
                          entry.grade_id === next && entry.sport === s.id,
                      ),
                    );
                    if (!sports.some((s) => s.id === sport) && sports[0])
                      setSport(sports[0].id);
                  }}
                >
                  <option value="">Selecciona un equipo</option>
                  {data.grades
                    .filter((g) => !scopedGrade || g.id === scopedGrade)
                    .map((g) => (
                      <option value={g.id} key={g.id}>
                        {g.name} — {g.label}
                      </option>
                    ))}
                </select>
                <div className="registration-team-preview">
                  {chosenArt ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${chosenArt.image}`}
                      alt=""
                    />
                  ) : (
                    <Users size={32} />
                  )}
                  <div>
                    <strong>
                      {chosenTeam?.name || "Todos tenemos un equipo"}
                    </strong>
                    <span>
                      {chosenTeam
                        ? `${chosenTeam.label} · ${chosenTeam.color}`
                        : "Busca por nombre de la casa o por grado."}
                    </span>
                  </div>
                </div>
              </section>
              <section
                className="registration-sports"
                aria-label="Disciplina para registrar"
              >
                <h3>¿En qué disciplina?</h3>
                {team ? (
                  <>
                    <div>
                      {availableSports.map((s) => (
                        <button
                          key={s.id}
                          aria-pressed={sport === s.id}
                          onClick={() => {
                            setSport(s.id);
                            setSelected("");
                            setNotice("");
                          }}
                        >
                          {s.label}
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                    <p>
                      Solo aparecen las disciplinas en las que participa tu
                      equipo.
                    </p>
                  </>
                ) : (
                  <p>Primero elige un equipo para ver sus disciplinas.</p>
                )}
              </section>
            </div>
          </details>
          {!connected && (
            <p className="result-notice">
              El registro necesita conexión con el servidor de la aplicación.
              Tus resultados no se guardarán mientras esté desconectado.
            </p>
          )}
        </>
      ) : (
        <>
          {" "}
          <p>
            Registra marcadores, tarjetas y walkover, o prueba escenarios y
            consulta las tablas por grupo.
          </p>
          <div
            className="result-mode"
            role="group"
            aria-label="Modo de resultados"
          >
            <button
              aria-pressed={mode === "simulation"}
              onClick={() => {
                setMode("simulation");
                setNotice("");
              }}
            >
              Simulador
            </button>
            <button
              aria-pressed={mode === "register"}
              onClick={() => {
                setMode("register");
                setNotice("");
              }}
            >
              Registro oficial
            </button>
          </div>
          <div className={`result-banner ${mode}`}>
            <strong>
              {mode === "simulation"
                ? "SIMULACIÓN · No publica resultados oficiales"
                : "REGISTRO · Guarda en la base de datos"}
            </strong>
            <p>
              {mode === "simulation"
                ? "Tus pruebas se guardan en este navegador y se superponen a los resultados registrados. Restablecerlas recupera la información oficial."
                : connected
                  ? "Servidor local conectado. Los cambios guardados se reflejan en el calendario de partidos y en las posiciones."
                  : "El registro necesita el servidor local de la aplicación. El simulador está disponible en este navegador."}
            </p>
          </div>
          <label className="result-select">
            Disciplina de resultados
            <select
              value={sport}
              onChange={(e) => {
                setSport(e.target.value);
                setSelected("");
                setNotice("");
              }}
            >
              {SPORTS.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {(!embedded || team) && (
        <>
          {embedded && (
            <section className="registration-matches">
              <header>
                <div>
                  <h3>
                    {selected ? "Registrar marcador" : "Elige el partido"}
                  </h3>
                  <p>
                    {chosenTeam?.name} ·{" "}
                    {SPORTS.find((s) => s.id === sport)?.label}
                  </p>
                </div>
                {selected ? (
                  <button
                    className="text-button"
                    onClick={() => setSelected("")}
                  >
                    Cambiar partido
                  </button>
                ) : (
                  <span>{matches.length} encuentros</span>
                )}
              </header>
              <div className="registration-match-grid">
                {matches
                  .filter((m) => !selected || m.id === selected)
                  .map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={selected === m.id}
                      onClick={() => {
                        setSelected(m.id);
                        setNotice("");
                      }}
                    >
                      <span className="registration-match-date">
                        {dayLabel(m.date)} <b>{m.start}</b>
                      </span>
                      <strong>
                        {participant(data, m.home_id, m.home_label)}
                      </strong>
                      <span className="registration-versus">vs</span>
                      <strong>
                        {participant(data, m.away_id, m.away_label)}
                      </strong>
                      <span className="registration-match-footer">
                        {m.court}
                        <span>
                          {m.home_score !== null
                            ? "Editar resultado"
                            : "Registrar resultado"}
                          <ArrowRight size={14} />
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
              {!matches.length && (
                <p>
                  No hay partidos con ambos equipos confirmados para esta
                  selección.
                </p>
              )}
            </section>
          )}
          {(!embedded || selected) && (
            <>
              {mode === "register" && !data.rules?.[sport] && (
                <p className="registration-rule-status">
                  El administrador debe confirmar el reglamento de esta
                  disciplina.{" "}
                  {canConfigure && (
                    <button
                      type="button"
                      onClick={() => {
                        const panel =
                          document.querySelector<HTMLDetailsElement>(
                            ".result-management .result-rules",
                          );
                        if (panel) {
                          panel.open = true;
                          panel.scrollIntoView({ block: "nearest" });
                        }
                      }}
                    >
                      Configurar
                    </button>
                  )}
                </p>
              )}
              {notice && (
                <p role="status" className="result-notice">
                  {notice}
                </p>
              )}
              {match ? (
                <>
                  {!embedded && (
                    <label className="result-select">
                      Partido para registrar
                      <select
                        value={match.id}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.date} {m.start} ·{" "}
                            {participant(data, m.home_id, m.home_label)} vs{" "}
                            {participant(data, m.away_id, m.away_label)}
                            {m.home_score !== null ? " · Registrado" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <ResultEditor
                    key={`${mode}-${match.id}-${match.result?.updated_at || ""}-${revision}`}
                    mode={mode}
                    data={data}
                    match={match}
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
                    rule={
                      mode === "register"
                        ? { ...defaultRule(sport), ...data.rules?.[sport] }
                        : rule
                    }
                    disabled={
                      mode === "register" &&
                      (!connected || !data.rules?.[sport])
                    }
                    onSave={async (result) => {
                      if (mode === "simulation") {
                        setSimulation((s) => ({
                          ...s,
                          rules: { ...s.rules, [sport]: rule },
                          results: {
                            ...s.results,
                            [match.id]: {
                              ...result,
                              updated_at: new Date().toISOString(),
                            },
                          },
                        }));
                        setNotice("Resultado guardado en tu simulación.");
                      } else {
                        onUpdate(await send(`results/${match.id}`, result));
                        setNotice("Resultado oficial guardado.");
                      }
                    }}
                  />
                </>
              ) : (
                <p>
                  {embedded
                    ? "Selecciona un encuentro para completar el marcador."
                    : "No hay partidos con ambos equipos definidos en esta disciplina."}
                </p>
              )}
              {(mode === "simulation" || canConfigure) && (
                <details className="result-rules">
                  <summary>Configurar puntuación y walkover</summary>
                  <p>
                    Los valores iniciales de victoria, empate y derrota son
                    propuestas editables. Confirma y guarda el reglamento de
                    cada disciplina antes de registrar. El W.O. usa los
                    marcadores y 3 puntos indicados por la organización.
                  </p>
                  <div className="rule-grid">
                    {(
                      [
                        ["win", "Puntos por victoria"],
                        ["draw", "Puntos por empate"],
                        ["loss", "Puntos por derrota"],
                        ["wo_win", "Puntos por ganar W.O."],
                        ["wo_loss", "Puntos por perder W.O."],
                        ["wo_score_for", "Marcador W.O. a favor"],
                        ["wo_score_against", "Marcador W.O. en contra"],
                      ] as const
                    ).map(([key, label]) => (
                      <Numeric
                        key={key}
                        label={label}
                        value={rule[key] ?? 0}
                        onChange={(n) => setRule((r) => ({ ...r, [key]: n }))}
                      />
                    ))}
                    {sport.startsWith("voley") && (
                      <Numeric
                        label="Tantos por set de W.O."
                        value={rule.wo_set_points ?? 25}
                        onChange={(n) =>
                          setRule((r) => ({ ...r, wo_set_points: n }))
                        }
                      />
                    )}
                  </div>
                  <label className="result-check">
                    <input
                      type="checkbox"
                      checked={rule.allow_draw}
                      disabled={sport.startsWith("voley")}
                      onChange={(e) =>
                        setRule((r) => ({ ...r, allow_draw: e.target.checked }))
                      }
                    />
                    Permitir empate en fase de grupos
                  </label>
                  <label className="result-select">
                    Criterios de desempate
                    <select
                      value={rule.tiebreakers.join(",")}
                      onChange={(e) =>
                        setRule((r) => ({
                          ...r,
                          tiebreakers: e.target.value.split(
                            ",",
                          ) as ScoringRule["tiebreakers"],
                        }))
                      }
                    >
                      <option value="points,difference,for">
                        Puntos, diferencia, tantos/goles a favor
                      </option>
                      <option value="points,wins,difference,for">
                        Puntos, victorias, diferencia, tantos/goles a favor
                      </option>
                      <option value="points">
                        Solo puntos (empates de posición)
                      </option>
                    </select>
                  </label>
                  <button
                    className="button outline"
                    disabled={saving || (mode === "register" && !connected)}
                    onClick={writeRule}
                  >
                    {mode === "simulation"
                      ? "Guardar reglas de simulación"
                      : "Confirmar y guardar reglas"}
                  </button>
                </details>
              )}
              <div className="simulation-actions">
                {mode === "simulation" && (
                  <>
                    <button
                      className="button outline"
                      onClick={() => {
                        setSimulation((s) => ({
                          ...s,
                          rules: { ...s.rules, [sport]: rule },
                          results: {
                            ...s.results,
                            ...Object.fromEntries(
                              matches
                                .filter((m) => m.home_score === null)
                                .map((m) => [
                                  m.id,
                                  {
                                    ...randomResult(m, rule),
                                    updated_at: new Date().toISOString(),
                                  },
                                ]),
                            ),
                          },
                        }));
                        setNotice(
                          "Se generaron ejemplos para los partidos pendientes de esta disciplina.",
                        );
                      }}
                    >
                      Simular pendientes de esta disciplina
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSimulation((s) => ({
                          ...s,
                          results: Object.fromEntries(
                            Object.entries(s.results).filter(
                              ([id]) =>
                                data.matches.find((m) => m.id === id)?.sport !==
                                sport,
                            ),
                          ),
                        }));
                        setRevision((n) => n + 1);
                        setNotice(
                          "Simulación restablecida para esta disciplina.",
                        );
                      }}
                    >
                      Restablecer esta disciplina
                    </button>
                  </>
                )}
                <button
                  className="button outline"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        {
                          version: 1,
                          mode,
                          rules: effective.rules,
                          results: effective.matches
                            .filter((m) => m.sport === sport && m.result)
                            .map((m) => ({
                              match_id: m.id,
                              sport: m.sport,
                              ...m.result,
                            })),
                        },
                        null,
                        2,
                      ),
                      `resultados-${sport}-${mode}.json`,
                      "application/json",
                    )
                  }
                >
                  Exportar resultados
                </button>
              </div>
              {!embedded && (
                <>
                  <details className="result-tournament-board">
                    <summary>Ver grupos, semifinales y final</summary>
                    <TournamentBoard
                      data={effective}
                      sport={sport}
                      simulation={mode === "simulation"}
                      onMatch={(m) => {
                        location.hash = `partido/${m.id}`;
                      }}
                      onGroup={() =>
                        document
                          .querySelector(".manager-standings")
                          ?.scrollIntoView({ behavior: "instant" })
                      }
                    />
                  </details>
                  <div className="manager-standings">
                    <p className="result-notice">
                      {mode === "simulation"
                        ? "Proyección simulada · Solo en este navegador"
                        : "Posiciones calculadas con los resultados registrados"}
                    </p>
                    <Standings
                      data={{
                        ...effective,
                        matches: effective.matches.filter(
                          (m) => m.sport === sport,
                        ),
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
