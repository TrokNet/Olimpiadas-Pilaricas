// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import Fans from "./Fans";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
type Row = {
  id: string;
  team_id: string;
  author: string;
  message: string;
  created_at: string;
};
let rows: Row[] = [];
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  rows = [
    {
      id: "first",
      team_id: "cuarto-primaria",
      author: "Ana",
      message: "¡Vamos, Fonte Colombo!",
      created_at: "2026-10-23T19:00:00+00:00",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url, "http://localhost");
      if (options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        const item = {
          ...body,
          id: "new",
          author: body.author || "Hincha pilarico",
          created_at: "2026-10-23T19:01:00+00:00",
        };
        rows.unshift(item);
        return response(item, 201);
      }
      if (options?.method === "DELETE") {
        const body = JSON.parse(String(options.body));
        if (body.password !== "test-admin")
          return response({ detail: "Clave incorrecta." }, 403);
        rows = rows.filter((row) => !path.pathname.endsWith(row.id));
        return response({ deleted: true });
      }
      const team = path.searchParams.get("team_id");
      const filtered = rows.filter((row) => !team || row.team_id === team);
      return response({
        messages: filtered,
        total: filtered.length,
        next_cursor: null,
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("publica para el equipo elegido y muestra el historial compartido", async () => {
  render(<Fans data={raw as Tournament} initialTeamId="cuarto-primaria" />);
  await screen.findByText("¡Vamos, Fonte Colombo!");
  fireEvent.change(screen.getByLabelText("Tu mensaje"), {
    target: { value: "¡Toda la familia alentando!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publicar mensaje" }));
  await screen.findByText("¡Toda la familia alentando!");
  expect(screen.getByLabelText("Tu mensaje").textContent).toBe("");
  expect(rows[0].team_id).toBe("cuarto-primaria");
  expect(await screen.findByText("Hincha pilarico")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Filtrar mensajes por equipo"), {
    target: { value: "ex-alumnas" },
  });
  await screen.findByText(/Todavía no hay mensajes/);
});
it("pide una clave oculta, conserva el mensaje con clave incorrecta y borra con la válida", async () => {
  render(<Fans data={raw as Tournament} />);
  await screen.findByText("¡Vamos, Fonte Colombo!");
  fireEvent.click(
    screen.getByRole("button", { name: "Eliminar mensaje de Ana" }),
  );
  const modal = screen.getByRole("dialog"),
    password = within(modal).getByLabelText(
      "Clave de administración",
    ) as HTMLInputElement;
  expect(password.type).toBe("password");
  expect(password.value).toBe("");
  fireEvent.change(password, { target: { value: "wrong" } });
  fireEvent.click(
    within(modal).getByRole("button", {
      name: "Eliminar mensaje",
    }),
  );
  await within(modal).findByText("Clave incorrecta.");
  expect(rows).toHaveLength(1);
  fireEvent.change(password, { target: { value: "test-admin" } });
  fireEvent.click(
    within(modal).getByRole("button", {
      name: "Eliminar mensaje",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findByText(/Todavía no hay mensajes/);
  expect(rows).toHaveLength(0);
});
it("muestra el contenido como texto y permite reintentar una carga fallida", async () => {
  rows[0].message = '<img src=x onerror="alert(1)">';
  const view = render(<Fans data={raw as Tournament} />);
  await screen.findByText(rows[0].message);
  expect(view.container.querySelectorAll("img")).toHaveLength(0);
  view.unmount();
  const mock = vi.mocked(fetch);
  const normalFetch = mock.getMockImplementation();
  let rejectFansRequest = true;
  mock.mockImplementation((url: string, options?: RequestInit) => {
    if (
      rejectFansRequest &&
      new URL(url, "http://localhost").pathname.endsWith("/api/fans")
    ) {
      rejectFansRequest = false;
      return Promise.reject(new Error("Sin conexión"));
    }
    return normalFetch!(url, options);
  });
  render(<Fans data={raw as Tournament} />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await screen.findByText(rows[0].message);
});
