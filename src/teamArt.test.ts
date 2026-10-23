import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { getTeamArt, imageCredits } from "./teamArt";
import raw from "./data/tournament.json";
describe("Referencias de equipos", () => {
  it("cubre los 15 grados sin sustituir sus identidades ni mezclar disciplinas", () => {
    expect(raw.grades).toHaveLength(15);
    for (const grade of raw.grades) {
      const art = getTeamArt(grade.id);
      expect(art).toBeTruthy();
      expect(art!.source).toMatch(
        /^https:\/\/commons.wikimedia.org\/wiki\/File:/,
      );
      expect(art!.license).toMatch(/CC|Public domain/);
      expect(art!.author.length).toBeLessThan(150);
      const file = new URL(`../public/${art!.image}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file).byteLength).toBeGreaterThan(10000);
    }
    expect(imageCredits()).toHaveLength(14);
  });
});
