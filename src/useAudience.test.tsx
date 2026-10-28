// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import useAudience from "./useAudience";
function Visitor() {
  useAudience();
  return null;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("shares one anonymous browser identifier across tabs and removes timers on unmount", () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  const interval = vi.spyOn(window, "setInterval");
  const clear = vi.spyOn(window, "clearInterval");
  const a = render(<Visitor />);
  const b = render(<Visitor />);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[0][1].body).visitor_id).toBe(
    JSON.parse(fetch.mock.calls[1][1].body).visitor_id,
  );
  expect(interval).toHaveBeenCalledWith(expect.any(Function), 30000);
  a.unmount();
  b.unmount();
  expect(clear).toHaveBeenCalled();
  vi.restoreAllMocks();
});
