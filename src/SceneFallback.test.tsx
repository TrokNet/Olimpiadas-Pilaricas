// @vitest-environment happy-dom
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Scene from "./Scene";
afterEach(cleanup);
it("mantiene una alternativa legible cuando el dispositivo no ofrece WebGL", () => {
  render(<Scene />);
  expect(screen.getByLabelText("Emblema deportivo")).toBeTruthy();
  expect(screen.getByText("JUNTOS HACEMOS HISTORIA")).toBeTruthy();
});
