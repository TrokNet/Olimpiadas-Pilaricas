import { describe, it, expect } from "vitest";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
import {
  tournamentGroups,
  bracketMatches,
  championId,
} from "./tournamentLayout";
import { SPORTS } from "./types";
const data = raw as Tournament;
describe("Cuadro fiel al fixture", () => {
  it.each(SPORTS.map((s) => s.id))(
    "incluye todos los equipos de %s en sus grupos, sin reservas",
    (sport) => {
      const groups = tournamentGroups(data, sport);
      const ids = groups.flatMap((g) => g.entries.map((e) => e.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(ids)).toEqual(
        new Set(data.entries.filter((e) => e.sport === sport).map((e) => e.id)),
      );
      expect(
        groups.every(
          (g) =>
            g.phase !== "GRUPO X" &&
            g.matches.every((m) => m.kind === "OFICIAL"),
        ),
      ).toBe(true);
      const bracket = bracketMatches(data, sport);
      expect(bracket.semis).toHaveLength(2);
      expect(bracket.final?.phase).toBe("FINAL 2");
      expect(bracket.bronze?.phase).toBe("FINAL 1");
    },
  );
  it("conserva el cruce de fútbol y el mejor segundo de básquet femenino", () => {
    expect(bracketMatches(data, "futbol-masculino").semis[0].away_label).toBe(
      "Segundo Grupo B",
    );
    expect(bracketMatches(data, "basquet-femenino").semis[1].away_label).toBe(
      "Mejor 2do",
    );
  });
  it("no proclama campeón con marcador pendiente o empatado", () => {
    const final = bracketMatches(data, "futbol-masculino").final!;
    expect(championId(final)).toBeNull();
    expect(
      championId({
        ...final,
        home_id: "a",
        away_id: "b",
        home_score: 1,
        away_score: 1,
      }),
    ).toBeNull();
    expect(
      championId({
        ...final,
        home_id: "a",
        away_id: "b",
        home_score: 2,
        away_score: 1,
      }),
    ).toBe("a");
  });
});
