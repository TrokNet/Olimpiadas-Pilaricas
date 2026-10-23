// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AtlasCinematicHero, AtlasJourney } from "./AtlasJourney";
import { delegationData } from "./delegationData";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
const items = delegationData(raw as Tournament);
afterEach(cleanup);
it("presenta una sola fotografía editorial y permite recorrer las quince delegaciones", async () => {
  const view = render(<AtlasJourney items={items} reduced />);
  expect(view.container.querySelectorAll(".atlas-stage-images")).toHaveLength(1);
  expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(14);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(items[0].grade.name);
  fireEvent.click(screen.getByRole("button", { name: "Delegación siguiente" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(items[1].grade.name));
  fireEvent.click(screen.getByRole("button", { name: "Delegación anterior" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(items[0].grade.name));
  fireEvent.click(screen.getByRole("button", { name: "Delegación anterior" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(items[14].grade.name));
});
it("selecciona una casa directamente y enlaza a su historia correcta", async () => {
  render(<AtlasJourney items={items} reduced />);
  fireEvent.click(screen.getByRole("button", { name: /Cuarto Primaria Fonte Colombo/ }));
  await waitFor(() => expect(screen.getByRole("link", { name: /Descubrir su historia/ }).getAttribute("href")).toBe("#delegaciones/cuarto-primaria"));
  expect(screen.getByRole("button", { pressed: true }).textContent).toContain("Fonte Colombo");
});
it("mantiene el acceso directo al directorio con movimiento reducido", () => {
  const target = document.createElement("div"); target.id = "atlas-gallery"; target.scrollIntoView = vi.fn(); document.body.appendChild(target);
  render(<AtlasCinematicHero items={items} reduced />);
  fireEvent.click(screen.getByRole("button", { name: /Ir al directorio/ }));
  expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
  target.remove();
});
it("completa la transición animada entre fotografías y reseñas", async () => {
  const view = render(<AtlasJourney items={items} reduced={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Delegación siguiente" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(items[1].grade.name));
  await waitFor(() => expect(view.container.querySelectorAll(".atlas-stage-image")).toHaveLength(1));
  expect(view.container.querySelector(".atlas-stage-image img")?.getAttribute("alt")).toContain(items[1].photo!.place);
});
