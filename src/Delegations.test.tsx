// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Delegations from "./Delegations";
import { delegationData } from "./delegationData";
import raw from "./data/tournament.json";
import source from "./data/delegations.json";
import type { Tournament } from "./types";
const data = raw as Tournament;
afterEach(cleanup);
it("importa 15 fichas y conserva las casas vigentes sin mezclar historias", () => {
  const snapshot = JSON.stringify(data);
  const entries = delegationData(data);
  expect(entries).toHaveLength(15);
  expect(new Set(entries.map((item) => item.id)).size).toBe(15);
  expect(entries.filter((item) => item.country)).toHaveLength(14);
  expect(entries.filter((item) => item.photo)).toHaveLength(14);
  expect(entries.find((item) => item.id === "quinto-primaria")!.placeName).toBe(
    "Damieta (Egipto)",
  );
  expect(entries.find((item) => item.id === "sexto-primaria")!.placeName).toBe(
    "La Porciúncula",
  );
  expect(
    entries.find((item) => item.id === "primero-secundaria")!.placeName,
  ).toBe("Iglesia de San Damián");
  expect(
    entries.find((item) => item.id === "segundo-secundaria")!.placeName,
  ).toBe("Monte Alvernia");
  const alumni = entries.find((item) => item.id === "ex-alumnas")!;
  expect(alumni.grade.name).toBe("Nuestra Señora del Pilar");
  expect(alumni.country).toBeNull();
  expect(alumni.photo).toBeUndefined();
  expect(alumni.history).not.toContain("Rivotorto");
  for (const item of source.delegations)
    expect(existsSync(resolve("public", item.illustration))).toBe(true);
  expect(JSON.stringify(data)).toBe(snapshot);
});
it("combina búsqueda, nivel y país con recuperación cuando no hay coincidencias", () => {
  const view = render(<Delegations data={data} />);
  expect(view.container.querySelectorAll(".atlas-card")).toHaveLength(15);
  fireEvent.click(screen.getByRole("button", { name: "Primaria" }));
  expect(view.container.querySelectorAll(".atlas-card")).toHaveLength(6);
  fireEvent.change(screen.getByLabelText("Filtrar por país"), {
    target: { value: "Egipto" },
  });
  expect(view.container.querySelectorAll(".atlas-card")).toHaveLength(1);
  expect(
    view.container.querySelector(".atlas-card")!.getAttribute("href"),
  ).toBe("#delegaciones/quinto-primaria");
  fireEvent.change(screen.getByLabelText("Buscar delegación"), {
    target: { value: "Greccio" },
  });
  expect(screen.getByText("No encontramos esa delegación")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Ver las 15 delegaciones" }),
  );
  expect(view.container.querySelectorAll(".atlas-card")).toHaveLength(15);
});
it("abre historia, galería, fuentes y navegación; mantiene pendientes explícitos", () => {
  const view = render(<Delegations data={data} selectedId="cuarto-primaria" />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Fonte Colombo" }),
  ).toBeTruthy();
  expect(screen.getByText("Un lugar de reflexión y compromiso")).toBeTruthy();
  expect(view.container.querySelectorAll("img")).toHaveLength(2);
  fireEvent.click(screen.getByText("Fuentes y créditos"));
  expect(
    screen
      .getByRole("link", { name: /Fotografía original/ })
      .getAttribute("href"),
  ).toContain("commons.wikimedia.org/wiki/File:");
  expect(
    screen.getByRole("navigation", { name: "Otra delegación" }),
  ).toBeTruthy();
  view.rerender(<Delegations data={data} selectedId="ex-alumnas" />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Nuestra Señora del Pilar" }),
  ).toBeTruthy();
  expect(screen.getByText("Lugar geográfico no indicado")).toBeTruthy();
  view.rerender(<Delegations data={data} selectedId="cuarto-secundaria" />);
  expect(
    screen.getByText(/vínculo con un acontecimiento franciscano particular/),
  ).toBeTruthy();
});
