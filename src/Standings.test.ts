import { describe, it, expect } from "vitest";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
import { calculateStandings } from "./Standings";
describe("Posiciones únicamente con reglas confirmadas", () => {
  it("no supone reglas de puntos", () =>
    expect(
      calculateStandings(raw as Tournament, "futbol-masculino", "GRUPO A"),
    ).toBeNull());
  it("calcula PJ, ganancias, diferencias y puntos con reglas explícitas", () => {
    const data = structuredClone(raw) as Tournament;
    data.rules = {
      "futbol-masculino": {
        win: 3,
        draw: 1,
        loss: 0,
        allow_draw: true,
        tiebreakers: ["points", "difference", "for"],
      },
    };
    const match = data.matches.find(
      (m) => m.sport === "futbol-masculino" && m.phase === "GRUPO A",
    )!;
    match.home_score = 2;
    match.away_score = 0;
    const result = calculateStandings(data, match.sport, match.phase)!;
    const winner = result.rows.find((r) => r.id === match.home_id)!;
    expect(winner.played).toBe(1);
    expect(winner.points).toBe(3);
    expect(winner.difference).toBe(2);
    expect(result.rows[0].id).toBe(match.home_id);
  });
  it("muestra conflicto de resultado si las reglas no admiten empates", () => {
    const data = structuredClone(raw) as Tournament;
    data.rules = {
      "voley-femenino": {
        win: 2,
        draw: 0,
        loss: 0,
        allow_draw: false,
        tiebreakers: ["points"],
      },
    };
    const match = data.matches.find(
      (m) => m.sport === "voley-femenino" && m.phase === "GRUPO A",
    )!;
    match.home_score = 1;
    match.away_score = 1;
    expect(calculateStandings(data, match.sport, match.phase)!.error).toContain(
      "pendiente de confirmación",
    );
  });
});
