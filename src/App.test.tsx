// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import App from "./App";
import { STORAGE_KEY } from "./lib";
import raw from "./data/tournament.json";
vi.mock("./Scene", () => ({ default: () => <div data-testid="webgl-host" /> }));
vi.hoisted(() => {
  Object.defineProperty(Element.prototype, "animate", {
    value: undefined,
    configurable: true,
  });
});
function navigate(hash: string) {
  act(() => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(raw), {
          headers: { "content-type": "application/json" },
        }),
    ),
  );
  localStorage.clear();
  history.replaceState(null, "", "/");
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function withPrimary() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      primary: "cuarto-primaria",
      favorites: {},
      theme: "dark",
    }),
  );
}
describe("Flujo del visitante sin automatizar navegador", () => {
  it("navega desde el botón de delegaciones hasta una historia compartible", async () => {
    withPrimary();
    render(<App />);
    expect(
      screen
        .getByRole("link", { name: "Delegaciones Franciscanas" })
        .getAttribute("href"),
    ).toBe("#delegaciones");
    navigate("delegaciones");
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Galería de delegaciones" }),
      ).toBeTruthy(),
      { timeout: 5000 },
    );
    navigate("delegaciones/cuarto-primaria");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Fonte Colombo" }),
      ).toBeTruthy(),
    );
    expect(
      screen
        .getByRole("link", { name: "Ver sus partidos" })
        .getAttribute("href"),
    ).toBe("#equipo/cuarto-primaria");
  });
  it("abre el registro desde resultados en modo oficial y vuelve a la consulta", () => {
    withPrimary();
    render(<App />);
    navigate("resultados");
    expect(
      screen
        .getByRole("link", { name: "Ver resultados" })
        .getAttribute("aria-current"),
    ).toBe("page");
    fireEvent.click(screen.getByRole("link", { name: "Registrar resultados" }));
    navigate("resultados/registrar");
    expect(
      screen.getByLabelText("¿De qué equipo quieres registrar un resultado?"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Registrar resultados" })
        .getAttribute("aria-current"),
    ).toBe("page");
    navigate("resultados");
    expect(screen.queryByLabelText("Modo de resultados")).toBeNull();
    expect(screen.getByText("La emoción está por comenzar.")).toBeTruthy();
  });
  it("separa grupos y eliminatorio y abre el calendario del grupo", async () => {
    withPrimary();
    render(<App />);
    expect(
      screen.queryByRole("link", { name: "Cuadro del torneo" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Grupos" }));
    navigate("grupos");
    expect(screen.getByLabelText("Fase de grupos")).toBeTruthy();
    expect(
      screen.queryByLabelText("Eliminatorias: semifinales y final"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Ver eliminatorias" }));
    navigate("eliminatorio");
    expect(
      screen.getByLabelText("Eliminatorias: semifinales y final"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Fase de grupos")).toBeNull();
    navigate("finales");
    expect(
      screen.getByLabelText("Eliminatorias: semifinales y final"),
    ).toBeTruthy();
    navigate("grupos");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver partidos de GRUPO A" }),
    );
    navigate("fixture");
    await waitFor(() => expect(location.search).toContain("group=GRUPO+A"));
    expect(
      (screen.getByLabelText("Disciplina") as HTMLSelectElement).value,
    ).toBe("futbol-masculino");
  });
  it("la portada usa una imagen fija y mantiene los accesos al fixture", async () => {
    withPrimary();
    render(<App />);
    const image = screen.getByRole("img", {
      name: /Trofeo dorado con balones/,
    });
    expect(image.getAttribute("src")).toContain("stadium-hero-v2.webp");
    expect(screen.queryByTestId("webgl-host")).toBeNull();
    expect(screen.queryByText(/Mueve el cursor/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vóley" }));
    navigate("fixture");
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Disciplina") as HTMLSelectElement).value,
      ).toBe("voley-masculino"),
    );
  });
  it("el detalle presenta a los dos equipos con sus imágenes y horarios de la fuente", () => {
    const match = raw.matches.find(
      (m) => m.kind === "OFICIAL" && m.home_id && m.away_id,
    )!;
    history.replaceState(null, "", `/#partido/${match.id}`);
    render(<App />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelectorAll(".heritage-emblem img")).toHaveLength(2);
    expect(screen.getByText(`${match.start}–${match.end}`)).toBeTruthy();
    expect(screen.getByText(match.court)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Compartir partido" }),
    ).toBeTruthy();
  });
  it("publica créditos verificables de las fotografías", () => {
    withPrimary();
    render(<App />);
    navigate("imagenes");
    expect(document.querySelectorAll(".credits-grid article")).toHaveLength(14);
    expect(
      screen.getAllByRole("link", { name: /Ver fotografía original/ }),
    ).toHaveLength(14);
  });
  it("el gesto táctil desplaza el carrusel y el acceso al contenido no altera la ruta", async () => {
    render(<App />);
    await screen.findByRole("dialog");
    const carousel = screen.getByRole("region", {
      name: /Selector de equipos/,
    });
    fireEvent.pointerDown(carousel, { clientX: 300, pointerType: "touch" });
    fireEvent.pointerMove(carousel, { clientX: 180, pointerType: "touch" });
    fireEvent.pointerUp(carousel, { clientX: 180, pointerType: "touch" });
    expect(
      (
        screen.getByLabelText(
          "Seleccionar equipo en lista",
        ) as HTMLSelectElement
      ).value,
    ).toBe("4-anos");
    fireEvent.click(screen.getByRole("button", { name: /Este es mi equipo/ }));
    fireEvent.click(screen.getByRole("link", { name: "Ir al contenido" }));
    expect(location.hash).not.toBe("#contenido");
    expect(document.activeElement?.id).toBe("contenido");
  });
  it("primera entrada: elige grado, muestra el nombre y guarda su equipo", async () => {
    render(<App />);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Seleccionar equipo en lista"), {
      target: { value: "cuarto-primaria" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Este es mi equipo/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).primary).toBe(
      "cuarto-primaria",
    );
    expect(screen.getAllByText("Fonte Colombo").length).toBeGreaterThan(0);
    await waitFor(() => {
      const selection = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/analytics/team-selection");
      expect(selection).toBeTruthy();
      expect(JSON.parse(selection![1]?.body as string).grade_id).toBe("cuarto-primaria");
    });
  });
  it("flechas y selector accesible cambian el grado antes de confirmar", async () => {
    render(<App />);
    await screen.findByRole("dialog");
    const carousel = screen.getByRole("region", {
      name: /Selector de equipos/,
    });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(
      (
        screen.getByLabelText(
          "Seleccionar equipo en lista",
        ) as HTMLSelectElement
      ).value,
    ).toBe("4-anos");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).primary).toBeNull();
  });
  it("ver otro equipo no reemplaza el equipo guardado", async () => {
    withPrimary();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Ver otro equipo/ }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Seleccionar equipo en lista"), {
      target: { value: "tercero-primaria" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ver sus partidos/ }));
    navigate("equipo/tercero-primaria");
    expect(await screen.findByText(/Explorando Gubbio/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).primary).toBe(
      "cuarto-primaria",
    );
    const selections = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/analytics/team-selection");
    expect(selections).toHaveLength(1);
    expect(JSON.parse(selections[0][1]?.body as string).grade_id).toBe("cuarto-primaria");
    navigate("inicio");
    expect(screen.queryByText(/Explorando Gubbio/)).toBeNull();
  });
  it("favoritos limita la cuarta elección y persiste las tres anteriores", async () => {
    withPrimary();
    render(<App />);
    navigate("favoritos");
    const teamButtons = screen.getAllByRole("button", { pressed: false }).filter((button) => button.classList.contains("favorite-team"));
    expect(teamButtons.length).toBe(14);
    fireEvent.click(teamButtons[0]);
    fireEvent.click(teamButtons[1]);
    fireEvent.click(teamButtons[2]);
    fireEvent.click(teamButtons[3]);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).favorites[
        "futbol-masculino"
      ],
    ).toHaveLength(3);
  });
  it("filtros reales combinan equipo, disciplina, fecha y búsqueda", async () => {
    withPrimary();
    render(<App />);
    navigate("fixture");
    fireEvent.change(screen.getByLabelText("Disciplina"), {
      target: { value: "voley-femenino" },
    });
    fireEvent.change(screen.getByLabelText("Equipo / grado"), {
      target: { value: "cuarto-primaria" },
    });
    expect(screen.getByText("3 encuentros")).toBeTruthy();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar equipo, grado o cancha" }),
      { target: { value: "Espoleto" } },
    );
    expect(screen.getAllByText("1 encuentro").length).toBeGreaterThan(0);
    expect(location.search).toContain("sport=voley-femenino");
  });
  it("enlace de partido funciona sin obligar a completar bienvenida", () => {
    history.replaceState(null, "", "/#partido/invalid");
    render(<App />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Partido no encontrado")).toBeTruthy();
  });
});
it("cambia la paleta al consultar otro salón y recupera la del equipo principal", () => {
  withPrimary(); render(<App />);
  const root = document.documentElement;
  const coral = root.style.getPropertyValue("--house-color");
  expect(root.dataset.house).toBe("cuarto-primaria");
  navigate("equipo/primero-primaria");
  expect(root.dataset.house).toBe("primero-primaria");
  expect(root.style.getPropertyValue("--house-color")).not.toBe(coral);
  navigate("inicio");
  expect(root.dataset.house).toBe("cuarto-primaria");
  expect(root.style.getPropertyValue("--house-color")).toBe(coral);
  navigate("delegaciones/ex-alumnas");
  expect(root.dataset.house).toBe("ex-alumnas");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).primary).toBe("cuarto-primaria");
});
