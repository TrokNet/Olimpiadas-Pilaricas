// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import TournamentBoard from "./TournamentBoard";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
afterEach(cleanup);
it("abre partidos y grupos desde el cuadro y mantiene los clasificados pendientes", () => {
  const open = vi.fn(),
    group = vi.fn();
  render(
    <TournamentBoard
      data={raw as Tournament}
      sport="basquet-femenino"
      onMatch={open}
      onGroup={group}
    />,
  );
  expect(screen.getByText("Mejor 2do")).toBeTruthy();
  expect(screen.getByText("Campeón por definir")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Ver Semifinal 1:/ }));
  expect(open.mock.calls[0][0].phase).toBe("SEMIFINAL 1");
  fireEvent.click(
    screen.getByRole("button", { name: "Ver partidos de GRUPO A" }),
  );
  expect(group).toHaveBeenCalledWith("GRUPO A");
  expect(
    screen.getByRole("button", { name: /Ver Tercer puesto:/ }),
  ).toBeTruthy();
});
it("identifica la proyección del simulador sin asignar ganadores oficiales", () => {
  render(
    <TournamentBoard
      data={raw as Tournament}
      sport="futbol-masculino"
      onMatch={() => {}}
      simulation
    />,
  );
  expect(screen.getByText(/Escenario simulado/)).toBeTruthy();
  expect(screen.getByText("Primero Grupo A")).toBeTruthy();
});
