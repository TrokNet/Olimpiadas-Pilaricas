import raw from "./data/tournament.json";
import type { Tournament } from "./types";
const dataset = raw as Tournament;
export function getTeamArt(gradeId: string) {
  return dataset.art?.[gradeId];
}
export const imageCredits = () =>
  Object.entries(dataset.art || {}).filter(([id]) => id !== "ex-alumnas");
