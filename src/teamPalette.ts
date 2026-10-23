import { COLOR } from "./types";
import type { Grade } from "./types";
const rgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
function mix(a: string, b: string, weight: number) {
  const x = rgb(a), y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v * (1 - weight) + y[i] * weight).toString(16).padStart(2, "0")).join("");
}
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => rgb(hex).map((v) => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function teamPalette(grade: Grade | undefined, theme: "dark" | "light") {
  const house = COLOR[grade?.color || "Coral"] || COLOR.Coral;
  const light = theme === "light";
  const bg = mix(light ? "#ffffff" : "#101216", house, light ? .09 : .12);
  const panel = mix(light ? "#ffffff" : "#191d23", house, light ? .025 : .07);
  let accent = house;
  // Small accent text must stay readable even for yellow, gold and pastel houses.
  while (contrast(accent, panel) < 4.5) accent = mix(accent, light ? "#111827" : "#ffffff", .08);
  return {
    "--house-color": house,
    "--text": light ? "#17212b" : "#f7f8fa",
    "--muted": light ? "#52606c" : "#bdc6cf",
    "--border": light ? "#17212b26" : "#ffffff26",
    "--coral": accent,
    "--bg": bg,
    "--panel": panel,
    "--panel-alt": mix(light ? "#ffffff" : "#232831", house, light ? .09 : .1),
    "--team-soft": mix("#ffffff", house, .12),
    "--team-ink": mix("#101827", house, .3),
    "--team-button-ink": contrast(accent, "#101216") > contrast(accent, "#ffffff") ? "#101216" : "#ffffff",
  };
}
