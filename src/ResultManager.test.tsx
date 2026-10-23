// @vitest-environment happy-dom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import ResultManager from "./ResultManager";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
import { SIM_KEY } from "./results";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("guía el registro por equipo y disciplina sin mezclar sus partidos", () => {
  const data = structuredClone(raw) as Tournament;
  const { container } = render(
    <ResultManager
      data={data}
      onUpdate={vi.fn()}
      initialMode="register"
      embedded
    />,
  );
  expect(screen.queryByLabelText("Walkover (inasistencia)")).toBeNull();
  const team = screen.getByLabelText(
    "¿De qué equipo quieres registrar un resultado?",
  );
  fireEvent.change(team, { target: { value: "ex-alumnas" } });
  expect(
    screen.queryByRole("button", { name: "Fútbol 6 masculino" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Básquet femenino" }));
  const entries = new Set(
    data.entries
      .filter(
        (e) => e.grade_id === "ex-alumnas" && e.sport === "basquet-femenino",
      )
      .map((e) => e.id),
  );
  const expected = data.matches.filter(
    (m) =>
      m.sport === "basquet-femenino" &&
      m.kind === "OFICIAL" &&
      m.home_id &&
      m.away_id &&
      (entries.has(m.home_id) || entries.has(m.away_id)),
  );
  expect(
    container.querySelectorAll(".registration-match-grid > button"),
  ).toHaveLength(expected.length);
  fireEvent.click(
    container.querySelector(".registration-match-grid > button")!,
  );
  expect(
    container.querySelectorAll(".registration-match-grid > button"),
  ).toHaveLength(1);
  expect(screen.getByLabelText("Walkover (inasistencia)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cambiar partido" }));
  expect(screen.queryByLabelText("Walkover (inasistencia)")).toBeNull();
  fireEvent.change(team, { target: { value: "cuarto-primaria" } });
  expect(
    screen.getByRole("button", { name: "Fútbol 6 masculino" }),
  ).toBeTruthy();
});
it("guarda el escenario en navegador, restaura al volver y no altera los resultados oficiales", async () => {
  const update = vi.fn();
  render(<ResultManager data={raw as Tournament} onUpdate={update} />);
  fireEvent.change(screen.getByLabelText("Local · goles"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Visitante · goles"), {
    target: { value: "1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar en simulación" }),
  );
  await waitFor(() =>
    expect(
      Object.keys(JSON.parse(localStorage.getItem(SIM_KEY)!).results),
    ).toHaveLength(1),
  );
  expect(update).not.toHaveBeenCalled();
  cleanup();
  render(<ResultManager data={raw as Tournament} onUpdate={update} />);
  expect(
    (screen.getByLabelText("Local · goles") as HTMLInputElement).value,
  ).toBe("3");
  fireEvent.click(
    screen.getByRole("button", { name: "Restablecer esta disciplina" }),
  );
  await waitFor(() =>
    expect(
      Object.keys(JSON.parse(localStorage.getItem(SIM_KEY)!).results),
    ).toHaveLength(0),
  );
});
it("registra reglas y resultados solo con API y muestra éxito después de guardar", async () => {
  const data = structuredClone(raw) as Tournament;
  data.capabilities = { result_write: true };
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const update = vi.fn();
  render(<ResultManager data={data} onUpdate={update} />);
  fireEvent.click(screen.getByRole("button", { name: "Registro oficial" }));
  expect(
    (
      screen.getByRole("button", {
        name: "Guardar resultado oficial",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirmar y guardar reglas",
    }),
  );
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/rules/futbol-masculino",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
  expect(update).toHaveBeenCalled();
});
it("un error de SQLite no se anuncia como resultado guardado", async () => {
  const data = structuredClone(raw) as Tournament;
  data.capabilities = { result_write: true };
  data.rules = {
    "futbol-masculino": {
      win: 3,
      draw: 1,
      loss: 0,
      allow_draw: true,
      tiebreakers: ["points"],
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "Base no disponible" }), {
          status: 503,
        }),
    ),
  );
  const update = vi.fn();
  render(<ResultManager data={data} onUpdate={update} />);
  fireEvent.click(screen.getByRole("button", { name: "Registro oficial" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar resultado oficial" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Base no disponible");
  expect(update).not.toHaveBeenCalled();
});
