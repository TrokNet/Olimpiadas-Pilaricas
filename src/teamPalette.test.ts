import { expect, it } from "vitest";
import { teamPalette, contrast } from "./teamPalette";
import raw from "./data/tournament.json";
it("personaliza cada salón con el color oficial y conserva contraste en ambos modos", () => {
  for (const grade of raw.grades) for (const mode of ["dark", "light"] as const) {
    const p = teamPalette(grade, mode);
    expect(contrast(p["--coral"], p["--panel"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p["--coral"], p["--team-button-ink"])).toBeGreaterThanOrEqual(4.5);
    expect(p["--bg"]).not.toBe(p["--panel"]);
  }
  expect(teamPalette(raw.grades[0], "dark")).not.toEqual(teamPalette(raw.grades[1], "dark"));
});
