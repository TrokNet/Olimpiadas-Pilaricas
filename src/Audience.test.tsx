// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Audience from "./Audience";
import raw from "./data/tournament.json";
import type { Tournament } from "./types";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps counters behind admin login", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <Audience
      data={{ ...raw, auth_user: null } as Tournament}
      onUpdate={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Tu tribuna, en números" }),
  ).toBeTruthy();
  expect(screen.queryByText("Visitantes acumulados")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it("does not query statistics for team accounts", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <Audience
      data={
        {
          ...raw,
          auth_user: {
            username: "cuarto-primaria",
            role: "team",
            grade_id: "cuarto-primaria",
          },
        } as Tournament
      }
      onUpdate={vi.fn()}
    />,
  );
  expect(screen.getByText("Solo para el administrador")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
it("separates recovered accesses from people and preserves historical unknowns", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            online: 2,
            total_visitors: 5,
            total_visits: 9,
            today_visitors: 3,
            today_visits: 4,
            period_visitors: 5,
            updated_at: 1793206800,
            tracking_started_at: 1793206800,
            historical_coverage_from: "2026-10-23",
            recovered_accesses: 17,
            history: [
              {
                date: "2026-10-23",
                visitors: 0,
                visits: 0,
                recovered_accesses: 17,
              },
            ],
          }),
        ),
      ),
  );
  render(
    <Audience
      data={
        {
          ...raw,
          auth_user: {
            username: "administrador",
            role: "admin",
            grade_id: null,
          },
        } as Tournament
      }
      onUpdate={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByText("17 accesos históricos recuperados")).toBeTruthy(),
  );
  expect(screen.getByText("Visitantes acumulados")).toBeTruthy();
  expect(screen.getAllByText("—")).toHaveLength(2);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
    "/api/admin/analytics?all_history=true",
  );
});
it("returns to private login when the session expires", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
  );
  render(
    <Audience
      data={
        {
          ...raw,
          auth_user: {
            username: "administrador",
            role: "admin",
            grade_id: null,
          },
        } as Tournament
      }
      onUpdate={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Tu tribuna, en números" }),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("Visitantes acumulados")).toBeNull();
});
