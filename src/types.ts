export interface Grade {
  id: string;
  label: string;
  name: string;
  color: string;
  display_order: number;
}
export interface Entry {
  id: string;
  sport: string;
  team_number: number;
  grade_id: string;
  source_row: number;
}
export interface Match {
  result?: RecordedResult;
  id: string;
  date: string;
  start: string;
  end: string;
  sport: string;
  phase: string;
  court: string;
  home_id: string | null;
  away_id: string | null;
  home_label: string;
  away_label: string;
  kind: string;
  referee: string;
  home_score: number | null;
  away_score: number | null;
  source_row: number;
  source_sheet: string;
}
export interface ScoringRule {
  wo_win?: number;
  wo_loss?: number;
  wo_score_for?: number | null;
  wo_score_against?: number;
  wo_set_points?: number;
  win: number;
  draw: number;
  loss: number;
  allow_draw: boolean;
  tiebreakers: ("points" | "wins" | "difference" | "for")[];
}
export interface Tournament {
  capabilities?: { result_write: boolean; auth_required?: boolean };
  auth_user?: {
    username: string;
    role: "admin" | "team";
    grade_id: string | null;
  } | null;
  art?: Record<string, TeamArt>;
  schemaVersion: number;
  timezone: string;
  metadata: Record<string, string>;
  grades: Grade[];
  entries: Entry[];
  matches: Match[];
  rules?: Record<string, ScoringRule>;
}
export interface RecordedResult {
  home_score: number;
  away_score: number;
  home_points: number;
  away_points: number;
  home_yellow: number;
  away_yellow: number;
  home_red: number;
  away_red: number;
  walkover: "none" | "home" | "away" | "both";
  sets: { home: number; away: number }[];
  updated_at?: string;
}
export interface TeamArt {
  image: string;
  place: string;
  country: string;
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
  reference: string;
}
export type Favorites = Record<string, string[]>;
export interface Preferences {
  version: 1;
  primary: string | null;
  favorites: Favorites;
  theme: "dark" | "light";
}
export interface Filters {
  sport: string;
  date: string;
  grade: string;
  group: string;
  court: string;
  phase: string;
  query: string;
  period: string;
  hour: string;
}
export const SPORTS = [
  {
    id: "futbol-masculino",
    label: "Fútbol 6 masculino",
    short: "Fútbol",
    category: "Masculino",
    icon: "football",
  },
  {
    id: "voley-masculino",
    label: "Vóley masculino",
    short: "Vóley",
    category: "Masculino",
    icon: "volleyball",
  },
  {
    id: "voley-femenino",
    label: "Vóley femenino",
    short: "Vóley",
    category: "Femenino",
    icon: "volleyball",
  },
  {
    id: "basquet-masculino",
    label: "Básquet masculino",
    short: "Básquet",
    category: "Masculino",
    icon: "basketball",
  },
  {
    id: "basquet-femenino",
    label: "Básquet femenino",
    short: "Básquet",
    category: "Femenino",
    icon: "basketball",
  },
];
export const COLOR: Record<string, string> = {
  Coral: "#ff6b61",
  Turqueza: "#6bd5cf",
  Rosado: "#f9a6c2",
  Violeta: "#b99aff",
  Amarillo: "#ffe16a",
  Oro: "#ddbc66",
  Rojo: "#ff7971",
  Lila: "#c4abf5",
  Celeste: "#8dc9f5",
  Naranja: "#ffac67",
  Azul: "#7fa9ff",
  Lima: "#c2dd73",
  "Azul Marino": "#94a2ce",
  Fuxia: "#f591d3",
};
