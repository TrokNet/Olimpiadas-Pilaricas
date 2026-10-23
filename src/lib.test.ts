import { describe, it, expect } from "vitest";
import raw from "./data/tournament.json";
import type { Tournament, Match } from "./types";
import {
  calendarFile,
  csvFile,
  DEFAULT_FILTERS,
  filterMatches,
  forGrade,
  gradeFor,
  restorePreferences,
  toggleFavorite,
  timestamp,
} from "./lib";
const data = raw as Tournament;
describe("Identidad, filtro y preferencias", () => {
  it("conserva 162 registros y 68 correspondencias", () => {
    expect(data.matches).toHaveLength(162);
    expect(data.entries).toHaveLength(68);
  });
  it("relaciona los 17 partidos de Fonte Colombo sin mezclar sorteos", () => {
    const matches = data.matches.filter((m) =>
      forGrade(data, m, "cuarto-primaria"),
    );
    expect(matches).toHaveLength(17);
    expect(matches.filter((m) => m.sport === "basquet-masculino")).toHaveLength(
      2,
    );
    const female = matches.filter((m) => m.sport === "voley-femenino");
    expect(female).toHaveLength(3);
    expect(
      female.every((m) =>
        [m.home_id, m.away_id].includes("voley-femenino:TEAM-10"),
      ),
    ).toBe(true);
    expect(gradeFor(data, "voley-femenino:TEAM-12")?.id).toBe(
      "segundo-secundaria",
    );
  });
  it("combina disciplina, fecha, grado y cancha", () => {
    const result = filterMatches(data, {
      ...DEFAULT_FILTERS,
      sport: "voley-femenino",
      date: "2026-10-31",
      grade: "cuarto-primaria",
      court: "VÓLEY – Cancha 1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe("12:30");
  });
  it("busca sin depender de acentos y respeta el grupo", () => {
    const result = filterMatches(data, {
      ...DEFAULT_FILTERS,
      query: "primero primaria",
      group: "GRUPO A",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((m) => m.phase === "GRUPO A")).toBe(true);
  });
  it("filtra hoy según Lima, no según la zona del ordenador", () => {
    const result = filterMatches(
      data,
      { ...DEFAULT_FILTERS, period: "today" },
      data.matches,
      new Date("2026-11-01T01:00:00Z"),
    );
    expect(result.every((m) => m.date === "2026-10-31")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
  it("limita a tres favoritos independientes por disciplina y permite quitar", () => {
    let favorites = {};
    for (let i = 1; i <= 3; i++)
      favorites = toggleFavorite(
        favorites,
        "voley-femenino",
        `voley-femenino:TEAM-${i}`,
      ).favorites;
    expect(
      toggleFavorite(favorites, "voley-femenino", "voley-femenino:TEAM-4")
        .limited,
    ).toBe(true);
    expect(
      toggleFavorite(favorites, "futbol-masculino", "futbol-masculino:TEAM-4")
        .limited,
    ).toBe(false);
    expect(
      toggleFavorite(favorites, "voley-femenino", "voley-femenino:TEAM-2")
        .favorites["voley-femenino"],
    ).toHaveLength(2);
  });
  it("restaura preferencias y elimina identificadores inválidos o mezclados", () => {
    const p = restorePreferences(
      JSON.stringify({
        version: 1,
        primary: "cuarto-primaria",
        favorites: {
          "voley-femenino": [
            "voley-femenino:TEAM-10",
            "futbol-masculino:TEAM-1",
            "missing",
          ],
        },
      }),
      data,
    );
    expect(p.primary).toBe("cuarto-primaria");
    expect(p.favorites["voley-femenino"]).toEqual(["voley-femenino:TEAM-10"]);
    expect(restorePreferences("corrupto", data).primary).toBeNull();
  });
  it("exporta CSV real y calendario ICS con horas UTC correctas", () => {
    const m = data.matches[0];
    expect(csvFile(data, [m])).toContain(m.start);
    expect(calendarFile(data, [m])).toContain(`UID:${m.id}`);
    expect(timestamp({ ...m, date: "2026-10-31", start: "10:00" })).toBe(
      Date.parse("2026-10-31T15:00:00Z"),
    );
  });
  it("ICS mantiene la fecha UTC al cruzar medianoche", () => {
    const m = {
      ...data.matches[0],
      date: "2026-10-31",
      start: "18:10",
      end: "19:00",
    } as Match;
    expect(calendarFile(data, [m])).toContain("DTEND:20261101T000000Z");
  });
  it("las fases finales siguen sin nombres inventados", () => {
    const finals = data.matches.filter((m) => m.date === "2026-11-08");
    expect(finals).toHaveLength(20);
    expect(finals.every((m) => !m.home_id && !m.away_id)).toBe(true);
  });
});
