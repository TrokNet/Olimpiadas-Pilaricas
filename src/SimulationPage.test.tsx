// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import SimulationPage from "./SimulationPage";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
import { matchName } from "./lib";
import { defaultRule } from "./results";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});
it("parte de resultados reales, recalcula posiciones y restaura sin escribir a la API", () => {
  const data = structuredClone(raw) as Tournament;
  const game = data.matches.find(
    (m) =>
      m.sport === "futbol-masculino" &&
      m.phase === "GRUPO A" &&
      m.kind === "OFICIAL",
  )!;
  game.home_score = 2;
  game.away_score = 0;
  data.rules = { "futbol-masculino": defaultRule("futbol-masculino") };
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  const view = render(<SimulationPage data={data} />);
  const name = matchName(data, game.home_id, game.home_label),
    opponent = matchName(data, game.away_id, game.away_label);
  let form = screen.getByRole("form", {
    name: `Simular ${name} contra ${opponent}`,
  });
  expect(
    (within(form).getByLabelText(`Marcador de ${name}`) as HTMLInputElement)
      .value,
  ).toBe("2");
  fireEvent.change(within(form).getByLabelText(`Marcador de ${name}`), {
    target: { value: "0" },
  });
  fireEvent.change(within(form).getByLabelText(`Marcador de ${opponent}`), {
    target: { value: "4" },
  });
  fireEvent.click(
    within(form).getByRole("button", { name: "Aplicar marcador" }),
  );
  expect(screen.getByText("1 partido modificado")).toBeTruthy();
  const table = screen.getByRole("table", { name: "Posiciones de GRUPO A" });
  expect(within(table).getAllByRole("row")[1].textContent).toContain(opponent);
  expect(game.home_score).toBe(2);
  expect(game.away_score).toBe(0);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Restablecer resultados reales" }),
  );
  form = screen.getByRole("form", {
    name: `Simular ${name} contra ${opponent}`,
  });
  expect(
    (within(form).getByLabelText(`Marcador de ${name}`) as HTMLInputElement)
      .value,
  ).toBe("2");
  view.unmount();
  render(<SimulationPage data={data} />);
  expect(screen.queryByText("1 partido modificado")).toBeNull();
});
it("impide simular un empate en basquet y deja intacta la clasificación", () => {
  history.replaceState(null, "", "/?sport=basquet-masculino");
  render(<SimulationPage data={raw as Tournament} />);
  const form = screen.getAllByRole("form")[0];
  const inputs = within(form).getAllByRole("spinbutton");
  for (const input of inputs)
    fireEvent.change(input, { target: { value: "20" } });
  fireEvent.click(
    within(form).getByRole("button", { name: "Aplicar marcador" }),
  );
  expect(within(form).getByRole("alert").textContent).toContain(
    "requiere un ganador",
  );
  expect(screen.queryByText("1 partido modificado")).toBeNull();
});
