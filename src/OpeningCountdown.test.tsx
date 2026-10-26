// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OpeningCountdown, { OPENING_AT, openingRemaining } from "./OpeningCountdown";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("Cuenta regresiva de apertura", () => {
  it("usa el 31 de octubre a las 7 de Lima", () => {
    expect(new Date(OPENING_AT).toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(openingRemaining(OPENING_AT - 90061000).values).toEqual([1, 1, 1, 1]);
  });
  it("no muestra tiempos negativos y termina en el instante de apertura", () => {
    expect(openingRemaining(OPENING_AT)).toEqual({ started: true, values: [0, 0, 0, 0] });
    expect(openingRemaining(OPENING_AT + 10000).values).toEqual([0, 0, 0, 0]);
  });
  it("actualiza el reloj y cambia al mensaje de inicio", () => {
    vi.useFakeTimers(); vi.setSystemTime(OPENING_AT - 2000);
    render(<OpeningCountdown />);
    expect(screen.getByRole("timer").getAttribute("aria-label")).toContain("2 segundos");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("¡Las Olimpiadas ya comenzaron!")).toBeTruthy();
  });
});
