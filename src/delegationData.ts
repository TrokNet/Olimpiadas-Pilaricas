import source from "./data/delegations.json";
import updates from "./data/delegation_updates.json";
import type { Tournament } from "./types";
import { fold } from "./lib";

export function delegationData(data: Tournament) {
  return source.delegations
    .map((history) => {
      const grade = data.grades.find((g) => g.id === history.id)!;
      return {
        ...history,
        ...(history.id === "ex-alumnas" ? updates["ex-alumnas"] : {}),
        grade,
        level:
          grade.id === "ex-alumnas"
            ? "Exalumnas"
            : grade.id.includes("anos")
              ? "Inicial"
              : grade.id.includes("primaria")
                ? "Primaria"
                : "Secundaria",
        photo: grade.id === "ex-alumnas" ? undefined : data.art?.[grade.id],
        family: history.category.includes("HUELLA")
          ? "San Francisco de Asís"
          : history.category.includes("CONGREGACIÓN")
            ? "Franciscanas de Montpellier"
            : history.id === "ex-alumnas"
              ? "Comunidad escolar"
              : history.id === "cuarto-secundaria"
                ? "Patrimonio de Francia"
                : "Presencia franciscana",
      };
    })
    .sort((a, b) => a.grade.display_order - b.grade.display_order);
}
export type Delegation = ReturnType<typeof delegationData>[number];
export function filterDelegations(
  items: Delegation[],
  query: string,
  level: string,
  country: string,
) {
  return items.filter(
    (d) =>
      (!level || d.level === level) &&
      (!country || (d.country || "Sin ubicación") === country) &&
      fold(
        [d.grade.name, d.placeName, d.grade.label, ...d.tags].join(" "),
      ).includes(fold(query.trim())),
  );
}
