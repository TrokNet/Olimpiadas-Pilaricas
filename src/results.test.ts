import { describe, it, expect } from "vitest";
import raw from "./data/tournament.json";
import type { Tournament, Match } from "./types";
import {
  defaultRule,
  emptyResult,
  normalizeResult,
  withResults,
} from "./results";
import { calculateStandings } from "./Standings";
const data = raw as Tournament;
const game = (sport: string) =>
  data.matches.find(
    (m) => m.sport === sport && m.phase === "GRUPO A" && m.home_id && m.away_id,
  )!;
describe("Resultados y simulaciones", () => {
  it("suma goles, puntos, diferencias y tarjetas sin descontar puntos por tarjetas", () => {
    const m = game("futbol-masculino"),
      rule = defaultRule(m.sport);
    const r = normalizeResult(
      m,
      {
        ...emptyResult(),
        home_score: 4,
        away_score: 1,
        home_yellow: 2,
        away_red: 1,
      },
      rule,
    );
    const simulated = withResults(data, { [m.id]: r }, { [m.sport]: rule });
    const rows = calculateStandings(simulated, m.sport, m.phase)!.rows;
    const winner = rows.find((r) => r.id === m.home_id)!;
    const loser = rows.find((r) => r.id === m.away_id)!;
    expect([
      winner.points,
      winner.for,
      winner.against,
      winner.difference,
      winner.yellow,
    ]).toEqual([3, 4, 1, 3, 2]);
    expect([loser.points, loser.red]).toEqual([0, 1]);
    expect(m.home_score).toBeNull();
  });
  it.each([
    ["futbol-masculino", 3, 3],
    ["voley-femenino", 2, 50],
    ["basquet-masculino", 20, 20],
  ])("walkover confirmado de %s", (sport, score, points) => {
    const m = game(String(sport)),
      rule = defaultRule(m.sport);
    const result = normalizeResult(
      m,
      { ...emptyResult(), walkover: "home" },
      rule,
    );
    expect([
      result.home_score,
      result.away_score,
      result.home_points,
      result.away_points,
    ]).toEqual([0, score, 0, points]);
    const winner = calculateStandings(
      withResults(data, { [m.id]: result }, { [m.sport]: rule }),
      m.sport,
      m.phase,
    )!.rows.find((r) => r.id === m.away_id)!;
    expect(winner.points).toBe(3);
    expect(winner.woFor).toBe(1);
    if (String(sport).startsWith("voley"))
      expect(result.sets).toEqual([
        { home: 0, away: 25 },
        { home: 0, away: 25 },
      ]);
  });
  it("en vóley el ganador por sets puede tener menos tantos totales", () => {
    const m = game("voley-masculino"),
      rule = defaultRule(m.sport);
    const r = normalizeResult(
      m,
      {
        ...emptyResult(),
        sets: [
          { home: 25, away: 23 },
          { home: 0, away: 25 },
          { home: 25, away: 23 },
        ],
      },
      rule,
    );
    expect([r.home_score, r.away_score, r.home_points, r.away_points]).toEqual([
      2, 1, 50, 71,
    ]);
    const winner = calculateStandings(
      withResults(data, { [m.id]: r }, { [m.sport]: rule }),
      m.sport,
      m.phase,
    )!.rows.find((r) => r.id === m.home_id)!;
    expect(winner.points).toBe(3);
    expect(winner.difference).toBe(-21);
  });
  it("doble inasistencia suma dos derrotas y ningún ganador", () => {
    const m = game("basquet-masculino"),
      rule = defaultRule(m.sport),
      r = normalizeResult(m, { ...emptyResult(), walkover: "both" }, rule);
    const rows = calculateStandings(
      withResults(data, { [m.id]: r }, { [m.sport]: rule }),
      m.sport,
      m.phase,
    )!.rows.filter((row) => [m.home_id, m.away_id].includes(row.id));
    expect(
      rows.every(
        (row) =>
          row.losses === 1 &&
          row.wins === 0 &&
          row.points === 0 &&
          row.woAgainst === 1,
      ),
    ).toBe(true);
  });
  it("rechaza sets empatados, marcadores negativos, empates de eliminación y reservas", () => {
    const m = game("voley-femenino");
    expect(() =>
      normalizeResult(
        m,
        { ...emptyResult(), sets: [{ home: 25, away: 25 }] },
        defaultRule(m.sport),
      ),
    ).toThrow();
    const f = game("futbol-masculino");
    expect(() =>
      normalizeResult(
        f,
        { ...emptyResult(), home_score: -1 },
        defaultRule(f.sport),
      ),
    ).toThrow();
    expect(() =>
      normalizeResult(
        { ...f, phase: "FINAL" } as Match,
        emptyResult(),
        defaultRule(f.sport),
      ),
    ).toThrow();
    expect(() =>
      normalizeResult(
        { ...f, kind: "RESERVA" },
        emptyResult(),
        defaultRule(f.sport),
      ),
    ).toThrow();
  });
});
