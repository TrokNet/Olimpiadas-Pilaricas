// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import GroupsStage from "./GroupsStage";
import TournamentBoard from "./TournamentBoard";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
afterEach(cleanup);
it("filtra grupos reales por disciplina y abre el partido exacto", () => {
  const open = vi.fn();
  render(
    <GroupsStage
      data={raw as Tournament}
      sport="futbol-masculino"
      onMatch={open}
    />,
  );
  expect(screen.getAllByRole("table")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Grupo B" }));
  expect(screen.getAllByRole("table")).toHaveLength(1);
  const article = screen
    .getByRole("heading", { name: "Grupo B" })
    .closest("article")!;
  fireEvent.click(within(article).getByText("Partidos del grupo"));
  fireEvent.click(article.querySelector(".group-schedule-game")!);
  expect(open.mock.calls[0][0]).toMatchObject({
    sport: "futbol-masculino",
    phase: "GRUPO B",
    kind: "OFICIAL",
  });
  fireEvent.click(screen.getByRole("button", { name: "Todos los grupos" }));
  expect(screen.getAllByRole("table")).toHaveLength(2);
});
it("actualiza progreso y estadisticas desde un resultado sin marcar clasificados", () => {
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
  const game = data.matches.find(
    (m) =>
      m.sport === "futbol-masculino" &&
      m.phase === "GRUPO A" &&
      m.kind === "OFICIAL",
  )!;
  game.home_score = 3;
  game.away_score = 1;
  render(
    <GroupsStage data={data} sport="futbol-masculino" onMatch={() => {}} />,
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
  const homeGrade = data.grades.find(
    (g) => g.id === data.entries.find((e) => e.id === game.home_id)!.grade_id,
  )!;
  const table = screen.getByRole("table", { name: "Posiciones de GRUPO A" });
  const row = within(table).getByText(homeGrade.name).closest("tr")!;
  const cells = within(row).getAllByRole("cell");
  expect(cells.slice(1, 8).map((c) => c.textContent)).toEqual([
    "1",
    "1",
    "0",
    "0",
    "3",
    "1",
    "2",
  ]);
  expect(screen.queryByText("Clasificado")).toBeNull();
});
it("el eliminatorio excluye tablas y conserva el mejor segundo pendiente", () => {
  render(
    <TournamentBoard
      data={raw as Tournament}
      sport="basquet-femenino"
      mode="knockout"
      onMatch={() => {}}
    />,
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByLabelText("Fase de grupos")).toBeNull();
  expect(screen.getByText("Mejor 2do")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Ver Gran final:/ })).toBeTruthy();
});
