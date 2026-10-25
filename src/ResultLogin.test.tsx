// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import ResultManager from "./ResultManager";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
const publicData = {
  ...raw,
  capabilities: { result_write: false, auth_required: true },
  auth_user: null,
} as Tournament;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Harness() {
  const [data, setData] = useState(publicData);
  return (
    <ResultManager
      data={data}
      onUpdate={setData}
      initialMode="register"
      embedded
    />
  );
}
it("exige usuario y contraseña, muestra solo el equipo autorizado y permite cerrar sesión", async () => {
  const authenticated = {
    ...publicData,
    capabilities: { result_write: true, auth_required: true },
    auth_user: {
      username: "cuarto-primaria",
      role: "team",
      grade_id: "cuarto-primaria",
    },
  };
  const send = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(url.endsWith("logout") ? publicData : authenticated),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", send);
  const view = render(<Harness />);
  const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
  expect(password.type).toBe("password");
  expect(screen.queryByText("Tu equipo. Su resultado.")).toBeNull();
  fireEvent.change(screen.getByLabelText("Usuario"), {
    target: { value: "cuarto-primaria" },
  });
  fireEvent.change(password, { target: { value: "test-private-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy(),
  );
  expect(send.mock.calls[0][0]).toBe("/api/auth/login");
  const team = screen.getByLabelText(
    "¿De qué equipo quieres registrar un resultado?",
  ) as HTMLSelectElement;
  expect(team.disabled).toBe(true);
  expect(team.value).toBe("cuarto-primaria");
  expect([...team.options].filter((o) => o.value)).toHaveLength(1);
  expect(view.container.querySelector(".result-rules")).toBeNull();
  const entries = new Set(
    raw.entries
      .filter(
        (e) =>
          e.grade_id === "cuarto-primaria" && e.sport === "futbol-masculino",
      )
      .map((e) => e.id),
  );
  expect(
    view.container.querySelectorAll(".registration-match-grid>button"),
  ).toHaveLength(
    raw.matches.filter(
      (m) =>
        m.sport === "futbol-masculino" &&
        m.kind === "OFICIAL" &&
        m.home_id &&
        m.away_id &&
        (entries.has(m.home_id) || entries.has(m.away_id)),
    ).length,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await waitFor(() => expect(screen.getByLabelText("Contraseña")).toBeTruthy());
  expect(localStorage.getItem("password")).toBeNull();
});
it("no anuncia ingreso cuando la contraseña es rechazada", async () => {
  const update = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ detail: "Usuario o contraseña incorrectos." }),
          { status: 401 },
        ),
    ),
  );
  render(
    <ResultManager
      data={publicData}
      onUpdate={update}
      initialMode="register"
      embedded
    />,
  );
  fireEvent.change(screen.getByLabelText("Usuario"), {
    target: { value: "equipo" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "incorrecta" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Usuario o contraseña incorrectos.",
    ),
  );
  expect(update).not.toHaveBeenCalled();
});
it("el administrador puede elegir cualquier equipo", () => {
  render(
    <ResultManager
      data={{
        ...publicData,
        auth_user: { username: "administrador", role: "admin", grade_id: null },
        capabilities: { auth_required: true, result_write: true },
      }}
      onUpdate={vi.fn()}
      initialMode="register"
      embedded
    />,
  );
  const team = screen.getByLabelText(
    "¿De qué equipo quieres registrar un resultado?",
  ) as HTMLSelectElement;
  expect(team.disabled).toBe(false);
  expect([...team.options].filter((o) => o.value)).toHaveLength(15);
});
